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


def _detalle(fraccion):
    rng = np.random.default_rng(3)
    filas = []
    for s, vol in [("A", 0.02), ("B", 0.08)]:
        for v in range(60):
            r = float(rng.normal(0.005, vol))
            filas.append({"ventana": v, "simbolo": s, "r_siempre": r})
    d = pd.DataFrame(filas)
    d["fraccion"] = fraccion(d)
    d["r_app"] = d["fraccion"] * d["r_siempre"]
    return d


def test_sin_momento_la_app_empata_con_su_tamano():
    from decision.calibrate import momento_vs_tamano
    d = _detalle(lambda d: np.where(d["simbolo"] == "A", 0.9, 0.2))
    m = momento_vs_tamano(d, 30, reps=200)
    assert abs(m["sharpe_app"] - m["sharpe_tamano"]) < 1e-9
    assert m["placebo"] == 1.0


def test_momento_perfecto_le_gana_al_placebo():
    from decision.calibrate import momento_vs_tamano
    d = _detalle(lambda d: (d["r_siempre"] > 0).astype(float))
    m = momento_vs_tamano(d, 30, reps=200)
    assert m["sharpe_app"] > m["sharpe_tamano"]
    assert m["placebo"] < 0.05
