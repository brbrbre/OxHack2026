"""Predicción baseline: promedio y volatilidad históricos, sin modelo.

Dos usos:
1. El API la usa mientras no exista model/predict.py.
2. Es la referencia contra la que se compara el modelo de Felipe y Brisma.

Supone rendimientos diarios log-normales e independientes, estimados con los
últimos 3 años. Devuelve el mismo contrato que model.predict().
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

NOMBRE = "baseline"
VENTANA_DIAS = 756  # unos 3 años de sesiones de bolsa
Z_90 = 1.6449       # intervalo central del 90 %


def sesiones(plazo_dias: int, es_cripto: bool) -> float:
    """Convierte días de calendario en días de mercado."""
    return float(plazo_dias) if es_cripto else plazo_dias * 252 / 365


def _normal_cdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def predict(precios: pd.Series, plazo_dias: int, es_cripto: bool = False) -> dict:
    log_ret = np.log(precios.astype(float)).diff().dropna().tail(VENTANA_DIAS)
    if len(log_ret) < 30:
        raise ValueError("Hacen falta al menos 30 días de precios.")
    h = sesiones(plazo_dias, es_cripto)
    mu = float(log_ret.mean()) * h
    sigma = float(log_ret.std(ddof=1)) * math.sqrt(h)
    return {
        "rendimiento_esperado": math.exp(mu + sigma ** 2 / 2) - 1,
        "volatilidad": sigma,
        "prob_perdida": _normal_cdf(-mu / sigma) if sigma > 0 else float(mu < 0),
        "intervalo": (math.exp(mu - Z_90 * sigma) - 1, math.exp(mu + Z_90 * sigma) - 1),
    }
