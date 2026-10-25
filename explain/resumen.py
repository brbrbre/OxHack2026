""""In short": a plain-language summary of a decision or a plan.

Gemini only writes: it gets the already computed output of decide() or plan() and
turns it into two or three sentences. It never decides or changes a number. The
local template is used if there is no GEMINI_API_KEY, if the call fails or is
slow, or if the text lacks the amount the rule computed.
"""

from __future__ import annotations

import json
import os

# flash-lite answers in about 1 s; gemini-flash-latest was overloaded (503) or took over 29 s (24 Oct 2026).
MODELO = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
TIMEOUT_MS = 12000  # the Gemini API rejects timeouts under 10 s
LARGO_MAXIMO = 500

# Texts written here: /api/listen only reads these, never free text.
generados: set[str] = set()
_guardados: dict[str, dict] = {}

INSTRUCCIONES = (
    "You explain an investment app's answer to a beginner. "
    "Write 2 or 3 short sentences in plain English, each under 18 words. "
    "Use only the facts and numbers given. Do not add advice, predictions or numbers of your own. "
    "Always state the amount to invest now exactly as written in the facts."
)


def _dinero(x: float) -> str:
    return f"${x:,.0f}"


def hechos_decision(d: dict) -> dict:
    n = d["numeros"]
    ahora = min(round(n["monto_sugerido"]), round(n["monto"]))
    return {
        "asset": d["nombre"],
        "budget": _dinero(n["monto"]),
        "invest_now": _dinero(ahora),
        "keep_for_later": _dinero(round(n["monto"]) - ahora),
        "days": n["plazo_dias"],
        "expected_return": f"{n['rendimiento_esperado']:+.1%}",
        "chance_of_loss": f"{n['prob_perdida']:.0%}",
        "bad_case_on_full_budget": _dinero(-n["peor_caso"]),
        "profile_accepts_loss_up_to": {"conservador": "5%", "moderado": "10%", "agresivo": "20%"}[n["perfil"]],
        "reasons": d["razones"],
    }


def hechos_plan(p: dict) -> dict:
    n = p["numeros"]
    return {
        "budget": _dinero(n["monto"]),
        "invest_now": _dinero(n["invertido"]),
        "keep_in_cash": _dinero(p["efectivo"]),
        "days": n["plazo_dias"],
        "holdings": [f"{_dinero(c['monto'])} in {c['nombre']}" for c in p["cartera"]],
        "bad_case_for_plan": _dinero(-n["peor_caso"]),
        "profile_accepts_loss_up_to": f"{n['tolerancia']:.0%}",
    }


def plantilla_decision(h: dict) -> str:
    if h["invest_now"] == "$0":
        primera = f"Keep your {h['budget']} for now."
    elif h["keep_for_later"] == "$0":
        primera = f"Invest the full {h['budget']} in {h['asset']} now."
    else:
        primera = f"Invest {h['invest_now']} of your {h['budget']} in {h['asset']} now, and keep {h['keep_for_later']} for later."
    return (f"{primera} Over {h['days']} days the model expects {h['expected_return']}, "
            f"with a {h['chance_of_loss']} chance of loss. "
            f"Your profile accepts losses up to {h['profile_accepts_loss_up_to']}.")


def plantilla_plan(h: dict) -> str:
    if not h["holdings"]:
        return f"Keep your {h['budget']} in cash for now. None of the assets you picked fits your profile today."
    return (f"Invest {h['invest_now']} now: {', '.join(h['holdings'])}. Keep {h['keep_in_cash']} in cash. "
            f"In a bad scenario the plan could lose about {h['bad_case_for_plan']}; "
            f"your profile accepts up to {h['profile_accepts_loss_up_to']}.")


def llamar_gemini(hechos: dict) -> str | None:
    clave = os.getenv("GEMINI_API_KEY")
    if not clave:
        return None
    from google import genai
    from google.genai import types

    cliente = genai.Client(api_key=clave, http_options=types.HttpOptions(timeout=TIMEOUT_MS))
    r = cliente.models.generate_content(
        model=MODELO,
        contents=INSTRUCCIONES + "\n\nFacts (JSON):\n" + json.dumps(hechos),
        config=types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json",
            response_schema={"type": "OBJECT", "properties": {"summary": {"type": "STRING"}},
                             "required": ["summary"]},
        ),
    )
    return json.loads(r.text)["summary"].strip()


def _resumir(hechos: dict, plantilla: str, llamar) -> dict:
    clave = json.dumps(hechos, sort_keys=True)
    if clave in _guardados:
        return dict(_guardados[clave])
    texto, fuente = plantilla, "template"
    try:
        propuesto = llamar(hechos)
    except Exception:  # no network, quota, model unavailable: the template is enough
        propuesto = None
    # If Gemini changed or skipped the amount, its text is dropped: the rule sets the number.
    if propuesto and hechos["invest_now"] in propuesto and len(propuesto) <= LARGO_MAXIMO:
        texto, fuente = propuesto, "gemini"
    r = {"texto": texto, "fuente": fuente}
    _guardados[clave] = r
    generados.add(texto)
    return dict(r)


def resumir_decision(d: dict, llamar=llamar_gemini) -> dict:
    h = hechos_decision(d)
    return _resumir(h, plantilla_decision(h), llamar)


def resumir_plan(p: dict, llamar=llamar_gemini) -> dict:
    h = hechos_plan(p)
    return _resumir(h, plantilla_plan(h), llamar)
