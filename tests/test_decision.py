"""Pruebas de la regla de decisión. No usan internet ni el modelo real."""

from datetime import date

import pandas as pd
import pytest

from decision import events
from decision.rules import ESPERAR, INVERTIR, NO_POR_AHORA, decide, fraccion_por_riesgo
from decision.signals import tendencia

BUENA = {"rendimiento_esperado": 0.02, "volatilidad": 0.04, "prob_perdida": 0.31, "intervalo": (-0.045, 0.085)}
RIESGOSA = {"rendimiento_esperado": 0.03, "volatilidad": 0.15, "prob_perdida": 0.42, "intervalo": (-0.22, 0.28)}
NOVIEMBRE = date(2026, 11, 2)  # sin eventos en los 3 días siguientes


def frac(r):
    return r["numeros"]["fraccion"]


def test_senal_buena_invierte_todo():
    r = decide(BUENA, 1000, 30, "SPY", hoy=NOVIEMBRE)
    assert r["decision"] == INVERTIR and frac(r) == 1.0


def test_expectativa_negativa_no_por_ahora():
    pred = dict(BUENA, rendimiento_esperado=-0.01, prob_perdida=0.58)
    r = decide(pred, 1000, 30, "SPY", hoy=NOVIEMBRE)
    assert r["decision"] == NO_POR_AHORA and frac(r) == 0.0


def test_sin_exigir_expectativa_solo_dimensiona():
    pred = dict(BUENA, rendimiento_esperado=-0.01, prob_perdida=0.58)
    r = decide(pred, 1000, 30, "SPY", hoy=NOVIEMBRE, params={"exigir_expectativa_positiva": False})
    assert frac(r) == 1.0


def test_riesgo_alto_reduce_el_monto():
    r = decide(RIESGOSA, 1000, 30, "BTCUSDT", hoy=NOVIEMBRE)
    assert frac(r) == pytest.approx(0.10 / 0.22)
    assert r["decision"] == ESPERAR
    assert r["recomendaciones"][0] == "Invest about $455 of your $1,000 now."


def test_perfil_cambia_el_monto():
    m = decide(RIESGOSA, 1000, 30, "BTCUSDT", hoy=NOVIEMBRE, perfil="moderado")
    a = decide(RIESGOSA, 1000, 30, "BTCUSDT", hoy=NOVIEMBRE, perfil="agresivo")
    c = decide(RIESGOSA, 1000, 30, "BTCUSDT", hoy=NOVIEMBRE, perfil="conservador")
    assert frac(c) < frac(m) < frac(a) < 1


def test_fed_en_dos_dias_reduce_a_la_mitad():
    r = decide(BUENA, 1000, 30, "SPY", hoy=date(2026, 10, 26))
    assert frac(r) == 0.5
    assert any("Fed" in x for x in r["razones"])
    assert "Invest the rest after 28 Oct." in r["recomendaciones"]


def test_boe_solo_afecta_a_lo_britanico():
    hoy = date(2026, 11, 3)  # BoE el 5 nov; ninguna Fed cerca
    assert frac(decide(BUENA, 1000, 30, "VOD.L", hoy=hoy)) == 0.5
    assert frac(decide(BUENA, 1000, 30, "WALMEX.MX", hoy=hoy)) == 1.0


def test_tendencia_negativa_frena():
    r = decide(BUENA, 1000, 30, "SPY", hoy=NOVIEMBRE, tendencia=-0.12, params={"freno_tendencia": 0.5})
    assert frac(r) == 0.5
    sin_freno = decide(BUENA, 1000, 30, "SPY", hoy=NOVIEMBRE, tendencia=-0.12, params={"freno_tendencia": 1.0})
    assert frac(sin_freno) == 1.0


def test_fraccion_por_riesgo():
    assert fraccion_por_riesgo(0.01, 0.10) == 1.0
    assert fraccion_por_riesgo(-0.05, 0.10) == 1.0
    assert fraccion_por_riesgo(-0.20, 0.10) == 0.5


def test_tendencia_12_meses():
    idx = pd.date_range("2025-01-01", "2026-03-01", freq="D")
    s = pd.Series(range(1, len(idx) + 1), index=idx, dtype=float)
    t = tendencia(s)
    assert t is not None and t > 0
    assert tendencia(s.iloc[:100]) is None


def test_regiones():
    assert events.regions_for("VOD.L") == {"US", "UK"}
    assert events.regions_for("WALMEX.MX") == {"US"}
