"""Plan over the assets the person picked; the automatic plan is unchanged.

The model, the correlation filter and the risk control stay in decision.plan.
Server dependencies are passed in to avoid import cycles.
"""

from __future__ import annotations

from datetime import date
from typing import Callable, Literal

import pandas as pd
from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

from decision.plan import plan


class SelectedPlanRequest(BaseModel):
    simbolos: list[str] = Field(min_length=1)
    monto: float = Field(gt=0, le=1e9)
    plazo_dias: int = Field(ge=1, le=730)
    perfil: Literal["conservador", "moderado", "agresivo"] = "moderado"

    @field_validator("simbolos")
    @classmethod
    def unique_symbols(cls, symbols: list[str]) -> list[str]:
        if len(symbols) != len(set(symbols)):
            raise ValueError("Selected assets must be unique")
        return symbols


def build_selected_plan(
    req: SelectedPlanRequest,
    *,
    catalog: dict[str, dict[str, str]],
    get_close: Callable[[str], pd.Series],
    run_prediction: Callable[[pd.Series, int, str], tuple[dict, str]],
    load_model: Callable[[], tuple[object, str]],
    notice: str,
    hoy: date | None = None,
) -> dict:
    known = {symbol for group in catalog.values() for symbol in group}
    # Validate the entire selection before loading prices or calling any model.
    for symbol in req.simbolos:
        if symbol not in known:
            raise HTTPException(404, f"Unknown asset: {symbol}")

    selected = set(req.simbolos)
    groups = {group: [symbol for symbol in assets if symbol in selected]
              for group, assets in catalog.items()}
    groups = {group: symbols for group, symbols in groups.items() if symbols}
    symbols = [symbol for group in groups.values() for symbol in group]
    prices = {symbol: get_close(symbol) for symbol in symbols}
    names = {symbol: name for group in catalog.values() for symbol, name in group.items() if symbol in selected}
    _, model_name = load_model()

    def predict(symbol: str, series: pd.Series) -> dict:
        return run_prediction(series, req.plazo_dias, symbol)[0]

    result = plan(req.monto, req.plazo_dias, req.perfil, groups, prices, names, predict,
                  hoy=hoy, tope_por_activo=1.0, respetar_fracciones=True)
    return {**result, "modelo": model_name, "aviso": notice}
