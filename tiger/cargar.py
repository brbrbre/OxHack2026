"""Carga Tiger Data: esquema, precios de la caché y predicciones del backtest ya calificadas.

Uso:
    python -m tiger.cargar                  # esquema + precios + backtest (modelo del equipo, 30 días, desde 2022)
    python -m tiger.cargar --calificar      # pone el resultado real a las predicciones en vivo cuyo plazo ya pasó
    python -m tiger.cargar --solo-precios
"""

from __future__ import annotations

import argparse
import sys
import time as reloj

import pandas as pd

from tiger import db

CALIFICAR = """
WITH pendientes AS (
    SELECT p.simbolo, p.time, p.plazo_dias, p.modelo, p.origen, p.perfil,
           e.time AS t_entrada, e.cierre AS entrada
    FROM predicciones p
    CROSS JOIN LATERAL (SELECT time, cierre FROM precios c
                        WHERE c.simbolo = p.simbolo AND c.time > p.time ORDER BY c.time LIMIT 1) e
    WHERE p.real IS NULL
), salidas AS (
    SELECT q.*, s.cierre AS salida
    FROM pendientes q
    CROSS JOIN LATERAL (SELECT cierre FROM precios c
                        WHERE c.simbolo = q.simbolo AND c.time >= q.t_entrada + make_interval(days => q.plazo_dias)
                        ORDER BY c.time LIMIT 1) s
)
UPDATE predicciones p SET real = s.salida / s.entrada - 1
FROM salidas s
WHERE p.simbolo = s.simbolo AND p.time = s.time AND p.plazo_dias = s.plazo_dias
  AND p.modelo = s.modelo AND p.origen = s.origen AND p.perfil = s.perfil
"""


def filas_precios(simbolo: str, serie: pd.Series) -> list[tuple]:
    serie = serie.dropna()
    return [(db.en_utc(t), simbolo, float(v)) for t, v in serie.items()]


def subir_precios(conn, simbolos: list[str], refrescar: bool = False) -> int:
    from data.fetch import get_close

    total = 0
    with conn.cursor() as cur:
        for s in simbolos:
            filas = filas_precios(s, get_close(s, refresh=refrescar))
            cur.execute("CREATE TEMP TABLE IF NOT EXISTS carga (LIKE precios) ON COMMIT DROP")
            with cur.copy("COPY carga (time, simbolo, cierre) FROM STDIN") as copia:
                for f in filas:
                    copia.write_row(f)
            cur.execute("INSERT INTO precios SELECT * FROM carga ON CONFLICT (simbolo, time) DO UPDATE "
                        "SET cierre = EXCLUDED.cierre")
            cur.execute("DROP TABLE carga")
            total += len(filas)
    conn.commit()
    return total


def filas_backtest(df: pd.DataFrame, simbolo: str, plazo: int, modelo: str, perfil: str) -> list[tuple]:
    """Convierte las ventanas del backtest en filas de `predicciones`, ya con su resultado real."""
    return [(db.en_utc(r.fecha), simbolo, plazo, modelo, "backtest", perfil,
             float(r.esperado), float(r.bajo), float(r.alto), float(r.prob_perdida), float(r.fraccion),
             str(r.decision), float(r.real)) for r in df.itertuples()]


def subir_backtest(conn, simbolos: list[str], plazo: int, perfil: str, desde: str, modelo: str) -> int:
    from data.fetch import get_close, is_crypto
    from decision.backtest import load_predictor, run

    predict, nombre = load_predictor(modelo)
    total = 0
    for s in simbolos:
        df = run(get_close(s), s, plazo_dias=plazo, perfil=perfil, predict=predict, es_cripto=is_crypto(s), desde=desde)
        total += db.guardar_predicciones(conn, filas_backtest(df, s, plazo, nombre, perfil))
        print(f"   {s:<12} {len(df):>4} ventanas", flush=True)
    return total


def calificar(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT simbolo FROM predicciones WHERE real IS NULL")
        pendientes = [r[0] for r in cur.fetchall()]
    if pendientes:
        subir_precios(conn, pendientes, refrescar=True)
    with conn.cursor() as cur:
        cur.execute(CALIFICAR)
        n = cur.rowcount
    conn.commit()
    return n


def main(argv: list[str]) -> int:
    from dotenv import load_dotenv

    from data.assets import all_symbols

    load_dotenv()
    ap = argparse.ArgumentParser(description="Carga Tiger Data")
    ap.add_argument("--calificar", action="store_true")
    ap.add_argument("--solo-precios", action="store_true")
    ap.add_argument("--modelo", default="model", choices=["baseline", "model"])
    ap.add_argument("--plazo", type=int, default=30)
    ap.add_argument("--perfil", default="moderado")
    ap.add_argument("--desde", default="2022-01-01")
    a = ap.parse_args(argv)
    if not db.url():
        print("Falta TIGER_DATABASE_URL en .env")
        return 2
    t0 = reloj.time()
    with db.conectar() as conn:
        db.crear_esquema(conn)
        if a.calificar:
            print(f"Predicciones calificadas: {calificar(conn)}")
        else:
            print(f"Precios: {subir_precios(conn, all_symbols())} filas")
            if not a.solo_precios:
                n = subir_backtest(conn, all_symbols(), a.plazo, a.perfil, a.desde, a.modelo)
                print(f"Predicciones del backtest: {n} filas")
            conn.commit()
            conn.autocommit = True  # TimescaleDB no refresca una vista continua dentro de una transacción
            conn.execute("CALL refresh_continuous_aggregate('precios_semanales', NULL, NULL)")
    print(f"Listo en {reloj.time() - t0:.0f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
