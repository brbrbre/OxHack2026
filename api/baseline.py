"""Baseline forecast: historical mean and volatility, no model.

Two uses:
1. The API falls back to it if model/predict.py can't load.
2. It is the yardstick Trend + TDA and XGBoost are compared against.

Assumes independent log-normal daily returns, estimated on the last 3 years.
Returns the same contract as model.predict().
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

NOMBRE = "baseline"
VENTANA_DIAS = 756  # about 3 years of trading sessions
Z_90 = 1.6449       # intervalo central del 90 %


def sesiones(plazo_dias: int, es_cripto: bool) -> float:
    """Converts calendar days into market days."""
    return float(plazo_dias) if es_cripto else plazo_dias * 252 / 365


def _normal_cdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def predict(precios: pd.Series, plazo_dias: int, es_cripto: bool = False) -> dict:
    log_ret = np.log(precios.astype(float)).diff().dropna().tail(VENTANA_DIAS)
    if len(log_ret) < 30:
        raise ValueError("At least 30 days of prices are needed.")
    h = sesiones(plazo_dias, es_cripto)
    mu = float(log_ret.mean()) * h
    sigma = float(log_ret.std(ddof=1)) * math.sqrt(h)
    return {
        "rendimiento_esperado": math.exp(mu + sigma ** 2 / 2) - 1,
        "volatilidad": sigma,
        "prob_perdida": _normal_cdf(-mu / sigma) if sigma > 0 else float(mu < 0),
        "intervalo": (math.exp(mu - Z_90 * sigma) - 1, math.exp(mu + Z_90 * sigma) - 1),
    }
