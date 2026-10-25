"""Tiger Data connection. All optional: without TIGER_DATABASE_URL the app works the same."""

from __future__ import annotations

import os
from pathlib import Path

ESQUEMA = Path(__file__).with_name("esquema.sql")


def en_utc(t):
    """Date as a UTC timestamp, with or without a time zone."""
    import pandas as pd

    t = pd.Timestamp(t)
    return t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")


def url() -> str | None:
    return os.getenv("TIGER_DATABASE_URL") or None


def conectar():
    import psycopg

    return psycopg.connect(url(), connect_timeout=10)


def crear_esquema(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(ESQUEMA.read_text())
    conn.commit()


COLUMNAS_PRED = ("time", "simbolo", "plazo_dias", "modelo", "origen", "perfil", "esperado", "bajo", "alto",
                 "prob_perdida", "fraccion", "decision", "real")


def guardar_predicciones(conn, filas: list[tuple]) -> int:
    """Inserts or updates predictions (same key = same prediction)."""
    if not filas:
        return 0
    cols = ", ".join(COLUMNAS_PRED)
    marcas = ", ".join(["%s"] * len(COLUMNAS_PRED))
    with conn.cursor() as cur:
        cur.executemany(
            f"INSERT INTO predicciones ({cols}) VALUES ({marcas}) "
            "ON CONFLICT (simbolo, time, plazo_dias, modelo, origen, perfil) DO UPDATE SET "
            "esperado = EXCLUDED.esperado, bajo = EXCLUDED.bajo, alto = EXCLUDED.alto, "
            "prob_perdida = EXCLUDED.prob_perdida, fraccion = EXCLUDED.fraccion, "
            "decision = EXCLUDED.decision, real = COALESCE(EXCLUDED.real, predicciones.real)",
            filas)
    conn.commit()
    return len(filas)


def guardar_en_vivo(fila: tuple) -> None:
    """Stores one app prediction. If Tiger fails, the user's answer doesn't change."""
    if not url():
        return
    try:
        with conectar() as conn:
            guardar_predicciones(conn, [fila])
    except Exception:
        pass
