"""Pruebas del plan de inversión, con precios sintéticos. No usan internet."""

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import main
from decision.plan import TOPE_POR_ACTIVO, _pesos, plan


def _serie(drift, vol, seed):
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range(end="2026-10-23", periods=900)
    return pd.Series(100 * np.exp(np.cumsum(rng.normal(drift, vol, len(idx)))), index=idx)


PRECIOS = {"A": _serie(0.0008, 0.008, 1), "B": _serie(0.0008, 0.012, 2),
           "C": _serie(0.0008, 0.03, 3), "D": _serie(-0.002, 0.01, 4)}


def pred(mu, sigma, p):
    return {"rendimiento_esperado": mu, "volatilidad": sigma, "prob_perdida": p, "intervalo": (mu - 1.645 * sigma, mu + 1.645 * sigma)}


PREDS = {"A": pred(0.01, 0.03, 0.4), "B": pred(0.012, 0.05, 0.4), "C": pred(0.03, 0.15, 0.42), "D": pred(-0.02, 0.04, 0.6)}


def _plan(perfil="moderado", grupos=None):
    grupos = grupos or {"G1": ["A", "B", "D"], "G2": ["C"]}
    return plan(10_000, 30, perfil, grupos, PRECIOS, {}, lambda s, p: PREDS[s])


def test_divide_en_tres_listas():
    r = _plan()
    assert [x["simbolo"] for x in r["no_por_ahora"]] == ["D"]
    todos = {x["simbolo"] for k in ("invertir", "esperar", "no_por_ahora") for x in r[k]}
    assert todos == {"A", "B", "C", "D"}


def test_cartera_respeta_monto_tope_y_tolerancia():
    r = _plan()
    assert abs(sum(c["monto"] for c in r["cartera"]) + r["efectivo"] - 10_000) < 1e-6
    assert all(c["peso"] <= TOPE_POR_ACTIVO + 1e-9 for c in r["cartera"])
    assert r["numeros"]["peor_caso"] >= -0.10 * 10_000 - 1e-6
    assert "D" not in {c["simbolo"] for c in r["cartera"]}


def test_mas_peso_a_lo_que_se_mueve_menos():
    r = _plan()
    pesos = {c["simbolo"]: c["peso"] for c in r["cartera"]}
    assert pesos["A"] >= pesos["B"]


def test_conservador_invierte_menos():
    assert _plan("conservador")["numeros"]["invertido"] < _plan("agresivo")["numeros"]["invertido"]


def test_sin_candidatos_todo_en_efectivo():
    r = _plan(grupos={"G1": ["D"]})
    assert r["cartera"] == [] and r["efectivo"] == 10_000


def test_pesos_con_tope():
    w = _pesos([{"volatilidad": 0.01}, {"volatilidad": 0.5}, {"volatilidad": 0.5}])
    assert max(w) <= TOPE_POR_ACTIVO + 1e-9 and abs(sum(w) - 1) < 1e-9


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main, "get_close", lambda s: _serie(0.0008, 0.01, hash(s) % 100))
    return TestClient(main.app)


def test_ruta_plan(client):
    r = client.post("/api/plan", json={"monto": 5000, "plazo_dias": 90, "perfil": "moderado", "tipos": ["ETFs", "Crypto"]})
    body = r.json()
    assert r.status_code == 200
    for k in ["cartera", "efectivo", "invertir", "esperar", "no_por_ahora", "resumen", "numeros", "modelo", "aviso"]:
        assert k in body
    simbolos = {x["simbolo"] for k in ("invertir", "esperar", "no_por_ahora") for x in body[k]}
    assert simbolos == {"SPY", "VOO", "QQQ", "GLD", "BTCUSDT", "ETHUSDT", "SOLUSDT"}


def test_ruta_plan_tipo_invalido(client):
    r = client.post("/api/plan", json={"monto": 5000, "plazo_dias": 90, "tipos": ["Bonos"]})
    assert r.status_code == 400 and "Bonos" in r.json()["error"]


def test_salta_activos_que_se_copian():
    gemelo = PRECIOS["A"] * 1.0001
    precios = {**PRECIOS, "A2": gemelo}
    preds = {**PREDS, "A2": PREDS["A"]}
    r = plan(10_000, 30, "moderado", {"G1": ["A", "A2", "B"]}, precios, {}, lambda s, p: preds[s])
    elegidos = {c["simbolo"] for c in r["cartera"]}
    assert not {"A", "A2"} <= elegidos


@pytest.mark.parametrize("vols", [[0.01, 0.02, 0.5], [0.01, 0.011, 0.012, 1.0], [0.005, 0.02, 0.03, 0.04, 0.05], [0.01, 0.01, 0.9]])
def test_tope_nunca_se_pasa(vols):
    w = _pesos([{"volatilidad": v} for v in vols])
    assert max(w) <= TOPE_POR_ACTIVO + 1e-9
    assert abs(sum(w) - min(1.0, len(vols) * TOPE_POR_ACTIVO)) < 1e-9


def test_dos_activos_dejan_efectivo():
    w = _pesos([{"volatilidad": 0.01}, {"volatilidad": 0.02}])
    assert w == [TOPE_POR_ACTIVO, TOPE_POR_ACTIVO]


def test_dice_por_que_un_activo_invertible_no_entro():
    gemelo = PRECIOS["A"] * 1.0001
    precios = {**PRECIOS, "A2": gemelo}
    preds = {**PREDS, "A2": PREDS["A"]}
    r = plan(10_000, 30, "moderado", {"G1": ["A", "A2", "B"]}, precios, {"A": "Fondo A", "A2": "Fondo A2"},
             lambda s, p: preds[s])
    elegidos = {c["simbolo"] for c in r["cartera"]}
    for x in r["invertir"]:
        if x["simbolo"] in elegidos:
            assert x["fuera_del_plan"] is None
        else:
            assert x["fuera_del_plan"].startswith("Moves almost like Fondo A")
    assert all("fuera_del_plan" not in x for x in r["esperar"] + r["no_por_ahora"])


def test_cartera_llena_lo_dice():
    rng = np.random.default_rng(9)
    idx = PRECIOS["A"].index
    sims = [f"S{i}" for i in range(7)]
    precios = {s: pd.Series(100 * np.exp(np.cumsum(rng.normal(0.0008, 0.01, len(idx)))), index=idx) for s in sims}
    r = plan(10_000, 30, "moderado", {"G": sims}, precios, {}, lambda s, p: pred(0.01, 0.03, 0.4))
    fuera = [x for x in r["invertir"] if x["fuera_del_plan"]]
    assert len(r["cartera"]) == 5 and len(fuera) == 2
    assert all(x["fuera_del_plan"] == "The plan holds up to 5 assets." for x in fuera)
