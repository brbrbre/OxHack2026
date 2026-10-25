"""Textos del recordatorio. Gemini redacta el WhatsApp con la respuesta de hoy; la llamada usa un guion fijo.

Gemini solo redacta: si su texto no trae el link o el nombre del activo, o pasa de 600
caracteres, se usa la plantilla. Nunca decide ni cambia un número.
"""

from __future__ import annotations

import json
import os

from explain.resumen import MODELO, TIMEOUT_MS

ETIQUETA = {"INVERTIR": "Invest", "ESPERAR": "Wait", "NO_POR_AHORA": "Not now"}
LARGO_MAXIMO = 600

INSTRUCCIONES = (
    "You write a WhatsApp reminder for Horizon, an educational app that helps beginners build a money habit. "
    "Write at most 4 short sentences in plain English, under 400 characters, friendly and calm. "
    "Use only the facts given. Do not tell the person to buy or sell, and do not predict prices. "
    "Mention the asset by name. End with the review link exactly as given."
)


def _dinero(x: float) -> str:
    return f"${x:,.0f}"


def hechos(rec: dict, hoy: dict, link: str) -> dict:
    n = hoy["numeros"]
    return {
        "asset": rec["nombre"],
        "situation": ("their waiting period has ended" if rec["decision"] != "INVERTIR"
                      else f"their {rec['plazo_dias']}-day plan has ended"),
        "first_answer": f"{ETIQUETA[rec['decision']]}, invest {_dinero(rec['sugerido'])} of {_dinero(rec['monto'])}",
        "today_answer": f"{ETIQUETA[hoy['decision']]}, invest {_dinero(min(n['monto_sugerido'], n['monto']))} of {_dinero(n['monto'])}",
        "today_expected_return": f"{n['rendimiento_esperado']:+.1%} over {n['plazo_dias']} days",
        "today_chance_of_loss": f"{n['prob_perdida']:.0%}",
        "review_link": link,
    }


def plantilla(h: dict) -> str:
    if h["situation"].startswith("their waiting"):
        primera = f"Hello from Horizon. You were interested in {h['asset']}, and the waiting period has ended."
    else:
        primera = f"Hello from Horizon. Your plan for {h['asset']} has ended, so it is a good moment to review it."
    return (f"{primera} Today Horizon says: {h['today_answer']}. "
            f"Check it and decide if you keep, change or start: {h['review_link']}")


def llamar_gemini(h: dict) -> str | None:
    clave = os.getenv("GEMINI_API_KEY")
    if not clave:
        return None
    from google import genai
    from google.genai import types

    cliente = genai.Client(api_key=clave, http_options=types.HttpOptions(timeout=TIMEOUT_MS))
    r = cliente.models.generate_content(
        model=MODELO, contents="Facts (JSON):\n" + json.dumps(h),
        config=types.GenerateContentConfig(system_instruction=INSTRUCCIONES, temperature=0.4, max_output_tokens=300))
    return (r.text or "").strip() or None


def link_aparte(texto: str, link: str) -> str:
    """El link va solo en la última línea: pegado al final de una oración cuesta más tocarlo."""
    i = texto.rfind(link)
    antes, despues = texto[:i].rstrip(), texto[i + len(link):].strip(" .")
    return f"{antes}\n\n{link}" + (f"\n{despues}" if despues else "")


def whatsapp(rec: dict, hoy: dict, link: str, llamar=llamar_gemini) -> tuple[str, str]:
    """(texto, fuente). fuente = 'gemini' o 'template'."""
    h = hechos(rec, hoy, link)
    try:
        propuesto = llamar(h)
    except Exception:
        propuesto = None
    if propuesto and link in propuesto and rec["nombre"].lower() in propuesto.lower() and len(propuesto) <= LARGO_MAXIMO:
        return link_aparte(propuesto, link), "gemini"
    return link_aparte(plantilla(h), link), "template"


def guion_llamada(rec: dict) -> str:
    """Texto fijo para la voz de ElevenLabs: el mismo recordatorio siempre suena igual."""
    situacion = (f"The waiting period for {rec['nombre']} has ended." if rec["decision"] != "INVERTIR"
                 else f"Your {rec['plazo_dias']}-day plan for {rec['nombre']} has ended.")
    return ("Hello, this is Horizon, your money habit reminder. " + situacion +
            " We sent you a WhatsApp message with today's view. "
            "Open it when you can, and decide what you want to do with your money. Goodbye.")
