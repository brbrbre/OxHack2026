"""Decision rule: turns the model's forecast into INVERTIR, ESPERAR or NO_POR_AHORA.

Input: the output of model.predict() (see model/README.md), the amount, the
horizon and the date. Output: the decision, its reasons and recommendations.
Texts are in English for the user; decision and profile codes stay as they are.

Usage:
    from decision.rules import decide
    r = decide(pred, monto=1000, plazo_dias=30, simbolo="SPY")

Demo with example forecasts (not from the model):
    python -m decision.rules

The thresholds below were chosen with the calibration backtest
(following the app vs always investing on day one) and are set here.
"""

from __future__ import annotations

import sys
from datetime import date

from decision import events

INVERTIR = "INVERTIR"
ESPERAR = "ESPERAR"
NO_POR_AHORA = "NO_POR_AHORA"

# --- Parameters ----------------------------------------------------------------
# The rule sizes the amount instead of blocking it: investing is the default and
# risk decides HOW MUCH. Basis: Vanguard 2023 (a lump sum beats phasing in
# 68% of the time), Harvey et al. 2018 (sizing by volatility makes extreme
# losses less severe) and the 1-12 month trend evidence (Moskowitz, Ooi and
# Pedersen 2012).

# Loss each profile accepts in the bad case over the horizon (5th percentile).
# The person chooses it; it is not calibrated.
PEOR_CASO_ACEPTABLE = {"conservador": 0.05, "moderado": 0.10, "agresivo": 0.20}

# What is calibrated, on 2016-2021 (see decision/calibrate.py). Values chosen on
# 24 Oct 2026: setting [0] won among 6 settings.
PARAMS = {
    # If True, don't invest when the model expects a return <= 0 or a
    # chance of loss >= 50%. This is where a good model adds value.
    "exigir_expectativa_positiva": True,
    # Scales the share down when the price is below its level 12 months ago.
    # 1.0 = off: the brake did not improve the training Sharpe.
    "freno_tendencia": 1.0,
    # Scales the share down if a rate decision is due in the next few days.
    # Cannot be calibrated: the calendar starts in October 2026.
    "freno_evento": 0.5,
    # Below this share, the answer is ESPERAR instead of INVERTIR.
    "umbral_invertir": 0.5,
}
DIAS_ANTES_DE_EVENTO = 3
# Volatility over the horizon above which phasing in is suggested.
VOLATILIDAD_ALTA = 0.08


def _pct(x: float) -> str:
    return f"{x * 100:+.1f}%"


def _dinero(x: float) -> str:
    return f"-${-x:,.0f}" if x < 0 else f"${x:,.0f}"


PERFIL_EN = {"conservador": "conservative", "moderado": "moderate", "agresivo": "aggressive"}


def fraccion_por_riesgo(bajo: float, tolerancia: float) -> float:
    """Share of the amount for which the bad case stays within the tolerance.

    It is a VaR-style risk budget at 95%: the low end of the 90% interval
    is the 5th percentile.
    """
    if bajo >= 0:
        return 1.0
    return min(1.0, tolerancia / -bajo)


def decide(pred: dict, monto: float, plazo_dias: int, simbolo: str,
           hoy: date | None = None, perfil: str = "moderado",
           tendencia: float | None = None, params: dict | None = None) -> dict:
    """Decides with fixed, explainable rules. No LLM is involved.

    tendencia: return over the last 12 months (decision.signals.tendencia).
    """
    p = {**PARAMS, **(params or {})}
    hoy = hoy or date.today()
    mu = float(pred["rendimiento_esperado"])
    sigma = float(pred["volatilidad"])
    p_perdida = float(pred["prob_perdida"])
    bajo, alto = (float(v) for v in pred["intervalo"])
    tolerancia = PEOR_CASO_ACEPTABLE[perfil]
    proximos = events.upcoming(simbolo, hoy, DIAS_ANTES_DE_EVENTO)

    razones: list[str] = [
        f"Over {plazo_dias} days the model expects {_pct(mu)}, with a {p_perdida:.0%} chance of loss.",
        f"Likely range: {_dinero(monto * bajo)} to {_dinero(monto * alto)} on {_dinero(monto)}.",
    ]
    recomendaciones: list[str] = []

    # 1. Expectativa negativa: no entrar.
    if p["exigir_expectativa_positiva"] and (mu <= 0 or p_perdida >= 0.5):
        fraccion = 0.0
        razones.append("The model sees a higher chance of losing than gaining over this period.")
        recomendaciones.append("Check again in a few days, or try a longer period.")
    else:
        # 2. Size by risk: how much the profile can take in the bad case.
        fraccion = fraccion_por_riesgo(bajo, tolerancia)
        if fraccion < 1:
            razones.append(
                f"In a bad scenario the full amount could lose {_dinero(-monto * bajo)} ({_pct(bajo)}); "
                f"your {PERFIL_EN[perfil]} profile accepts up to {tolerancia:.0%}."
            )
        else:
            razones.append(f"Even in a bad scenario the loss stays within your {PERFIL_EN[perfil]} profile.")

        # 3. Trend brake: price below its level 12 months ago.
        if tendencia is not None and tendencia < 0 and p["freno_tendencia"] < 1:
            fraccion *= p["freno_tendencia"]
            razones.append(f"The price is {_pct(tendencia)} versus 12 months ago: the trend is down.")
            recomendaciones.append("Invest the rest in parts if the trend turns up.")

        # 4. Event brake: a rate decision in the next few days.
        if proximos and p["freno_evento"] < 1:
            e = proximos[0]
            fraccion *= p["freno_evento"]
            razones.append(f"{e['name']} on {e['date']:%d %b}. Prices often move more on that day.")
            recomendaciones.append(f"Invest the rest after {e['date']:%d %b}.")

    monto_sugerido = monto * fraccion
    if fraccion <= 0:
        decision = NO_POR_AHORA
    elif fraccion >= p["umbral_invertir"]:
        decision = INVERTIR
    else:
        decision = ESPERAR

    if 0 < fraccion < 1:
        recomendaciones.insert(0, f"Invest about {_dinero(monto_sugerido)} of your {_dinero(monto)} now.")
    if decision != NO_POR_AHORA and sigma >= VOLATILIDAD_ALTA:
        recomendaciones.append("The price moves a lot: consider investing in 3 parts, one per week.")

    return {
        "decision": decision,
        "razones": razones,
        "recomendaciones": recomendaciones,
        "numeros": {
            "simbolo": simbolo,
            "monto": monto,
            "plazo_dias": plazo_dias,
            "perfil": perfil,
            "rendimiento_esperado": mu,
            "volatilidad": sigma,
            "prob_perdida": p_perdida,
            "senal": mu / sigma if sigma > 0 else 0.0,
            "peor_caso": monto * bajo,
            "mejor_caso": monto * alto,
            "fraccion": fraccion,
            "monto_sugerido": monto_sugerido,
            "tendencia_12m": tendencia,
            "eventos": [f"{e['name']} ({e['date']})" for e in proximos],
        },
    }


EJEMPLOS = [
    ("SPY, good signal", "SPY", date(2026, 11, 2),
     {"rendimiento_esperado": 0.02, "volatilidad": 0.04, "prob_perdida": 0.31, "intervalo": (-0.045, 0.085)}),
    ("SPY, before the Fed", "SPY", date(2026, 10, 26),
     {"rendimiento_esperado": 0.02, "volatilidad": 0.04, "prob_perdida": 0.31, "intervalo": (-0.045, 0.085)}),
    ("BTC, high risk", "BTCUSDT", date(2026, 11, 2),
     {"rendimiento_esperado": 0.03, "volatilidad": 0.15, "prob_perdida": 0.42, "intervalo": (-0.22, 0.28)}),
    ("WALMEX, negative expectation", "WALMEX.MX", date(2026, 11, 2),
     {"rendimiento_esperado": -0.01, "volatilidad": 0.05, "prob_perdida": 0.58, "intervalo": (-0.09, 0.07)}),
]


def main() -> int:
    print("EXAMPLE forecasts, not from the model. Amount $1,000, horizon 30 days, moderate profile.\n")
    for titulo, simbolo, hoy, pred in EJEMPLOS:
        r = decide(pred, monto=1000, plazo_dias=30, simbolo=simbolo, hoy=hoy)
        print(f"== {titulo} (today {hoy}) -> {r['decision']}")
        for x in r["razones"]:
            print(f"   reason: {x}")
        for x in r["recomendaciones"]:
            print(f"   recommendation: {x}")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
