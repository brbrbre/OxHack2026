"""Plan de inversión para quien no sabe en qué invertir.

La persona da: monto, perfil de riesgo, plazo y tipos de activo que le
interesan. El plan:
1. Corre la regla de decisión en cada activo de esos tipos y los divide en
   invertir / esperar / no por ahora, cada uno con su razón.
2. Arma una cartera con hasta MAX_ACTIVOS de los que se pueden invertir:
   uno por tipo en turno (para diversificar) y, dentro de cada tipo, primero
   el de mayor señal del modelo. Salta los que casi copian a uno ya elegido.
3. Reparte con más peso a lo que se mueve menos (peso ∝ 1 / volatilidad),
   sin pasar de TOPE_POR_ACTIVO en uno solo.
4. Escala la parte invertida para que el peor escenario de la cartera completa
   (percentil 5, con las correlaciones de los últimos 3 años) no pase la
   tolerancia del perfil. El resto queda en efectivo, y el plan lo dice.

No usa ningún LLM: Gemini, si entra, solo redacta el resumen.
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
# Si un candidato se mueve casi igual que uno ya elegido (ej. SPY y VOO, los dos
# replican el S&P 500), no diversifica: se salta.
CORRELACION_MAXIMA = 0.95
VENTANA_COV = 756   # ~3 años de sesiones
Z_95 = 1.6449


def _razon_principal(r: dict) -> str:
    """La razón que explica la decisión (las dos primeras son siempre los números)."""
    extra = r["razones"][2:]
    return extra[-1] if extra else r["razones"][0]


def _pesos(seleccion: list[dict], *, tope_por_activo: float = TOPE_POR_ACTIVO) -> list[float]:
    """Peso ∝ 1/volatilidad, con tope por activo.

    Reparto por llenado: los que llegan al tope se quedan fijos ahí y el
    exceso se reparte solo entre los demás. Si hay menos de 3 activos, el
    tope no deja llegar a 100 % y el resto queda en efectivo.
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
    """Rendimiento esperado, volatilidad y peor caso (percentil 5) de la cartera en el plazo."""
    rets = pd.concat({s: np.log(precios[s].astype(float)).diff() for s in simbolos}, axis=1)
    rets = rets.dropna().tail(VENTANA_COV)  # días en que todos cotizan
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
    """grupos: {"ETFs": ["SPY", ...], ...} solo con los tipos que eligió la persona.
    predecir(simbolo, precios) -> dict con el contrato de model.predict().
    El plan por tipos conserva el tope de 40 %. La ruta independiente de activos
    elegidos pasa un tope de 100 % y respeta las fracciones individuales,
    sin cambiar elegibilidad ni riesgo. Los valores por defecto conservan el
    comportamiento del plan automático."""
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

    # Selección: uno por tipo en turno; dentro del tipo, mayor señal primero.
    candidatos = {g: sorted([f for f in filas if f["grupo"] == g and f["decision"] == INVERTIR],
                            key=lambda f: -f["senal"]) for g in grupos}
    seleccion: list[dict] = []
    # Por qué un activo que se puede invertir no entró a la cartera (la app lo muestra).
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
        # Levantar el tope de concentración no debe anular los frenos de riesgo,
        # tendencia o eventos. Escalamos toda la cartera sin alterar proporciones
        # ni volver a repartir la diferencia: esta queda en efectivo.
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
