"""Señales que salen directo de los precios, sin modelo."""

from __future__ import annotations

from datetime import timedelta

import pandas as pd


def tendencia(precios: pd.Series, meses: int = 12) -> float | None:
    """Rendimiento de los últimos `meses` (días de calendario, sirve igual para cripto).

    Es la señal de precio con más evidencia a 1-12 meses (Moskowitz, Ooi y
    Pedersen 2012). La regla la usa como freno, no como predicción.
    """
    precios = precios.dropna()
    if precios.empty:
        return None
    hoy = precios.index[-1]
    atras = precios[precios.index <= hoy - timedelta(days=round(meses * 365 / 12))]
    if atras.empty:
        return None
    return float(precios.iloc[-1] / atras.iloc[-1] - 1)
