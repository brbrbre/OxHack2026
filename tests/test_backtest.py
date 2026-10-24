"""Pruebas del backtest con precios sintéticos. No usan internet."""

import numpy as np
import pandas as pd

from decision.backtest import resumen, run


def _serie(n=2000, drift=0.0005):
    rng = np.random.default_rng(1)
    idx = pd.bdate_range(end="2026-10-23", periods=n)
    return pd.Series(100 * np.exp(np.cumsum(rng.normal(drift, 0.01, n))), index=idx)


def test_no_mira_el_futuro():
    vistos = []

    def espia(precios, plazo_dias):
        vistos.append(precios.index[-1])
        return {"rendimiento_esperado": 0.02, "volatilidad": 0.04, "prob_perdida": 0.3, "intervalo": (-0.04, 0.09)}

    df = run(_serie(), "SPY", plazo_dias=30, anios=3, predict=espia)
    assert [pd.Timestamp(f) for f in df["fecha"]] == vistos


def test_ventanas_no_se_enciman():
    df = run(_serie(), "SPY", plazo_dias=30, anios=3)
    gaps = pd.Series(pd.to_datetime(df["fecha"])).diff().dropna().dt.days
    assert (gaps >= 28).all()


def test_si_siempre_invierte_es_igual_al_benchmark():
    siempre = lambda p, h: {"rendimiento_esperado": 0.02, "volatilidad": 0.04,
                            "prob_perdida": 0.3, "intervalo": (-0.04, 0.09)}
    r = resumen(run(_serie(), "SPY", plazo_dias=30, anios=3, predict=siempre, params={"freno_tendencia": 1.0}))
    assert r["exposicion_media"] == 1.0
    assert abs(r["pnl_app"] - r["pnl_siempre"]) < 1e-9
    assert abs(r["pnl_misma_exposicion"] - r["pnl_siempre"]) < 1e-9


def test_si_nunca_invierte_pnl_cero():
    nunca = lambda p, h: {"rendimiento_esperado": -0.01, "volatilidad": 0.04,
                          "prob_perdida": 0.6, "intervalo": (-0.08, 0.06)}
    r = resumen(run(_serie(), "SPY", plazo_dias=30, anios=3, predict=nunca))
    assert r["exposicion_media"] == 0.0 and r["pnl_app"] == 0.0


def test_monto_parcial_cobra_la_fraccion():
    riesgosa = lambda p, h: {"rendimiento_esperado": 0.03, "volatilidad": 0.15,
                             "prob_perdida": 0.42, "intervalo": (-0.20, 0.28)}
    df = run(_serie(), "SPY", plazo_dias=30, anios=3, predict=riesgosa, params={"freno_tendencia": 1.0})
    assert (df["fraccion"] == 0.5).all()
    assert ((df["pnl_app"] - 0.5 * df["pnl_siempre"]).abs() < 1e-9).all()


def test_desde_hasta_cortan_el_periodo():
    df = run(_serie(), "SPY", plazo_dias=30, anios=10, desde="2022-01-01", hasta="2023-12-31")
    fechas = pd.to_datetime(df["fecha"])
    assert fechas.min() >= pd.Timestamp("2022-01-01")
    assert pd.to_datetime(df["salida"]).max() <= pd.Timestamp("2023-12-31")


def test_entra_despues_de_decidir():
    df = run(_serie(), "SPY", plazo_dias=30, anios=3)
    assert (pd.to_datetime(df["entrada"]) > pd.to_datetime(df["fecha"])).all()


def test_ventana_es_la_misma_para_todos_los_activos():
    acciones = _serie()
    idx = pd.date_range(end="2026-10-24", periods=2600, freq="D")
    cripto = pd.Series(np.linspace(100, 200, len(idx)), index=idx)
    a = run(acciones, "SPY", plazo_dias=30, desde="2024-01-06")
    b = run(cripto, "BTCUSDT", plazo_dias=30, desde="2024-01-06", es_cripto=True)
    comunes = set(a["ventana"]) & set(b["ventana"])
    assert len(comunes) >= min(len(a), len(b)) - 1
