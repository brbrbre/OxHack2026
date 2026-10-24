"""Calificación de las predicciones, calculada dentro de Tiger Data con time_bucket.

Uso: python -m tiger.reporte [--origen backtest|live] [--cada '3 months']
"""

from __future__ import annotations

import argparse
import sys

from tiger import db

CONSULTA = """
SELECT time_bucket(%(cada)s::interval, time) AS periodo,
       count(*)                                                AS predicciones,
       avg(((real BETWEEN bajo AND alto))::int)                AS dentro_del_intervalo,
       avg(power(prob_perdida - (real < 0)::int, 2))           AS brier,
       avg(fraccion)                                           AS exposicion,
       avg(real)                                               AS rend_siempre,
       avg(fraccion * real)                                    AS rend_app
FROM predicciones
WHERE real IS NOT NULL AND origen = %(origen)s
GROUP BY periodo ORDER BY periodo
"""


def main(argv: list[str]) -> int:
    from dotenv import load_dotenv

    load_dotenv()
    ap = argparse.ArgumentParser(description="Calificación en Tiger Data")
    ap.add_argument("--origen", default="backtest", choices=["backtest", "live"])
    ap.add_argument("--cada", default="6 months")
    a = ap.parse_args(argv)
    if not db.url():
        print("Falta TIGER_DATABASE_URL en .env")
        return 2
    with db.conectar() as conn, conn.cursor() as cur:
        cur.execute(CONSULTA, {"cada": a.cada, "origen": a.origen})
        filas = cur.fetchall()
        cur.execute("SELECT count(*), count(*) FILTER (WHERE real IS NULL) FROM predicciones WHERE origen = %s",
                    (a.origen,))
        total, pendientes = cur.fetchone()
    print(f"Origen {a.origen}: {total} predicciones, {pendientes} esperando su resultado\n")
    print(f"{'periodo':<12}{'n':>6}{'dentro 90%':>12}{'Brier':>8}{'exposición':>12}{'siempre':>10}{'app':>9}")
    for p, n, dentro, brier, exp, siempre, app in filas:
        print(f"{p.date()!s:<12}{n:>6}{dentro:>12.0%}{brier:>8.3f}{exp:>12.0%}{siempre:>+10.2%}{app:>+9.2%}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
