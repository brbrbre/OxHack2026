"""Pruebas del API con precios sintéticos. No usan internet."""

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import baseline, main


def _serie(drift: float, n: int = 1000) -> pd.Series:
    rng = np.random.default_rng(0)
    ret = rng.normal(drift, 0.01, n)
    idx = pd.bdate_range(end="2026-10-23", periods=n)
    return pd.Series(100 * np.exp(np.cumsum(ret)), index=idx)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main, "get_close", lambda s: _serie(0.001))
    return TestClient(main.app)


def test_assets(client):
    r = client.get("/api/assets")
    assert r.status_code == 200
    body = r.json()
    assert "Crypto" in body and {"simbolo": "BTCUSDT", "nombre": "Bitcoin"} in body["Crypto"]
    assert sum(len(v) for v in body.values()) == 19


def test_prices(client):
    r = client.get("/api/prices/SPY?dias=30")
    body = r.json()
    assert r.status_code == 200
    assert len(body["fechas"]) == len(body["cierres"]) > 0
    assert body["fechas"][-1] == "2026-10-23"


def test_decide_shape(client):
    r = client.post("/api/decide", json={"simbolo": "SPY", "monto": 1000, "plazo_dias": 30, "perfil": "moderado"})
    body = r.json()
    assert r.status_code == 200
    assert body["decision"] in {"INVERTIR", "ESPERAR", "NO_POR_AHORA"}
    assert body["modelo"] == "baseline"
    assert body["aviso"].startswith("Educational prototype")
    for k in ["monto", "plazo_dias", "perfil", "rendimiento_esperado", "volatilidad",
              "prob_perdida", "senal", "peor_caso", "mejor_caso", "eventos"]:
        assert k in body["numeros"]


def test_errors(client):
    assert client.get("/api/prices/NOPE").json() == {"error": "Unknown asset: NOPE"}
    r = client.post("/api/decide", json={"simbolo": "SPY", "monto": -5, "plazo_dias": 30})
    assert r.status_code == 400 and "monto" in r.json()["error"]


def test_baseline_respeta_el_signo():
    up = baseline.predict(_serie(0.002), 30)
    down = baseline.predict(_serie(-0.002), 30)
    assert up["rendimiento_esperado"] > 0 > down["rendimiento_esperado"]
    assert up["prob_perdida"] < 0.5 < down["prob_perdida"]
    lo, hi = up["intervalo"]
    assert lo < up["rendimiento_esperado"] < hi
