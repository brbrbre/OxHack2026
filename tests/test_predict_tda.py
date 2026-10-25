"""Trend + TDA model tests with synthetic prices. No internet needed."""

import numpy as np
import pandas as pd
import pytest

from model import predict_tda


def _serie(drift: float, n: int = 1000) -> pd.Series:
    rng = np.random.default_rng(0)
    ret = rng.normal(drift, 0.01, n)
    idx = pd.bdate_range(end="2026-10-23", periods=n)
    return pd.Series(100 * np.exp(np.cumsum(ret)), index=idx)


def test_contrato():
    p = predict_tda.predict(_serie(0.0005), 30)
    assert set(p) == {"rendimiento_esperado", "volatilidad", "prob_perdida", "intervalo"}
    lo, hi = p["intervalo"]
    assert lo < p["rendimiento_esperado"] < hi
    assert 0 < p["prob_perdida"] < 1 and p["volatilidad"] > 0


def test_tendencia_sube_el_pronostico():
    up = predict_tda.predict(_serie(0.002), 30)
    down = predict_tda.predict(_serie(-0.002), 30)
    assert up["rendimiento_esperado"] > down["rendimiento_esperado"]
    assert up["prob_perdida"] < down["prob_perdida"]


def test_plazo_mas_largo_mas_riesgo():
    corto, largo = predict_tda.predict(_serie(0.0005), 30), predict_tda.predict(_serie(0.0005), 365)
    assert largo["volatilidad"] > corto["volatilidad"]


def test_historial_corto():
    with pytest.raises(ValueError, match="Need at least"):
        predict_tda.predict(_serie(0.001, n=300), 30)


def test_modelo_se_elige_con_variable(monkeypatch):
    import importlib
    import model.predict as elegido
    monkeypatch.setenv("MODELO", "xgboost")
    assert importlib.reload(elegido).NOMBRE == "xgboost"
    monkeypatch.delenv("MODELO")
    assert importlib.reload(elegido).NOMBRE == "tendencia-tda"


def test_parametros_con_corte_no_ven_2022():
    import json
    from pathlib import Path
    p = json.loads((Path(predict_tda.__file__).with_name("params_tda_hasta_2021.json")).read_text())
    assert p["trained_until"] < "2022-01-01"
