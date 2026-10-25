"""The habit cycle: sends due reminders, and calls if nobody opened the link.

Settings (in .env):
- PUBLIC_URL: the app's public address (WhatsApp links and the call's MP3).
- HABITO_ESPERA_MIN: minutes without opening the link before calling (default 1440; 2 in the demo).
- HABITO_PERMITIDOS: comma-separated phone numbers that may receive messages (default DEMO_PHONE).
- HABITO_LLAMADA_A: comma-separated "whatsapp=voice" pairs, to call a different number than the WhatsApp one
  (e.g. the WhatsApp lives on a Mexican line that doesn't ring in the UK).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta

from habito import almacen, mensajes, twilio


def base_url() -> str:
    return (os.getenv("PUBLIC_URL") or "http://localhost:8000").rstrip("/")


def espera() -> timedelta:
    return timedelta(minutes=float(os.getenv("HABITO_ESPERA_MIN", "1440")))


def permitidos() -> set[str]:
    crudo = os.getenv("HABITO_PERMITIDOS") or os.getenv("DEMO_PHONE") or ""
    return {t.strip().replace(" ", "") for t in crudo.split(",") if t.strip()}


PAIS_MEXICO = "52"


def telefono_llamada(telefono: str) -> str:
    """Which number to call. Uses HABITO_LLAMADA_A if there is a pair; otherwise drops the 1 from Mexican
    mobiles: WhatsApp writes them with a 1 after the country code, but dialling goes without it."""
    for par in (os.getenv("HABITO_LLAMADA_A") or "").split(","):
        if "=" in par:
            wa, voz = (x.strip().replace(" ", "") for x in par.split("=", 1))
            if wa == telefono:
                return voz
    if telefono.startswith(f"+{PAIS_MEXICO}1") and len(telefono) == 14:
        return f"+{PAIS_MEXICO}" + telefono[4:]
    return telefono


def link(rec: dict) -> str:
    return f"{base_url()}/r/{rec['token']}"


def audio_url(rec: dict) -> str:
    return f"{base_url()}/api/habit/audio/{rec['token']}.mp3"


SIN_RESPUESTA = ("busy", "no-answer", "failed", "canceled")


def revisar(conn, rec: dict, cuando: datetime, consultar=None) -> dict:
    """Asks Twilio what really happened with the message and the call, and stores it.

    Twilio accepting a call doesn't mean anyone answered: "llamado" is only set on "completed";
    busy, no-answer, failed or canceled become "sin_respuesta".
    """
    consultar = consultar or twilio
    cambios = {}
    if rec.get("mensaje_sid") and rec.get("mensaje_estado") not in almacen.FINALES_MENSAJE:
        cambios["mensaje_estado"] = consultar.estado_mensaje(rec["mensaje_sid"])
    if rec.get("llamada_sid") and rec.get("llamada_estado") not in almacen.FINALES_LLAMADA:
        estado = consultar.estado_llamada(rec["llamada_sid"])
        cambios["llamada_estado"] = estado
        if rec["estado"] == "llamando" and estado == "completed":
            cambios |= {"estado": "llamado", "llamado_en": almacen.iso(cuando)}
        elif rec["estado"] == "llamando" and estado in SIN_RESPUESTA:
            cambios["estado"] = "sin_respuesta"
    if cambios:
        almacen.actualizar(conn, rec["token"], **cambios)
    return rec | cambios


def abrir(conn, rec: dict, cuando: datetime, colgar=None) -> None:
    """The person opened the link: it counts as opened and, if the call already went out, it is cut.
    It is one or the other: an opened link or a call, never both."""
    if rec["abierto_en"]:
        return
    cambios = {"abierto_en": almacen.iso(cuando)}
    if rec["estado"] in ("enviado", "llamando"):
        cambios["estado"] = "abierto"
    if rec["estado"] == "llamando" and rec.get("llamada_sid"):
        try:
            (colgar or twilio.colgar)(rec["llamada_sid"], rec.get("llamada_estado"))
            cambios["llamada_estado"] = "canceled"
        except Exception:
            pass
    almacen.actualizar(conn, rec["token"], **cambios)


def procesar(conn, cuando: datetime, decidir, enviar=None, voz=None) -> dict:
    """One pass of the cycle. `decidir(rec)` returns today's answer for that reminder."""
    enviar = enviar or twilio
    hechos = {"enviados": 0, "llamadas": 0, "errores": 0}
    for rec in almacen.por_revisar(conn):
        try:
            revisar(conn, rec, cuando, enviar)
        except Exception:  # if Twilio doesn't answer, ask again on the next pass
            pass
    for rec in almacen.vencidos(conn, cuando):
        try:
            texto, _ = mensajes.whatsapp(rec, decidir(rec), link(rec))
            sid = enviar.mensaje(rec["telefono"], texto)
            almacen.actualizar(conn, rec["token"], estado="enviado", enviado_en=almacen.iso(cuando),
                               mensaje_sid=sid, mensaje_estado="queued" if sid else None)
            hechos["enviados"] += 1
        except Exception as e:  # the reason is stored, visible at /api/habit/{token}
            almacen.actualizar(conn, rec["token"], estado="error", error=str(e)[:300])
            hechos["errores"] += 1
    for rec in almacen.sin_abrir(conn, cuando, espera()):
        guion = mensajes.guion_llamada(rec)
        try:
            hay_audio = voz is not None and voz.audio(guion) is not None
            # The audio takes a few seconds: if the link was opened meanwhile, no call.
            if almacen.obtener(conn, rec["token"])["abierto_en"]:
                continue
            sid = enviar.llamar(telefono_llamada(rec["telefono"]), audio_url(rec) if hay_audio else None, guion)
            if almacen.obtener(conn, rec["token"])["abierto_en"]:  # opened while the call was going out
                if sid:
                    enviar.colgar(sid, "queued")
                almacen.actualizar(conn, rec["token"], llamada_sid=sid, llamada_estado="canceled" if sid else None)
                continue
            almacen.actualizar(conn, rec["token"], estado="llamando", llamada_sid=sid,
                               llamada_estado="queued" if sid else None)
            hechos["llamadas"] += 1
        except Exception as e:
            almacen.actualizar(conn, rec["token"], estado="error", error=str(e)[:300])
            hechos["errores"] += 1
    return hechos
