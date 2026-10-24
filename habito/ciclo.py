"""El ciclo del hábito: manda los recordatorios vencidos y llama si nadie abrió el link.

Configuración (en .env):
- PUBLIC_URL: dirección pública de la app (links del WhatsApp y MP3 de la llamada).
- HABITO_ESPERA_MIN: minutos sin abrir el link antes de llamar (por defecto 1440; en la demo, 2).
- HABITO_PERMITIDOS: teléfonos a los que se puede escribir, separados por coma (por defecto DEMO_PHONE).
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


def link(rec: dict) -> str:
    return f"{base_url()}/r/{rec['token']}"


def audio_url(rec: dict) -> str:
    return f"{base_url()}/api/habit/audio/{rec['token']}.mp3"


def procesar(conn, cuando: datetime, decidir, enviar=None, voz=None) -> dict:
    """Una vuelta del ciclo. `decidir(rec)` devuelve la respuesta de /api/decide de hoy para ese recordatorio."""
    enviar = enviar or twilio
    hechos = {"enviados": 0, "llamadas": 0, "errores": 0}
    for rec in almacen.vencidos(conn, cuando):
        try:
            texto, _ = mensajes.whatsapp(rec, decidir(rec), link(rec))
            enviar.mensaje(rec["telefono"], texto)
            almacen.actualizar(conn, rec["token"], estado="enviado", enviado_en=almacen.iso(cuando))
            hechos["enviados"] += 1
        except Exception as e:  # se guarda el motivo para verlo en /api/habit/{token}
            almacen.actualizar(conn, rec["token"], estado="error", error=str(e)[:300])
            hechos["errores"] += 1
    for rec in almacen.sin_abrir(conn, cuando, espera()):
        guion = mensajes.guion_llamada(rec)
        try:
            hay_audio = voz is not None and voz.audio(guion) is not None
            enviar.llamar(rec["telefono"], audio_url(rec) if hay_audio else None, guion)
            almacen.actualizar(conn, rec["token"], estado="llamado", llamado_en=almacen.iso(cuando))
            hechos["llamadas"] += 1
        except Exception as e:
            almacen.actualizar(conn, rec["token"], estado="error", error=str(e)[:300])
            hechos["errores"] += 1
    return hechos
