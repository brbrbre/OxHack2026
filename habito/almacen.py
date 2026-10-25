"""Reminders stored in SQLite, inside data/cache/ (outside the repo: they hold phone numbers)."""

from __future__ import annotations

import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

ARCHIVO = Path(__file__).resolve().parent.parent / "data" / "cache" / "habito.sqlite"

ESQUEMA = """
CREATE TABLE IF NOT EXISTS recordatorios (
    token        TEXT PRIMARY KEY,
    creado       TEXT NOT NULL,
    vence        TEXT NOT NULL,
    telefono     TEXT NOT NULL,
    simbolo      TEXT NOT NULL,
    nombre       TEXT NOT NULL,
    monto        REAL NOT NULL,
    plazo_dias   INTEGER NOT NULL,
    perfil       TEXT NOT NULL,
    decision     TEXT NOT NULL,
    sugerido     REAL NOT NULL,
    estado       TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente, enviado, abierto, llamando, llamado, sin_respuesta, error
    enviado_en   TEXT,
    abierto_en   TEXT,
    llamado_en   TEXT,
    error        TEXT
)
"""

# Columns added later; conectar() adds them to an existing database.
# They hold the Twilio SIDs and the last status Twilio reported (delivered, busy, completed...),
# and the asset types when the reminder is for a "Help me choose" plan (comma-separated).
NUEVAS = ("mensaje_sid", "mensaje_estado", "llamada_sid", "llamada_estado", "tipos")

# Twilio statuses that no longer change: no need to ask again.
FINALES_MENSAJE = ("delivered", "read", "failed", "undelivered")
FINALES_LLAMADA = ("completed", "busy", "no-answer", "failed", "canceled")


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def _iso(t: datetime) -> str:
    return t.astimezone(timezone.utc).isoformat(timespec="seconds")


def conectar(archivo: Path | None = None) -> sqlite3.Connection:
    archivo = archivo or ARCHIVO
    archivo.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(archivo, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute(ESQUEMA)
    hay = {f["name"] for f in conn.execute("PRAGMA table_info(recordatorios)")}
    for columna in NUEVAS:
        if columna not in hay:
            conn.execute(f"ALTER TABLE recordatorios ADD COLUMN {columna} TEXT")
    conn.commit()
    return conn


def crear(conn, telefono: str, simbolo: str, nombre: str, monto: float, plazo_dias: int, perfil: str,
          decision: str, sugerido: float, cuando: datetime | None = None, tipos: list[str] | None = None) -> dict:
    cuando = cuando or ahora()
    nuevo = secrets.token_urlsafe(16)
    conn.execute(
        "INSERT INTO recordatorios (token, creado, vence, telefono, simbolo, nombre, monto, plazo_dias, perfil, "
        "decision, sugerido, tipos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (nuevo, _iso(cuando), _iso(cuando + timedelta(days=plazo_dias)), telefono, simbolo, nombre, monto,
         plazo_dias, perfil, decision, sugerido, ",".join(tipos) if tipos else None))
    conn.commit()
    return obtener(conn, nuevo)


def obtener(conn, token: str) -> dict | None:
    fila = conn.execute("SELECT * FROM recordatorios WHERE token = ?", (token,)).fetchone()
    return dict(fila) if fila else None


def actualizar(conn, token: str, **campos) -> None:
    sets = ", ".join(f"{k} = ?" for k in campos)
    conn.execute(f"UPDATE recordatorios SET {sets} WHERE token = ?", (*campos.values(), token))
    conn.commit()


def vencidos(conn, cuando: datetime) -> list[dict]:
    return [dict(f) for f in conn.execute(
        "SELECT * FROM recordatorios WHERE estado = 'pendiente' AND vence <= ?", (_iso(cuando),))]


def sin_abrir(conn, cuando: datetime, espera: timedelta) -> list[dict]:
    """Sent more than `espera` ago and nobody opened the link: time to call."""
    return [dict(f) for f in conn.execute(
        "SELECT * FROM recordatorios WHERE estado = 'enviado' AND abierto_en IS NULL AND enviado_en <= ?",
        (_iso(cuando - espera),))]


def por_revisar(conn) -> list[dict]:
    """Messages or calls whose Twilio status can still change."""
    m = ",".join("?" * len(FINALES_MENSAJE))
    ll = ",".join("?" * len(FINALES_LLAMADA))
    return [dict(f) for f in conn.execute(
        f"SELECT * FROM recordatorios WHERE (mensaje_sid IS NOT NULL AND COALESCE(mensaje_estado, '') NOT IN ({m})) "
        f"OR (llamada_sid IS NOT NULL AND COALESCE(llamada_estado, '') NOT IN ({ll}))",
        (*FINALES_MENSAJE, *FINALES_LLAMADA))]


def iso(t: datetime) -> str:
    return _iso(t)
