"""Signals that come straight from prices, without a model."""

from __future__ import annotations

from datetime import timedelta

import pandas as pd


def tendencia(precios: pd.Series, meses: int = 12) -> float | None:
    """Return over the last `meses` months (calendar days, so it works for crypto too).

    It is the price signal with the most evidence at 1-12 months (Moskowitz, Ooi
    and Pedersen 2012). The rule uses it as a brake, not as a forecast.
    """
    precios = precios.dropna()
    if precios.empty:
        return None
    hoy = precios.index[-1]
    atras = precios[precios.index <= hoy - timedelta(days=round(meses * 365 / 12))]
    if atras.empty:
        return None
    return float(precios.iloc[-1] / atras.iloc[-1] - 1)
