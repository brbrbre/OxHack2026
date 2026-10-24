"""Regla de decisión: convierte la predicción del modelo en INVERTIR, ESPERAR o NO_POR_AHORA.

Entrada: la salida de model.predict() (ver model/README.md), el monto, el
plazo y la fecha. Salida: la decisión, sus razones y recomendaciones.

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

# --- Umbrales iniciales (calibrar con el backtest) ---------------------------
# Señal mínima: rendimiento esperado entre volatilidad, en el plazo.
SENAL_MINIMA = 0.25
# Probabilidad de pérdida a partir de la cual no se recomienda entrar.
PROB_PERDIDA_MAXIMA = 0.45
# Pérdida en el peor escenario (extremo bajo del intervalo) que acepta cada perfil.
PEOR_CASO_ACEPTABLE = {"conservador": 0.05, "moderado": 0.10, "agresivo": 0.20}
# Días antes de una decisión de tasas en los que se sugiere esperar.
DIAS_ANTES_DE_EVENTO = 3
# Volatilidad del plazo a partir de la cual se sugiere entrar en partes.
VOLATILIDAD_ALTA = 0.08


def _pct(x: float) -> str:
    return f"{x * 100:+.1f} %"


def _dinero(x: float) -> str:
    return f"-${-x:,.0f}" if x < 0 else f"${x:,.0f}"


def decide(pred: dict, monto: float, plazo_dias: int, simbolo: str,
           hoy: date | None = None, perfil: str = "moderado") -> dict:
    """Decide con reglas fijas y explicables. No usa ningún LLM."""
    hoy = hoy or date.today()
    mu = float(pred["rendimiento_esperado"])
    sigma = float(pred["volatilidad"])
    p_perdida = float(pred["prob_perdida"])
    bajo, alto = (float(v) for v in pred["intervalo"])
    tolerancia = PEOR_CASO_ACEPTABLE[perfil]

    senal = mu / sigma if sigma > 0 else 0.0
    peor_caso = monto * bajo
    mejor_caso = monto * alto
    proximos = events.upcoming(simbolo, hoy, DIAS_ANTES_DE_EVENTO)

    razones: list[str] = []
    recomendaciones: list[str] = []

    razones.append(
        f"En {plazo_dias} días el modelo espera {_pct(mu)}, con una probabilidad de pérdida de {p_perdida:.0%}."
    )
    razones.append(
        f"Rango probable: de {_dinero(peor_caso)} a {_dinero(mejor_caso)} sobre {_dinero(monto)}."
    )

    # 1. Expectativa negativa: no entrar.
    if mu <= 0 or p_perdida >= 0.5:
        decision = NO_POR_AHORA
        razones.append("El modelo espera más probabilidad de perder que de ganar en este plazo.")
        recomendaciones.append("Vuelve a revisar en unos días o prueba un plazo más largo.")

    # 2. Decisión de tasas en los próximos días: esperar.
    elif proximos:
        e = proximos[0]
        decision = ESPERAR
        razones.append(
            f"{e['name']} el {e['date']:%d/%m}. Los precios suelen moverse más ese día."
        )
        recomendaciones.append(f"Revisa de nuevo después del {e['date']:%d/%m}.")

    # 3. Peor caso más grande de lo que acepta el perfil: esperar o invertir menos.
    elif -bajo > tolerancia:
        decision = ESPERAR
        razones.append(
            f"En el peor escenario perderías {_dinero(-peor_caso)} ({_pct(bajo)}); "
            f"tu perfil {perfil} acepta hasta {tolerancia:.0%}."
        )
        monto_seguro = monto * tolerancia / -bajo
        recomendaciones.append(
            f"Si quieres entrar ya, invierte cerca de {_dinero(monto_seguro)} en lugar de {_dinero(monto)}."
        )

    # 4. Señal clara y riesgo aceptable: invertir.
    elif senal >= SENAL_MINIMA and p_perdida < PROB_PERDIDA_MAXIMA:
        decision = INVERTIR
        razones.append("La ganancia esperada compensa el riesgo para tu perfil.")

    # 5. Señal débil: esperar.
    else:
        decision = ESPERAR
        razones.append("La ganancia esperada es pequeña comparada con cuánto se mueve el precio.")
        recomendaciones.append("Espera una señal más clara o elige un plazo más largo.")

    if decision != NO_POR_AHORA and sigma >= VOLATILIDAD_ALTA:
        recomendaciones.append("El precio se mueve mucho: considera entrar en 3 partes, una por semana.")

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
            "senal": senal,
            "peor_caso": peor_caso,
            "mejor_caso": mejor_caso,
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
