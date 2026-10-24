"""Backtest en dinero: ¿le habría ido mejor a quien siguió la app?

Para cada fecha de inicio del pasado:
1. El modelo predice usando SOLO precios hasta ese día (sin ver el futuro).
2. La regla de decisión responde INVERTIR, ESPERAR o NO_POR_AHORA.
3. Se mide qué pasó de verdad en los siguientes `plazo_dias`.

Se compara contra "invertir siempre": meter el monto en cada fecha de inicio.
Las ventanas no se enciman (una nueva cada `plazo_dias`), para no contar dos
veces el mismo movimiento. Si la app dice ESPERAR o NO_POR_AHORA, ese dinero
se queda en efectivo (rendimiento 0).

Limitaciones que se dicen en el pitch:
- El calendario de eventos solo tiene fechas desde oct 2026, así que la regla
  de "esperar a la Fed" no participa en el pasado.
- No cuenta comisiones ni impuestos.

Uso:
    python -m decision.backtest SPY BTCUSDT WALMEX.MX --plazo 30 --anios 10
    python -m decision.backtest --todos --modelo baseline
"""

from __future__ import annotations

import argparse
import importlib
import inspect
import math
import sys
from datetime import timedelta

import numpy as np
import pandas as pd

from decision.rules import INVERTIR, PEOR_CASO_ACEPTABLE, decide
from decision.signals import tendencia


def load_predictor(nombre: str):
    """'baseline' usa api/baseline.py; 'model' usa model/predict.py."""
    if nombre == "baseline":
        from api import baseline
        return baseline.predict, baseline.NOMBRE
    mod = importlib.import_module("model.predict")
    return mod.predict, getattr(mod, "NOMBRE", "model")


def _call(predict, precios, plazo_dias, es_cripto):
    if "es_cripto" in inspect.signature(predict).parameters:
        return predict(precios, plazo_dias, es_cripto=es_cripto)
    return predict(precios, plazo_dias)


def run(precios: pd.Series, simbolo: str, plazo_dias: int = 30, anios: int = 10,
        monto: float = 1000.0, perfil: str = "moderado", predict=None,
        es_cripto: bool = False, min_historia: int = 252,
        desde: str | None = None, hasta: str | None = None, decidir=None,
        params: dict | None = None) -> pd.DataFrame:
    """Una fila por ventana: fecha, decisión, rendimiento real y P&L de cada estrategia."""
    if predict is None:
        predict, _ = load_predictor("baseline")
    decidir = decidir or decide
    precios = precios.dropna().sort_index()
    idx = precios.index
    # Rejilla de fechas en calendario: con el mismo `desde`, todos los activos
    # deciden en las mismas fechas (así se pueden comparar y remuestrear por fecha).
    t = pd.Timestamp(desde) if desde is not None else idx[-1] - timedelta(days=365 * anios)
    limite = min(pd.Timestamp(hasta), idx[-1]) if hasta is not None else idx[-1]
    filas = []
    while True:
        # Se decide con el primer cierre disponible desde t...
        pos = idx.searchsorted(t)
        if pos + 1 >= len(idx):
            break
        # ...y se entra al cierre SIGUIENTE: la decisión no puede usar el precio de entrada.
        entrada = idx[pos + 1]
        salida_pos = idx.searchsorted(entrada + timedelta(days=plazo_dias))
        if salida_pos >= len(idx) or idx[salida_pos] > limite:
            break
        ventana = t.date()  # fecha de la rejilla: igual para todos los activos
        t = t + timedelta(days=plazo_dias)
        if pos < min_historia:
            continue
        pasado = precios.iloc[: pos + 1]
        real = float(precios.iloc[salida_pos] / precios.iloc[pos + 1] - 1)
        pred = _call(predict, pasado, plazo_dias, es_cripto)
        d = decidir(pred, monto, plazo_dias, simbolo, hoy=idx[pos].date(), perfil=perfil,
                    tendencia=tendencia(pasado), params=params)
        # Fracción del monto que la app manda invertir (0 = efectivo, 1 = todo).
        frac = float(d["numeros"].get("fraccion", 1.0 if d["decision"] == INVERTIR else 0.0))
        filas.append({
            "ventana": ventana,
            "fecha": idx[pos].date(),
            "entrada": entrada.date(),
            "salida": idx[salida_pos].date(),
            "decision": d["decision"],
            "esperado": pred["rendimiento_esperado"],
            "real": real,
            "pnl_siempre": monto * real,
            "fraccion": frac,
            "pnl_app": frac * monto * real,
        })
    return pd.DataFrame(filas)


def resumen(df: pd.DataFrame, monto: float = 1000.0, plazo_dias: int = 30,
            perfil: str = "moderado") -> dict:
    """Métricas para el pitch.

    Compara tres estrategias con el mismo monto por ventana:
    - siempre: invertir todo en cada ventana (comprar y mantener).
    - app: invertir la fracción que dice la app; el resto en efectivo a 0 %.
    - misma exposición: invertir siempre la fracción PROMEDIO de la app. Si la
      app no le gana a esta, su valor está en el tamaño, no en el momento.
    """
    if df.empty:
        return {"ventanas": 0}
    anual = math.sqrt(365 / plazo_dias)
    exp_media = float(df["fraccion"].mean())
    r_siempre = df["pnl_siempre"] / monto
    r_app = df["pnl_app"] / monto
    r_const = exp_media * r_siempre
    tol = PEOR_CASO_ACEPTABLE[perfil]

    def sharpe(x: pd.Series) -> float:
        sd = x.std(ddof=1)
        return float(x.mean() / sd * anual) if len(x) > 1 and sd > 0 else float("nan")

    def caida_max(x: pd.Series) -> float:
        curva = (monto * x).cumsum()
        return float((curva - curva.cummax()).min())

    return {
        "ventanas": len(df),
        "exposicion_media": exp_media,
        "pnl_siempre": float(df["pnl_siempre"].sum()),
        "pnl_app": float(df["pnl_app"].sum()),
        "pnl_misma_exposicion": float(monto * r_const.sum()),
        "sharpe_siempre": sharpe(r_siempre),
        "sharpe_app": sharpe(r_app),
        "caida_max_siempre": caida_max(r_siempre),
        "caida_max_app": caida_max(r_app),
        "p5_siempre": float(r_siempre.quantile(0.05)),
        "p5_app": float(r_app.quantile(0.05)),
        # Ventanas en que la pérdida pasó la tolerancia del perfil. Debería ser ~5 %.
        "rebases_siempre": float((r_siempre < -tol).mean()),
        "rebases_app": float((r_app < -tol).mean()),
    }


def _fmt(x: float, kind: str) -> str:
    if isinstance(x, float) and math.isnan(x):
        return "-"
    if kind == "$":
        return f"-${-x:,.0f}" if x < 0 else f"${x:,.0f}"
    if kind == "%":
        return f"{x * 100:+.1f}%"
    if kind == "p":
        return f"{x:.0%}"
    return f"{x:.2f}"


def main(argv: list[str]) -> int:
    from data.assets import all_symbols
    from data.fetch import get_close, is_crypto

    ap = argparse.ArgumentParser(description="Backtest de la regla de decisión")
    ap.add_argument("simbolos", nargs="*", default=["SPY", "BTCUSDT", "WALMEX.MX"])
    ap.add_argument("--todos", action="store_true", help="todo el catálogo")
    ap.add_argument("--plazo", type=int, default=30)
    ap.add_argument("--anios", type=int, default=10)
    ap.add_argument("--monto", type=float, default=1000.0)
    ap.add_argument("--perfil", default="moderado", choices=["conservador", "moderado", "agresivo"])
    ap.add_argument("--modelo", default="baseline", choices=["baseline", "model"])
    ap.add_argument("--desde", default=None, help="fecha inicial, ej. 2022-01-01")
    ap.add_argument("--hasta", default=None, help="fecha final, ej. 2021-12-31")
    a = ap.parse_args(argv)

    predict, nombre = load_predictor(a.modelo)
    simbolos = all_symbols() if a.todos else a.simbolos
    print(f"Modelo: {nombre} | plazo {a.plazo} días | últimos {a.anios} años | "
          f"${a.monto:,.0f} por ventana | perfil {a.perfil}\n")
    cols = ["ventanas", "exposición", "P&L siempre", "P&L app", "P&L misma exp.",
            "Sharpe siempre", "Sharpe app", "caída máx siempre", "caída máx app",
            "rebases siempre", "rebases app"]
    print(" | ".join(["activo"] + cols))
    total_s = total_a = total_c = 0.0
    for s in simbolos:
        df = run(get_close(s), s, a.plazo, a.anios, a.monto, a.perfil, predict,
                 es_cripto=is_crypto(s), desde=a.desde, hasta=a.hasta)
        r = resumen(df, a.monto, a.plazo, a.perfil)
        if not r["ventanas"]:
            continue
        total_s += r["pnl_siempre"]
        total_a += r["pnl_app"]
        total_c += r["pnl_misma_exposicion"]
        print(" | ".join([
            s, str(r["ventanas"]), _fmt(r["exposicion_media"], "p"),
            _fmt(r["pnl_siempre"], "$"), _fmt(r["pnl_app"], "$"), _fmt(r["pnl_misma_exposicion"], "$"),
            _fmt(r["sharpe_siempre"], "x"), _fmt(r["sharpe_app"], "x"),
            _fmt(r["caida_max_siempre"], "$"), _fmt(r["caida_max_app"], "$"),
            _fmt(r["rebases_siempre"], "p"), _fmt(r["rebases_app"], "p"),
        ]))
    print(f"\nTotal P&L: siempre {_fmt(total_s, '$')} | app {_fmt(total_a, '$')} | misma exposición {_fmt(total_c, '$')}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
