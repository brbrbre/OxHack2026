"""Envío por Twilio: WhatsApp (sandbox) y llamada que reproduce un MP3. Usa la API REST con requests."""

from __future__ import annotations

import os
from xml.sax.saxutils import escape

import requests

API = "https://api.twilio.com/2010-04-01/Accounts/{sid}/{recurso}.json"


def configurado() -> bool:
    return all(os.getenv(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"))


def _post(recurso: str, datos: dict) -> dict:
    if not configurado():
        raise RuntimeError("Twilio is not set up yet")
    sid, clave = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
    r = requests.post(API.format(sid=sid, recurso=recurso), data=datos, auth=(sid, clave), timeout=20)
    if r.status_code >= 300:
        raise RuntimeError(f"Twilio {recurso} {r.status_code}: {r.text[:300]}")
    return r.json()


def _get(recurso: str) -> dict:
    if not configurado():
        raise RuntimeError("Twilio is not set up yet")
    sid, clave = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
    r = requests.get(API.format(sid=sid, recurso=recurso), auth=(sid, clave), timeout=20)
    if r.status_code >= 300:
        raise RuntimeError(f"Twilio {recurso} {r.status_code}: {r.text[:300]}")
    return r.json()


def estado_mensaje(sid: str) -> str:
    """queued, sent, delivered, read, undelivered o failed."""
    return _get(f"Messages/{sid}")["status"]


def estado_llamada(sid: str) -> str:
    """queued, ringing, in-progress, completed, busy, no-answer, failed o canceled."""
    return _get(f"Calls/{sid}")["status"]


def whatsapp(telefono: str, texto: str) -> str:
    """Manda un WhatsApp desde el número del sandbox. Devuelve el SID del mensaje."""
    return _post("Messages", {"From": "whatsapp:" + os.environ["TWILIO_WHATSAPP_FROM"],
                              "To": "whatsapp:" + telefono, "Body": texto})["sid"]


def sms(telefono: str, texto: str) -> str:
    """SMS desde el número de Twilio. La cuenta de prueba antepone "Sent from your Twilio trial account"."""
    return _post("Messages", {"From": os.environ["TWILIO_FROM"], "To": telefono, "Body": texto})["sid"]


def mensaje(telefono: str, texto: str) -> str:
    """WhatsApp si se puede; si no, SMS con el mismo texto.

    HABITO_CANAL=sms manda SMS directo. La cuenta de prueba de Twilio solo deja mandar por WhatsApp
    plantillas suyas (error 21654, "ContentSid Required"), así que ahí también cae a SMS.
    """
    if os.getenv("HABITO_CANAL", "whatsapp") == "sms":
        return sms(telefono, texto)
    try:
        return whatsapp(telefono, texto)
    except RuntimeError as e:
        if "21654" not in str(e):
            raise
        return sms(telefono, texto)


def llamar(telefono: str, audio_url: str | None, texto: str) -> str:
    """Llama y reproduce el MP3 de ElevenLabs; si no hay audio, Twilio lee el texto."""
    cuerpo = f"<Play>{escape(audio_url)}</Play>" if audio_url else f"<Say>{escape(texto)}</Say>"
    return _post("Calls", {"From": os.environ["TWILIO_FROM"], "To": telefono,
                           "Twiml": f"<Response>{cuerpo}</Response>"})["sid"]
