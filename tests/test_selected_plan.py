"""Selected-asset plans: synthetic prices/model only, no network or sponsor calls."""

from datetime import date
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import main
from decision.plan import TOPE_POR_ACTIVO, _pesos


def _series(seed, volatility=0.003):
    rng = np.random.default_rng(seed)
    index = pd.bdate_range(end="2026-11-06", periods=900)
    return pd.Series(100 * np.exp(np.cumsum(rng.normal(0.0004, volatility, len(index)))), index=index)


def _prediction(volatility=0.02, expected=0.03, loss_probability=0.2, interval=(-0.02, 0.09)):
    return {"rendimiento_esperado": expected, "volatilidad": volatility,
            "prob_perdida": loss_probability, "intervalo": interval}


def _request(symbols=None, **overrides):
    return {"simbolos": ["VOO", "GLD"] if symbols is None else symbols,
            "monto": 1000, "plazo_dias": 30, "perfil": "moderado", **overrides}


@pytest.fixture
def selected(monkeypatch):
    symbols = [symbol for group in main.ASSETS.values() for symbol in group]
    prices = {symbol: _series(seed) for seed, symbol in enumerate(symbols)}
    predictions = {symbol: _prediction() for symbol in symbols}
    predictions["GLD"] = _prediction(volatility=0.03)
    fetched, predicted, loaded = [], [], []

    def get_close(symbol):
        fetched.append(symbol)
        return prices[symbol]

    def run_prediction(series, days, symbol):
        assert series is prices[symbol]
        predicted.append((symbol, days))
        return predictions[symbol], "synthetic-test"

    def load_model():
        loaded.append(True)
        return None, "synthetic-test"

    class FixedDate(date):
        @classmethod
        def today(cls):
            return cls(2026, 11, 9)  # outside the announcement window

    monkeypatch.setattr(main, "date", FixedDate)
    monkeypatch.setattr(main, "get_close", get_close)
    monkeypatch.setattr(main, "run_prediction", run_prediction)
    monkeypatch.setattr(main, "load_model", load_model)
    return SimpleNamespace(client=TestClient(main.app), prices=prices, predictions=predictions,
                           fetched=fetched, predicted=predicted, loaded=loaded)


def _assert_budget(plan):
    assert sum(holding["monto"] for holding in plan["cartera"]) == pytest.approx(plan["numeros"]["invertido"])
    assert plan["numeros"]["invertido"] + plan["efectivo"] == pytest.approx(plan["numeros"]["monto"])
    assert plan["efectivo"] >= -1e-8
    assert plan["numeros"]["peor_caso"] >= -plan["numeros"]["tolerancia"] * plan["numeros"]["monto"] - 1e-8


def test_uses_model_weights_and_only_fetches_selected_assets(selected):
    response = selected.client.post("/api/plan/selected", json=_request())
    assert response.status_code == 200
    plan = response.json()
    weights = {holding["simbolo"]: holding["peso"] for holding in plan["cartera"]}
    assert weights == pytest.approx({"VOO": 0.6, "GLD": 0.4})
    assert {holding["simbolo"]: holding["monto"] for holding in plan["cartera"]} == pytest.approx({"VOO": 600, "GLD": 400})
    assert selected.fetched == ["VOO", "GLD"]
    assert selected.predicted == [("VOO", 30), ("GLD", 30)]
    assert {item["simbolo"] for key in ("invertir", "esperar", "no_por_ahora") for item in plan[key]} == {"VOO", "GLD"}
    assert set(plan) == {"cartera", "efectivo", "invertir", "esperar", "no_por_ahora", "resumen", "numeros", "modelo", "aviso"}
    assert plan["modelo"] == "synthetic-test"
    _assert_budget(plan)


@pytest.mark.parametrize("symbols", [["GLD"], ["GLD", "VOO"]])
def test_one_eligible_asset_can_hold_full_budget_without_forcing_bad_assets_in(selected, symbols):
    selected.predictions["VOO"] = _prediction(expected=-0.03, loss_probability=0.7)
    response = selected.client.post("/api/plan/selected", json=_request(symbols))
    assert response.status_code == 200
    plan = response.json()
    assert [(holding["simbolo"], holding["peso"]) for holding in plan["cartera"]] == [("GLD", 1.0)]
    assert plan["cartera"][0]["monto"] == 1000
    assert plan["efectivo"] == 0
    assert [asset["simbolo"] for asset in plan["no_por_ahora"]] == (["VOO"] if "VOO" in symbols else [])
    _assert_budget(plan)


@pytest.mark.parametrize("symbols", [["VOO"], ["VOO", "GLD"]])
def test_fed_event_sizing_still_limits_a_single_eligible_selected_asset(selected, monkeypatch, symbols):
    class BeforeFed(date):
        @classmethod
        def today(cls):
            return cls(2026, 10, 25)

    monkeypatch.setattr(main, "date", BeforeFed)
    selected.predictions["GLD"] = _prediction(volatility=0.2, interval=(-0.5, 0.6))
    response = selected.client.post("/api/plan/selected", json=_request(symbols))
    assert response.status_code == 200
    plan = response.json()
    assert [(holding["simbolo"], holding["peso"]) for holding in plan["cartera"]] == [("VOO", 0.5)]
    assert plan["cartera"][0]["monto"] == 500
    assert plan["efectivo"] == 500
    assert next(asset for asset in plan["invertir"] if asset["simbolo"] == "VOO")["fraccion"] == 0.5
    assert [asset["simbolo"] for asset in plan["esperar"]] == (["GLD"] if "GLD" in symbols else [])
    _assert_budget(plan)


def test_different_individual_limits_preserve_weight_ratios_and_leave_cash(selected):
    selected.predictions["VOO"] = _prediction(volatility=0.01, interval=(-1 / 6, 0.3))
    selected.predictions["GLD"] = _prediction(volatility=0.03, interval=(-0.125, 0.2))
    response = selected.client.post("/api/plan/selected", json=_request())
    assert response.status_code == 200
    plan = response.json()
    weights = {holding["simbolo"]: holding["peso"] for holding in plan["cartera"]}
    fractions = {asset["simbolo"]: asset["fraccion"] for asset in plan["invertir"]}
    assert fractions == pytest.approx({"VOO": 0.6, "GLD": 0.8})
    assert weights == pytest.approx({"VOO": 0.6, "GLD": 0.2})
    assert weights["VOO"] / weights["GLD"] == pytest.approx(3)
    assert all(weight <= fractions[symbol] + 1e-9 for symbol, weight in weights.items())
    assert plan["efectivo"] == pytest.approx(200)
    _assert_budget(plan)


@pytest.mark.parametrize("decision", ["esperar", "no_por_ahora"])
def test_no_eligible_selected_assets_leaves_full_budget_in_cash(selected, decision):
    selected.predictions["VOO"] = (_prediction(volatility=0.2, interval=(-0.5, 0.6)) if decision == "esperar"
                                   else _prediction(expected=-0.02, loss_probability=0.7))
    response = selected.client.post("/api/plan/selected", json=_request(["VOO"]))
    assert response.status_code == 200
    plan = response.json()
    assert plan["cartera"] == []
    assert plan["efectivo"] == 1000 and plan["numeros"]["invertido"] == 0
    assert [asset["simbolo"] for asset in plan[decision]] == ["VOO"]
    _assert_budget(plan)


def test_covariance_risk_can_still_reduce_the_invested_amount(selected):
    selected.prices["VOO"] = _series(31, volatility=0.08)
    selected.prices["GLD"] = _series(32, volatility=0.08)
    response = selected.client.post("/api/plan/selected", json=_request())
    assert response.status_code == 200
    plan = response.json()
    assert 0 < plan["numeros"]["invertido"] < 1000
    assert 0 < plan["efectivo"] < 1000
    weights = {holding["simbolo"]: holding["peso"] for holding in plan["cartera"]}
    assert weights["VOO"] / weights["GLD"] == pytest.approx(1.5)
    _assert_budget(plan)


def test_still_excludes_near_duplicate_selected_assets(selected):
    selected.prices["SPY"] = selected.prices["VOO"] * 1.0001
    response = selected.client.post("/api/plan/selected", json=_request(["SPY", "VOO"]))
    assert response.status_code == 200
    plan = response.json()
    assert len(plan["cartera"]) == 1
    assert {holding["simbolo"] for holding in plan["cartera"]} <= {"SPY", "VOO"}
    excluded = [asset for asset in plan["invertir"] if asset["fuera_del_plan"]]
    assert len(excluded) == 1 and excluded[0]["fuera_del_plan"].startswith("Moves almost like")
    _assert_budget(plan)


def test_maximum_five_holdings_is_preserved(selected):
    symbols = ["SPY", "VOO", "QQQ", "GLD", "AAPL", "MSFT"]
    response = selected.client.post("/api/plan/selected", json=_request(symbols))
    assert response.status_code == 200
    plan = response.json()
    assert len(plan["cartera"]) == 5
    assert len(plan["invertir"]) == 6
    assert [asset["fuera_del_plan"] for asset in plan["invertir"] if asset["fuera_del_plan"]] == ["The plan holds up to 5 assets."]
    _assert_budget(plan)


@pytest.mark.parametrize("days", [1, 17, 60, 730])
def test_accepts_custom_calendar_horizons_with_existing_api_limits(selected, days):
    response = selected.client.post("/api/plan/selected", json=_request(["GLD"], plazo_dias=days))
    assert response.status_code == 200
    assert response.json()["numeros"]["plazo_dias"] == days
    assert selected.predicted == [("GLD", days)]


@pytest.mark.parametrize("overrides,status", [
    ({"simbolos": []}, 400), ({"simbolos": ["VOO", "VOO"]}, 400),
    ({"simbolos": ["VOO", "NOPE"]}, 404), ({"simbolos": "VOO"}, 400),
    ({"monto": 0}, 400), ({"monto": -1}, 400), ({"monto": 1e9 + 1}, 400),
    ({"plazo_dias": 0}, 400), ({"plazo_dias": 731}, 400), ({"plazo_dias": 1.5}, 400),
    ({"perfil": "moderate"}, 400),
])
def test_rejects_invalid_requests_before_prices_or_model(selected, overrides, status):
    response = selected.client.post("/api/plan/selected", json=_request(**overrides))
    assert response.status_code == status
    assert isinstance(response.json()["error"], str)
    assert selected.fetched == [] and selected.predicted == [] and selected.loaded == []


def test_prediction_failure_has_existing_error_shape(selected, monkeypatch):
    def fail(*args):
        raise ValueError("Synthetic model failure")
    monkeypatch.setattr(main, "run_prediction", fail)
    response = selected.client.post("/api/plan/selected", json=_request(["GLD"]))
    assert response.status_code == 400
    assert response.json() == {"error": "Synthetic model failure"}


def test_selected_summary_uses_selected_plan_and_registers_existing_audio_flow(selected, monkeypatch):
    response = selected.client.post("/api/summary/plan/selected", json=_request())
    assert response.status_code == 200
    body = response.json()
    assert body["fuente"] == "template"
    assert "$600" in body["texto"] and "$400" in body["texto"]
    assert selected.fetched == ["VOO", "GLD"]
    assert selected.predicted == [("VOO", 30), ("GLD", 30)]
    assert body["texto"] in main.resumen.generados
    monkeypatch.setattr(main.voz, "audio", lambda text: b"ID3selected-local-test")
    audio = selected.client.post("/api/listen", json={"texto": body["texto"]})
    assert audio.status_code == 200 and audio.content == b"ID3selected-local-test"


def test_selected_request_never_changes_automatic_plan_cap_or_results(selected):
    request = {"monto": 1000, "plazo_dias": 30, "perfil": "moderado", "tipos": ["ETFs"]}
    before = selected.client.post("/api/plan", json=request)
    assert before.status_code == 200
    concentrated = selected.client.post("/api/plan/selected", json=_request(["GLD"]))
    assert concentrated.status_code == 200 and concentrated.json()["cartera"][0]["peso"] == 1.0
    after = selected.client.post("/api/plan", json=request)
    assert after.status_code == 200 and after.json() == before.json()
    assert TOPE_POR_ACTIVO == 0.4
    assert all(holding["peso"] <= 0.4 + 1e-9 for holding in after.json()["cartera"])
    assert _pesos([{"volatilidad": 0.02}, {"volatilidad": 0.03}]) == [0.4, 0.4]


@pytest.mark.parametrize("cap", [0, -0.1, 1.01, float("inf"), float("nan")])
def test_rejects_invalid_internal_weight_limits(cap):
    with pytest.raises(ValueError, match="asset weight limit"):
        _pesos([{"volatilidad": 0.02}], tope_por_activo=cap)
