"""Pruebas de la regla de decisión. No usan internet ni el modelo real."""

from datetime import date

from decision import events
from decision.rules import ESPERAR, INVERTIR, NO_POR_AHORA, decide

BUENA = {"rendimiento_esperado": 0.02, "volatilidad": 0.04, "prob_perdida": 0.31, "intervalo": (-0.045, 0.085)}
NOVIEMBRE = date(2026, 11, 2)  # sin eventos en los 3 días siguientes


def test_senal_buena_invierte():
    r = decide(BUENA, 1000, 30, "SPY", hoy=NOVIEMBRE)
    assert r["decision"] == INVERTIR


def test_expectativa_negativa_no_por_ahora():
    pred = dict(BUENA, rendimiento_esperado=-0.01, prob_perdida=0.58)
    assert decide(pred, 1000, 30, "SPY", hoy=NOVIEMBRE)["decision"] == NO_POR_AHORA


def test_fed_en_dos_dias_espera():
    r = decide(BUENA, 1000, 30, "SPY", hoy=date(2026, 10, 26))
    assert r["decision"] == ESPERAR
    assert "Fed" in " ".join(r["razones"])


def test_boe_solo_afecta_a_lo_britanico():
    hoy = date(2026, 11, 3)  # BoE el 5 nov; ninguna Fed cerca
    assert decide(BUENA, 1000, 30, "VOD.L", hoy=hoy)["decision"] == ESPERAR
    assert decide(BUENA, 1000, 30, "WALMEX.MX", hoy=hoy)["decision"] == INVERTIR


def test_peor_caso_alto_sugiere_monto_menor():
    pred = {"rendimiento_esperado": 0.03, "volatilidad": 0.15, "prob_perdida": 0.42, "intervalo": (-0.22, 0.28)}
    r = decide(pred, 1000, 30, "BTCUSDT", hoy=NOVIEMBRE)
    assert r["decision"] == ESPERAR
    assert any("about $455" in x for x in r["recomendaciones"])


def test_perfil_agresivo_acepta_mas_riesgo():
    pred = {"rendimiento_esperado": 0.05, "volatilidad": 0.12, "prob_perdida": 0.35, "intervalo": (-0.15, 0.25)}
    assert decide(pred, 1000, 30, "BTCUSDT", hoy=NOVIEMBRE, perfil="moderado")["decision"] == ESPERAR
    assert decide(pred, 1000, 30, "BTCUSDT", hoy=NOVIEMBRE, perfil="agresivo")["decision"] == INVERTIR


def test_regiones():
    assert events.regions_for("VOD.L") == {"US", "UK"}
    assert events.regions_for("WALMEX.MX") == {"US"}
