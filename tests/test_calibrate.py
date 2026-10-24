import numpy as np
import pandas as pd

from decision.calibrate import con_memoria


def _serie(nombre, escala=1.0):
    idx = pd.date_range("2020-01-01", periods=300, freq="B")
    return pd.Series(escala * (100 + np.arange(300)), index=idx, name=nombre)


def _contador():
    llamadas = []

    def predict(precios, plazo_dias, es_cripto=False):
        llamadas.append((precios.name, len(precios), plazo_dias, es_cripto))
        return {"rendimiento_esperado": float(precios.iloc[-1]), "volatilidad": 0.1,
                "prob_perdida": 0.4, "intervalo": (-0.1, 0.1)}

    return predict, llamadas


def test_repite_la_misma_ventana_sin_volver_a_llamar():
    predict, llamadas = _contador()
    p = con_memoria(predict)
    s = _serie("SPY")
    a = p(s.iloc[:200], 30)
    b = p(s.iloc[:200], 30)
    assert a == b and len(llamadas) == 1


def test_distingue_activo_fecha_plazo_y_cripto():
    predict, llamadas = _contador()
    p = con_memoria(predict)
    s = _serie("SPY")
    p(s.iloc[:200], 30)
    p(s.iloc[:201], 30)
    p(s.iloc[:200], 90)
    p(s.iloc[:200], 30, es_cripto=True)
    p(_serie("QQQ").iloc[:200], 30)
    p(_serie(None, 2.0).iloc[:200], 30)
    p(_serie(None, 3.0).iloc[:200], 30)
    assert len(llamadas) == 7


def test_devuelve_una_copia():
    predict, _ = _contador()
    p = con_memoria(predict)
    s = _serie("SPY").iloc[:200]
    p(s, 30)["prob_perdida"] = 0.99
    assert p(s, 30)["prob_perdida"] == 0.4
