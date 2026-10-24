"""Tutor de dinero para principiantes: contesta dudas sobre el activo en pantalla y de finanzas en general.

Gemini enseña, no decide: recibe la ficha del activo y los números que ya
calculó la app, y tiene prohibido decir si comprar o vender, predecir precios o
cambiar un número. Sin clave o si falla, contesta con la ficha local.
"""

from __future__ import annotations

import json
import os

from explain.fichas import PREGUNTA_DE_ACTIVO, glosario, texto_ficha
from explain.resumen import MODELO, TIMEOUT_MS

LARGO_PREGUNTA = 300
LARGO_RESPUESTA = 1200
TURNOS = 4

INSTRUCCIONES = """You are Horizon's money tutor. Horizon is an educational app that tells beginners how much to invest today.
Your job is to help people understand what they are doing with their money, like "finance for beginners".

Rules:
- Answer in the language of the question. Use plain words and at most 5 short sentences.
- Link ideas to everyday life: shops, phone bills, petrol, savings, prices going up.
- For the asset on screen, rely on the asset facts given. If you are not sure of a fact, say so.
- You may explain the app's numbers given in the context. Never change them.
- Never tell the person to buy, sell or hold anything, and never predict prices.
- For personal decisions (all their savings, debt, taxes), say you cannot give personal advice, then explain the idea behind it.
- If the question is not about money, investing or this app, say you only answer money questions.
"""

_guardadas: dict[str, dict] = {}


def llamar_gemini(prompt: str) -> str | None:
    clave = os.getenv("GEMINI_API_KEY")
    if not clave:
        return None
    from google import genai
    from google.genai import types

    cliente = genai.Client(api_key=clave, http_options=types.HttpOptions(timeout=TIMEOUT_MS))
    r = cliente.models.generate_content(
        model=MODELO,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=INSTRUCCIONES, temperature=0.3,
                                           max_output_tokens=400),
    )
    return (r.text or "").strip() or None


def armar_prompt(pregunta: str, simbolo: str | None, nombre: str | None, contexto: dict, historial: list[dict]) -> str:
    partes = []
    if simbolo:
        ficha = texto_ficha(simbolo)
        partes.append(f"Asset on screen: {nombre or simbolo} ({simbolo}). Facts: {ficha or 'none on file'}")
    if contexto:
        partes.append("What the app showed (already calculated, do not change): " + json.dumps(contexto))
    for t in historial[-TURNOS:]:
        partes.append(f"Earlier question: {t['pregunta']}\nEarlier answer: {t['respuesta']}")
    partes.append(f"Question: {pregunta}")
    return "\n\n".join(partes)


def respuesta_local(pregunta: str, simbolo: str | None, nombre: str | None) -> dict:
    """Sin Gemini: el glosario si la pregunta es de un concepto, la ficha si es del activo."""
    nota = " (The tutor is offline, so this is our short explainer.)"
    p = pregunta.lower()
    ficha = texto_ficha(simbolo) if simbolo else None
    del_activo = ficha and (any(c in p for c in PREGUNTA_DE_ACTIVO) or (nombre or "").lower() in p
                            or (simbolo or "").lower() in p)
    if del_activo:
        return {"respuesta": f"{nombre or simbolo}: {ficha}{nota}", "fuente": "local"}
    concepto = glosario(pregunta)
    if concepto:
        return {"respuesta": concepto + nota, "fuente": "local"}
    return {"respuesta": "The tutor is offline right now. Please try again in a moment.", "fuente": "offline"}


def responder(pregunta: str, simbolo: str | None = None, nombre: str | None = None,
              contexto: dict | None = None, historial: list[dict] | None = None, llamar=llamar_gemini) -> dict:
    contexto, historial = contexto or {}, historial or []
    prompt = armar_prompt(pregunta.strip(), simbolo, nombre, contexto, historial)
    if prompt in _guardadas:
        return dict(_guardadas[prompt])
    try:
        texto = llamar(prompt)
    except Exception:  # sin red, cuota o modelo no disponible
        texto = None
    if not texto:
        return respuesta_local(pregunta, simbolo, nombre)
    r = {"respuesta": texto[:LARGO_RESPUESTA], "fuente": "gemini"}
    _guardadas[prompt] = r
    return dict(r)
