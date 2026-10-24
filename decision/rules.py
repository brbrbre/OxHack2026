"""Regla de decisión: convierte la predicción del modelo en INVERTIR, ESPERAR o NO_POR_AHORA.

Entrada: la salida de model.predict() (ver model/README.md), el monto, el
plazo y la fecha. Salida: la decisión, sus razones y recomendaciones.
Los textos van en inglés porque los ve el jurado; los códigos de decisión y perfil no cambian.

Uso:
    from decision.rules import decide
    r = decide(pred, monto=1000, plazo_dias=30, simbolo="SPY")

Demo con predicciones de ejemplo (no son del modelo):
    python -m decision.rules

Los umbrales de abajo son valores iniciales. Se calibran con el backtest
(seguir la app contra invertir siempre el primer día) y se ajustan aquí.
"""

from __future__ import annotations

import sys
from datetime import date

from decision import events

INVERTIR = "INVERTIR"
ESPERAR = "ESPERAR"
NO_POR_AHORA = "NO_POR_AHORA"

# --- Parámetros ----------------------------------------------------------------
# La regla dimensiona el monto en lugar de bloquearlo: invertir es lo normal y el
# riesgo decide CUÁNTO. Base: Vanguard 2023 (invertir de una vez gana a entrar
# en partes 68% del tiempo), Harvey et al. 2018 (dimensionar por volatilidad
# baja las caídas) y la evidencia de tendencia a 1-12 meses (Moskowitz, Ooi y
# Pedersen 2012). Detalle en reports/ de la carpeta del equipo.

# Pérdida que acepta cada perfil en el peor escenario del plazo (percentil 5).
# La define la persona, no se calibra.
PEOR_CASO_ACEPTABLE = {"conservador": 0.05, "moderado": 0.10, "agresivo": 0.20}

# Lo que sí se calibra, con 2016-2021 (ver decision/calibrate.py). Valores
# elegidos el 24 oct 2026 con el baseline: entre 6 configuraciones ganó la [0].
PARAMS = {
    # Si True, no se invierte cuando el modelo espera rendimiento <= 0 o
    # probabilidad de pérdida >= 50 %. Aquí es donde un buen modelo agrega valor.
    "exigir_expectativa_positiva": True,
    # Multiplica la fracción cuando el precio está abajo de hace 12 meses.
    # 1.0 = apagado: el freno no mejoró el Sharpe de entrenamiento.
    "freno_tendencia": 1.0,
    # Multiplica la fracción si hay decisión de tasas en los próximos días.
    # No se puede calibrar: el calendario empieza en oct 2026.
    "freno_evento": 0.5,
    # Debajo de esta fracción, la respuesta es ESPERAR en lugar de INVERTIR.
    "umbral_invertir": 0.5,
}
DIAS_ANTES_DE_EVENTO = 3
# Volatilidad del plazo a partir de la cual se sugiere entrar en partes.
VOLATILIDAD_ALTA = 0.08


def _pct(x: float) -> str:
    return f"{x * 100:+.1f}%"


def _dinero(x: float) -> str:
    return f"-${-x:,.0f}" if x < 0 else f"${x:,.0f}"


PERFIL_EN = {"conservador": "conservative", "moderado": "moderate", "agresivo": "aggressive"}


def fraccion_por_riesgo(bajo: float, tolerancia: float) -> float:
    """Parte del monto con la que el peor escenario no pasa de la tolerancia.

    Es un presupuesto de riesgo tipo VaR al 95 %: el extremo bajo del
    intervalo del 90 % es el percentil 5.
    """
    if bajo >= 0:
        return 1.0
    return min(1.0, tolerancia / -bajo)


def decide(pred: dict, monto: float, plazo_dias: int, simbolo: str,
           hoy: date | None = None, perfil: str = "moderado",
           tendencia: float | None = None, params: dict | None = None) -> dict:
    """Decide con reglas fijas y explicables. No usa ningún LLM.

    tendencia: rendimiento de los últimos 12 meses (decision.signals.tendencia).
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
        # 2. Tamaño por riesgo: cuánto aguanta el perfil en el peor escenario.
        fraccion = fraccion_por_riesgo(bajo, tolerancia)
        if fraccion < 1:
            razones.append(
                f"In a bad scenario the full amount could lose {_dinero(-monto * bajo)} ({_pct(bajo)}); "
                f"your {PERFIL_EN[perfil]} profile accepts up to {tolerancia:.0%}."
            )
        else:
            razones.append(f"Even in a bad scenario the loss stays within your {PERFIL_EN[perfil]} profile.")

        # 3. Freno de tendencia: precio abajo de hace 12 meses.
        if tendencia is not None and tendencia < 0 and p["freno_tendencia"] < 1:
            fraccion *= p["freno_tendencia"]
            razones.append(f"The price is {_pct(tendencia)} versus 12 months ago: the trend is down.")
            recomendaciones.append("Invest the rest in parts if the trend turns up.")

        # 4. Freno de evento: decisión de tasas en los próximos días.
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
    ("SPY, señal buena", "SPY", date(2026, 11, 2),
     {"rendimiento_esperado": 0.02, "volatilidad": 0.04, "prob_perdida": 0.31, "intervalo": (-0.045, 0.085)}),
    ("SPY, antes de la Fed", "SPY", date(2026, 10, 26),
     {"rendimiento_esperado": 0.02, "volatilidad": 0.04, "prob_perdida": 0.31, "intervalo": (-0.045, 0.085)}),
    ("BTC, mucho riesgo", "BTCUSDT", date(2026, 11, 2),
     {"rendimiento_esperado": 0.03, "volatilidad": 0.15, "prob_perdida": 0.42, "intervalo": (-0.22, 0.28)}),
    ("WALMEX, expectativa negativa", "WALMEX.MX", date(2026, 11, 2),
     {"rendimiento_esperado": -0.01, "volatilidad": 0.05, "prob_perdida": 0.58, "intervalo": (-0.09, 0.07)}),
]


def main() -> int:
    print("Predicciones de EJEMPLO, no del modelo. Monto $1,000, plazo 30 días, perfil moderado.\n")
    for titulo, simbolo, hoy, pred in EJEMPLOS:
        r = decide(pred, monto=1000, plazo_dias=30, simbolo=simbolo, hoy=hoy)
        print(f"== {titulo} (hoy {hoy}) -> {r['decision']}")
        for x in r["razones"]:
            print(f"   razón: {x}")
        for x in r["recomendaciones"]:
            print(f"   recomendación: {x}")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
