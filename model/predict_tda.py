"""Trend + topology (TDA) forecast with real (empirical) tails, ready for the API.

The model is trained in model/modelo_regresion_tda.ipynb, which saves its parameters
to model/params_tda.json. This module only computes what is needed for the last day:

- Trend: average of the 21, 63, 126 and 252-day momentum, scaled by EWMA σ.
- TDA: L2 norm of the H0 persistence (minimum spanning tree edges) of the Takens
  embedding of the last 63 returns, relative to its 252-day median. The 252 point
  clouds are solved at once with a vectorised Prim, instead of walking the whole history.
- Risk: EWMA σ with empirical quantiles of the historical errors (not the normal).

Same contract as api/baseline.py: plazo_dias in calendar days and simple returns
(0.012 = +1.2 %), because decision/ multiplies the amount by the interval.
"""

from __future__ import annotations

import json
import math
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

NOMBRE = "tendencia-tda"
# Para medir sin ver el futuro: TDA_PARAMS=model/params_tda_hasta_2021.json (entrenado solo hasta nov 2021).
PARAMS = Path(os.getenv("TDA_PARAMS") or Path(__file__).with_name("params_tda.json"))
MOMENTUM = (21, 63, 126, 252)
MEDIAN_WINDOW = 252


@lru_cache(maxsize=1)
def _params() -> dict:
    p = json.loads(PARAMS.read_text())
    p["coef"] = np.array(p["coef"])
    p["quantiles"] = np.array(p["quantiles"])
    p["probs"] = (np.arange(len(p["quantiles"])) + 0.5) / len(p["quantiles"])
    return p


def sessions(plazo_dias: int, es_cripto: bool) -> float:
    """Converts calendar days into market days."""
    return float(plazo_dias) if es_cripto else plazo_dias * 252 / 365


def _ewma_vol(r: pd.Series, lam: float) -> pd.Series:
    return np.sqrt(r.pow(2).ewm(alpha=1 - lam, adjust=False, min_periods=30).mean())


def _h0_norms(clouds: np.ndarray) -> np.ndarray:
    """L2 norm of the H0 diagram of each cloud (batch, points, dim), with a vectorised Prim."""
    b, n, _ = clouds.shape
    D = np.sqrt(((clouds[:, :, None, :] - clouds[:, None, :, :]) ** 2).sum(-1))
    rows = np.arange(b)
    inside = np.zeros((b, n), bool); inside[:, 0] = True
    dist = D[:, 0].copy(); dist[:, 0] = np.inf
    total = np.zeros(b)
    for _ in range(n - 1):
        j = np.argmin(dist, axis=1)
        total += dist[rows, j] ** 2
        inside[rows, j] = True
        dist = np.minimum(dist, D[rows, j]); dist[inside] = np.inf
    return np.sqrt(total)


def signals_today(prices: pd.Series, lam: float, window: int, dim: int) -> tuple[float, float, float]:
    """(s, tda, daily σ) for the last day, identical to the last row of build() in the notebook."""
    c = prices.dropna().astype(float); c = c[c > 0]
    r = np.log(c).diff().dropna()
    if len(r) < max(MOMENTUM) + window + 126:
        raise ValueError(f"Need at least {max(MOMENTUM) + window + 127} days of prices.")
    v = _ewma_vol(r, lam)
    sd = float(v.iloc[-1])
    s = float(np.mean([np.clip(r.iloc[-k:].sum() / (sd * math.sqrt(k)), -5, 5) for k in MOMENTUM]))

    u = (r / v).dropna().to_numpy()
    m = min(MEDIAN_WINDOW, len(u) - window + 1)
    ends = np.arange(len(u) - m + 1, len(u) + 1)                  # each window is u[end-window:end]
    pos = (ends - window)[:, None] + np.arange(window - dim + 1)[None, :]
    clouds = np.stack([u[pos + k] for k in range(dim)], axis=-1)  # (m, window-dim+1, dim)
    norms = _h0_norms(clouds)
    tda = float(np.clip(np.log(norms[-1] / np.median(norms)), -3, 3))
    return s, tda, sd


def predict(precios: pd.Series, plazo_dias: int, es_cripto: bool = False) -> dict:
    p = _params()
    s, tda, sd = signals_today(precios, p["lambda"], p["tda_window"], p["tda_dim"])
    t = math.tanh(s)
    z = float(p["coef"] @ np.array([1.0, t, t * tda, tda]))
    h = sessions(plazo_dias, es_cripto)
    sigma = sd * math.sqrt(h)
    mu = z * sd * math.sqrt(p["H"]) * (h / p["H"])                 # expected log return over the horizon
    scenarios = mu + sigma * p["quantiles"]                         # empirical distribution of the log return
    q = lambda prob: float(np.interp(prob, p["probs"], p["quantiles"]))
    return {
        "rendimiento_esperado": float(np.mean(np.expm1(scenarios))),
        "volatilidad": sigma,
        "prob_perdida": float(np.interp(-mu / sigma, p["quantiles"], p["probs"], left=0.0, right=1.0)),
        "intervalo": (math.expm1(mu + q(0.05) * sigma), math.expm1(mu + q(0.95) * sigma)),
    }
