""""Help me choose": an investment plan for people who don't know what to buy.

The person gives an amount, a risk profile, a horizon and the asset types they
like. The plan:
1. Runs the decision rule on every asset of those types and splits them into
   invest / wait / not now, each with its reason.
2. Builds a portfolio of up to MAX_ACTIVOS investable assets: one per type in
   turn (to diversify) and, within each type, the strongest model signal first.
   It skips any asset that nearly copies one already chosen.
3. Gives more weight to what moves less (weight ∝ 1 / volatility), never more
   than TOPE_POR_ACTIVO in one asset.
4. Scales the invested part so the whole portfolio's bad case (5th percentile,
   with the last 3 years of correlations) stays within the profile's tolerance.
   The rest stays in cash, and the plan says so.

No LLM is involved: Gemini only writes the summary.
"""

from __future__ import annotations

import math
from datetime import date

import numpy as np
import pandas as pd

from decision.rules import ESPERAR, INVERTIR, NO_POR_AHORA, PEOR_CASO_ACEPTABLE, decide
from decision.signals import tendencia

MAX_ACTIVOS = 5
TOPE_POR_ACTIVO = 0.40
# If a candidate moves almost like one already chosen (e.g. SPY and VOO, both
# track the S&P 500), it adds no diversification and is skipped.
CORRELACION_MAXIMA = 0.95
VENTANA_COV = 756   # about 3 years of sessions
Z_95 = 1.6449


def _razon_principal(r: dict) -> str:
    """The reason that explains the decision (the first two are always the numbers)."""
    extra = r["razones"][2:]
    return extra[-1] if extra else r["razones"][0]


def _pesos(seleccion: list[dict], *, tope_por_activo: float = TOPE_POR_ACTIVO) -> list[float]:
    """Weight ∝ 1/volatility, with a cap per asset.

    Water-filling: assets that hit the cap stay there, and the excess is shared
    among the others only. With the default cap, fewer than 3 assets can't
    reach 100%, and the rest stays in cash.
    """
    if not math.isfinite(tope_por_activo) or not 0 < tope_por_activo <= 1:
        raise ValueError("The asset weight limit must be greater than 0 and no more than 1.")
    inv = np.array([1 / max(s["volatilidad"], 1e-6) for s in seleccion])
    w = np.zeros(len(inv))
    fijos = np.zeros(len(inv), dtype=bool)
    resto = 1.0
    while True:
        libres = ~fijos
        if not libres.any() or resto <= 1e-12:
            break
        propuesta = resto * inv[libres] / inv[libres].sum()
        sobre = propuesta > tope_por_activo + 1e-12
        if not sobre.any():
            w[libres] = propuesta
            break
        idx = np.flatnonzero(libres)[sobre]
        w[idx] = tope_por_activo
        fijos[idx] = True
        resto = 1.0 - w[fijos].sum()
    return [float(x) for x in w]


def _correlacion(a: pd.Series, b: pd.Series) -> float:
    r = pd.concat([np.log(a.astype(float)).diff(), np.log(b.astype(float)).diff()], axis=1).dropna().tail(VENTANA_COV)
    return float(r.corr().iloc[0, 1]) if len(r) > 30 else 0.0


def riesgo_cartera(pesos: list[float], simbolos: list[str], precios: dict[str, pd.Series],
                   mus: list[float], plazo_dias: int) -> tuple[float, float, float]:
    """Expected return, volatility and bad case (5th percentile) of the portfolio over the horizon."""
    rets = pd.concat({s: np.log(precios[s].astype(float)).diff() for s in simbolos}, axis=1)
    rets = rets.dropna().tail(VENTANA_COV)  # days when every asset trades
    h = plazo_dias * 252 / 365
    cov = rets.cov().to_numpy() * h
    w = np.array(pesos)
    sigma = float(math.sqrt(max(w @ cov @ w, 0.0)))
    mu = float(np.dot(w, mus))
    return mu, sigma, mu - Z_95 * sigma


def plan(monto: float, plazo_dias: int, perfil: str, grupos: dict[str, list[str]],
         precios: dict[str, pd.Series], nombres: dict[str, str], predecir,
         hoy: date | None = None, *, tope_por_activo: float = TOPE_POR_ACTIVO,
         respetar_fracciones: bool = False) -> dict:
    """grupos: {"ETFs": ["SPY", ...], ...} with only the types the person chose.
    predecir(simbolo, precios) -> dict with the model.predict() contract.
    Defaults preserve the automatic plan's 40% cap and existing behavior. The
    separate selected-asset route requests a 100% cap and honors individual
    sizing fractions without changing eligibility, correlation or risk rules."""
    hoy = hoy or date.today()
    tol = PEOR_CASO_ACEPTABLE[perfil]
    filas = []
    for grupo, simbolos in grupos.items():
        for s in simbolos:
            pred = predecir(s, precios[s])
            r = decide(pred, monto, plazo_dias, s, hoy=hoy, perfil=perfil, tendencia=tendencia(precios[s]))
            n = r["numeros"]
            filas.append({
                "simbolo": s, "nombre": nombres.get(s, s), "grupo": grupo,
                "decision": r["decision"], "razon": _razon_principal(r),
                "fraccion": n["fraccion"], "senal": n["senal"],
                "volatilidad": n["volatilidad"], "rendimiento_esperado": n["rendimiento_esperado"],
            })

    # Selection: one per type in turn; within a type, strongest signal first.
    candidatos = {g: sorted([f for f in filas if f["grupo"] == g and f["decision"] == INVERTIR],
                            key=lambda f: -f["senal"]) for g in grupos}
    seleccion: list[dict] = []
    # Why an investable asset didn't make the portfolio (the app shows it as "Not in the plan").
    fuera: dict[str, str] = {}

    def copia(f: dict) -> dict | None:
        return next((x for x in seleccion
                     if _correlacion(precios[f["simbolo"]], precios[x["simbolo"]]) > CORRELACION_MAXIMA), None)

    while len(seleccion) < MAX_ACTIVOS and any(candidatos.values()):
        for g in grupos:
            while candidatos[g] and len(seleccion) < MAX_ACTIVOS:
                f = candidatos[g].pop(0)
                gemelo = copia(f)
                if gemelo is None:
                    seleccion.append(f)
                    break
                fuera[f["simbolo"]] = f"Moves almost like {gemelo['nombre']}, which is already in the plan."
    for resto in candidatos.values():
        for f in resto:
            fuera[f["simbolo"]] = f"The plan holds up to {MAX_ACTIVOS} assets."

    if seleccion:
        w = _pesos(seleccion, tope_por_activo=tope_por_activo)
        sims = [f["simbolo"] for f in seleccion]
        mu, sigma, peor = riesgo_cartera(w, sims, precios, [f["rendimiento_esperado"] for f in seleccion], plazo_dias)
        escala = 1.0 if peor >= 0 else min(1.0, tol / -peor)
    else:
        w, mu, sigma, peor, escala = [], 0.0, 0.0, 0.0, 0.0

    if respetar_fracciones and seleccion:
        # Raising the concentration cap must not override risk, trend or event
        # sizing brakes. Scale the whole portfolio without changing proportions
        # or redistributing the difference: that part stays in cash.
        limites = [f["fraccion"] / wi for f, wi in zip(seleccion, w) if wi > 0]
        escala = max(0.0, min(1.0, escala, *limites))

    cartera = [{
        "simbolo": f["simbolo"], "nombre": f["nombre"], "grupo": f["grupo"],
        "peso": float(wi * escala), "monto": float(monto * wi * escala),
    } for f, wi in zip(seleccion, w)]
    cartera.sort(key=lambda c: -c["peso"])
    invertido = sum(c["monto"] for c in cartera)

    def lista(dec):
        return [{k: f[k] for k in ("simbolo", "nombre", "grupo", "razon", "fraccion")}
                | ({"fuera_del_plan": fuera.get(f["simbolo"])} if dec == INVERTIR else {})
                for f in filas if f["decision"] == dec]

    if cartera:
        partes = ", ".join(f"${c['monto']:,.0f} in {c['nombre']}" for c in cartera)
        resumen = (f"For {plazo_dias} days with a {perfil_en(perfil)} profile: {partes}. "
                   f"Keep ${monto - invertido:,.0f} in cash. "
                   f"In a bad scenario the plan could lose about ${-peor * escala * monto:,.0f} "
                   f"({peor * escala:+.1%}); your profile accepts up to {tol:.0%}.")
    else:
        resumen = (f"For {plazo_dias} days with a {perfil_en(perfil)} profile, none of the selected assets "
                   f"looks good right now. Keep the ${monto:,.0f} in cash and check again later.")

    return {
        "cartera": cartera,
        "efectivo": float(monto - invertido),
        "invertir": lista(INVERTIR),
        "esperar": lista(ESPERAR),
        "no_por_ahora": lista(NO_POR_AHORA),
        "resumen": resumen,
        "numeros": {
            "monto": monto, "plazo_dias": plazo_dias, "perfil": perfil,
            "invertido": float(invertido),
            "rendimiento_esperado": float(mu * escala),
            "volatilidad": float(sigma * escala),
            "peor_caso": float(monto * peor * escala),
            "tolerancia": tol,
        },
    }


def perfil_en(perfil: str) -> str:
    return {"conservador": "conservative", "moderado": "moderate", "agresivo": "aggressive"}[perfil]
