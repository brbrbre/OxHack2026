"""Contrato del modelo del equipo (model/predict.py).

Se salta solo mientras model/predict.py no exista. En cuanto exista, revisa:
- la forma de la respuesta (lo que piden el API y la regla de decisión);
- que no vea el futuro: solo puede usar los precios que recibe;
- que dé lo mismo si se llama dos veces;
- que sea rápido, porque el backtest lo llama ~1,200 veces.
"""

import importlib.util
import inspect
import time

import numpy as np
import pandas as pd
import pytest

if importlib.util.find_spec("model.predict") is None:
    pytest.skip("model/predict.py todavía no existe", allow_module_level=True)

from model import predict as modelo  # noqa: E402


def _serie(n=1500, freq="B", seed=7):
    rng = np.random.default_rng(seed)
    idx = pd.date_range(end="2026-10-23", periods=n, freq=freq)
    return pd.Series(100 * np.exp(np.cumsum(rng.normal(0.0004, 0.012, n))), index=idx, name="SPY")


def _llamar(precios, plazo=30, es_cripto=False):
    if "es_cripto" in inspect.signature(modelo.predict).parameters:
        return modelo.predict(precios, plazo, es_cripto=es_cripto)
    return modelo.predict(precios, plazo)


@pytest.mark.parametrize("plazo", [7, 30, 90])
def test_forma_de_la_respuesta(plazo):
    r = _llamar(_serie(), plazo)
    assert set(r) >= {"rendimiento_esperado", "volatilidad", "prob_perdida", "intervalo"}
    bajo, alto = r["intervalo"]
    assert np.isfinite([r["rendimiento_esperado"], r["volatilidad"], r["prob_perdida"], bajo, alto]).all()
    assert 0 <= r["prob_perdida"] <= 1
    assert r["volatilidad"] > 0
    assert bajo < alto and bajo > -1


def test_cripto_tambien_funciona():
    r = _llamar(_serie(freq="D"), 30, es_cripto=True)
    assert 0 <= r["prob_perdida"] <= 1


def test_no_lee_datos_por_su_cuenta(monkeypatch):
    import data.fetch as fetch

    def prohibido(*a, **k):
        raise AssertionError("predict() leyó datos por su cuenta: solo puede usar `precios`")

    for nombre in ("get_close", "get_prices", "load", "fetch_many", "fetch_yahoo", "fetch_binance"):
        monkeypatch.setattr(fetch, nombre, prohibido)
    _llamar(_serie(), 30)


def test_solo_usa_el_pasado():
    s = _serie()
    corte = s.iloc[:1200]
    otro_futuro = pd.concat([corte, s.iloc[1200:] * 3])
    assert _llamar(corte) == _llamar(otro_futuro.iloc[:1200])


def test_es_determinista():
    s = _serie()
    assert _llamar(s) == _llamar(s)


def test_es_rapido():
    s = _serie()
    t0 = time.perf_counter()
    _llamar(s)
    assert time.perf_counter() - t0 < 2.0, "más de 2 s por llamada: el backtest tardaría más de 40 min"
