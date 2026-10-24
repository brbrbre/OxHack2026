"""Pruebas del evaluador de pronósticos. No usan internet."""

import pandas as pd

from decision.evaluate_forecasts import calibracion, metricas


def _df(real, prob, bajo=-0.1, alto=0.1, esperado=None):
    n = len(real)
    return pd.DataFrame({
        "real": real, "prob_perdida": prob, "p_ingenuo": [0.5] * n,
        "bajo": [bajo] * n, "alto": [alto] * n,
        "esperado": esperado if esperado is not None else real,
    })


def test_pronostico_perfecto():
    m = metricas(_df([0.05, -0.05, 0.02, -0.02], [0.0, 1.0, 0.0, 1.0]))
    assert m["brier"] == 0 and m["skill"] == 1 and m["ic_rango"] == 1
    assert m["cobertura_90"] == 1 and m["abajo_del_bajo"] == 0


def test_cobertura_cuenta_fuera_del_intervalo():
    m = metricas(_df([-0.2, 0.0, 0.0, 0.3], [0.5] * 4))
    assert m["cobertura_90"] == 0.5
    assert m["abajo_del_bajo"] == 0.25 and m["arriba_del_alto"] == 0.25


def test_skill_cero_si_iguala_al_ingenuo():
    m = metricas(_df([0.05, -0.05], [0.5, 0.5]))
    assert abs(m["skill"]) < 1e-12


def test_tabla_de_calibracion():
    cal = calibracion(_df([-0.1, 0.1, -0.1, 0.1], [0.45, 0.45, 0.55, 0.55]))
    assert list(cal["ventanas"]) == [2, 2]
    assert list(cal["pasó"]) == [0.5, 0.5]
