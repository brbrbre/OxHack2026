"""El ciclo del hábito: manda los recordatorios vencidos y llama si nadie abrió el link.

Configuración (en .env):
- PUBLIC_URL: dirección pública de la app (links del WhatsApp y MP3 de la llamada).
- HABITO_ESPERA_MIN: minutos sin abrir el link antes de llamar (por defecto 1440; en la demo, 2).
- HABITO_PERMITIDOS: teléfonos a los que se puede escribir, separados por coma (por defecto DEMO_PHONE).
- HABITO_LLAMADA_A: "whatsapp=voz" separados por coma, para llamar a otro número que el del WhatsApp
  (ej. el WhatsApp vive en una línea de México que no suena en el Reino Unido).
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
    """A qué número llamar. Usa HABITO_LLAMADA_A si hay pareja; si no, quita el 1 de los celulares de México:
    WhatsApp los escribe con un 1 después del código de país, pero para marcar va sin él."""
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
    """Pregunta a Twilio qué pasó de verdad con el mensaje y la llamada, y lo guarda.

    Que Twilio acepte la llamada no quiere decir que alguien contestó: "llamado" solo queda con
    "completed"; busy, no-answer, failed o canceled pasan a "sin_respuesta".
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
    """La persona abrió el link: cuenta como abierto y, si la llamada ya salió, se corta.
    Es uno u otro: link abierto o llamada, nunca los dos."""
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
    """Una vuelta del ciclo. `decidir(rec)` devuelve la respuesta de /api/decide de hoy para ese recordatorio."""
    enviar = enviar or twilio
    hechos = {"enviados": 0, "llamadas": 0, "errores": 0}
    for rec in almacen.por_revisar(conn):
        try:
            revisar(conn, rec, cuando, enviar)
        except Exception:  # si Twilio no responde, se vuelve a preguntar en la siguiente vuelta
            pass
    for rec in almacen.vencidos(conn, cuando):
        try:
            texto, _ = mensajes.whatsapp(rec, decidir(rec), link(rec))
            sid = enviar.mensaje(rec["telefono"], texto)
            almacen.actualizar(conn, rec["token"], estado="enviado", enviado_en=almacen.iso(cuando),
                               mensaje_sid=sid, mensaje_estado="queued" if sid else None)
            hechos["enviados"] += 1
        except Exception as e:  # se guarda el motivo para verlo en /api/habit/{token}
            almacen.actualizar(conn, rec["token"], estado="error", error=str(e)[:300])
            hechos["errores"] += 1
    for rec in almacen.sin_abrir(conn, cuando, espera()):
        guion = mensajes.guion_llamada(rec)
        try:
            hay_audio = voz is not None and voz.audio(guion) is not None
            # El audio tarda unos segundos: si abrió el link mientras tanto, ya no se llama.
            if almacen.obtener(conn, rec["token"])["abierto_en"]:
                continue
            sid = enviar.llamar(telefono_llamada(rec["telefono"]), audio_url(rec) if hay_audio else None, guion)
            if almacen.obtener(conn, rec["token"])["abierto_en"]:  # lo abrió mientras salía la llamada
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
