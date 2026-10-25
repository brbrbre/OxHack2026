"""Sending through Twilio: WhatsApp (sandbox) and a call that plays an MP3. Uses the REST API with requests."""

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
    """queued, sent, delivered, read, undelivered or failed."""
    return _get(f"Messages/{sid}")["status"]


def estado_llamada(sid: str) -> str:
    """queued, ringing, in-progress, completed, busy, no-answer, failed or canceled."""
    return _get(f"Calls/{sid}")["status"]


def whatsapp(telefono: str, texto: str) -> str:
    """Sends a WhatsApp from the sandbox number. Returns the message SID."""
    return _post("Messages", {"From": "whatsapp:" + os.environ["TWILIO_WHATSAPP_FROM"],
                              "To": "whatsapp:" + telefono, "Body": texto})["sid"]


def sms(telefono: str, texto: str) -> str:
    """SMS from the Twilio number. A trial account prepends "Sent from your Twilio trial account"."""
    return _post("Messages", {"From": os.environ["TWILIO_FROM"], "To": telefono, "Body": texto})["sid"]


def mensaje(telefono: str, texto: str) -> str:
    """WhatsApp if possible; otherwise SMS with the same text.

    HABITO_CANAL=sms sends SMS directly. A Twilio trial account only allows its own WhatsApp
    templates (error 21654, "ContentSid Required"), so it falls back to SMS there too.
    """
    if os.getenv("HABITO_CANAL", "whatsapp") == "sms":
        return sms(telefono, texto)
    try:
        return whatsapp(telefono, texto)
    except RuntimeError as e:
        if "21654" not in str(e):
            raise
        return sms(telefono, texto)


def colgar(sid: str, ultimo_estado: str | None) -> None:
    """Ends the call: "canceled" if not answered yet, "completed" if already in progress."""
    primero = "completed" if ultimo_estado == "in-progress" else "canceled"
    try:
        _post(f"Calls/{sid}", {"Status": primero})
    except RuntimeError:
        _post(f"Calls/{sid}", {"Status": "completed" if primero == "canceled" else "canceled"})


def llamar(telefono: str, audio_url: str | None, texto: str) -> str:
    """Calls and plays the ElevenLabs MP3; without audio, Twilio reads the text."""
    cuerpo = f"<Play>{escape(audio_url)}</Play>" if audio_url else f"<Say>{escape(texto)}</Say>"
    return _post("Calls", {"From": os.environ["TWILIO_FROM"], "To": telefono,
                           "Twiml": f"<Response>{cuerpo}</Response>"})["sid"]
