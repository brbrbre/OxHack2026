"""Do the forecasts tell the truth? Evaluates the forecast, not the decision.

Works for any predictor (the baseline, Trend + TDA, XGBoost).
Uses the same windows as the backtest: the model only sees the past.

What it measures:
- Coverage of the 90% interval: the real return should fall inside 90% of the
  time, and below the low end only 5%. How much the app invests depends on
  that low end.
- Brier score of prob_perdida: squared error of the chance of loss against
  what happened (0 = perfect). Compared with a naive forecast: the historical
  loss frequency up to that day. Skill > 0 = better than naive.
- Calibration table: when the model says 40%, is there a loss 40% of the time?
- Rank correlation (Spearman) between expected and real return: does it order well?

Usage:
    python -m decision.evaluate_forecasts --desde 2022-01-01
    python -m decision.evaluate_forecasts --desde 2022-01-01 --modelo model
"""

from __future__ import annotations

import argparse
import sys

import pandas as pd

from decision.backtest import load_predictor, run

BINS = [0.0, 0.3, 0.4, 0.5, 0.6, 1.0]


def ventanas(simbolos, precios, es_cripto, predict, plazo, desde, hasta=None) -> pd.DataFrame:
    filas = []
    for s in simbolos:
        df = run(precios[s], s, plazo_dias=plazo, predict=predict, es_cripto=es_cripto[s],
                 desde=desde, hasta=hasta)
        if df.empty:
            continue
        df["simbolo"] = s
        # Naive forecast: loss frequency of windows of this horizon up to the date.
        p = precios[s]
        # Same horizon in sessions: crypto trades 365 days a year, the rest about 252.
        k = plazo if es_cripto[s] else round(plazo * 252 / 365)
        r_hist = (p / p.shift(k) - 1).dropna()
        ingenuo = []
        for f in pd.to_datetime(df["fecha"]):
            r = r_hist[r_hist.index <= f]
            ingenuo.append(float((r < 0).mean()) if len(r) else 0.5)
        df["p_ingenuo"] = ingenuo
        filas.append(df)
    return pd.concat(filas, ignore_index=True)


def metricas(df: pd.DataFrame) -> dict:
    perdio = (df["real"] < 0).astype(float)
    brier = float(((df["prob_perdida"] - perdio) ** 2).mean())
    brier_ing = float(((df["p_ingenuo"] - perdio) ** 2).mean())
    ic = df[["esperado", "real"]].rank().corr().iloc[0, 1]
    return {
        "ventanas": len(df),
        "cobertura_90": float(((df["real"] >= df["bajo"]) & (df["real"] <= df["alto"])).mean()),
        "abajo_del_bajo": float((df["real"] < df["bajo"]).mean()),
        "arriba_del_alto": float((df["real"] > df["alto"]).mean()),
        "brier": brier,
        "brier_ingenuo": brier_ing,
        "skill": 1 - brier / brier_ing if brier_ing > 0 else float("nan"),
        "ic_rango": float(ic),
        "frec_perdida": float(perdio.mean()),
    }


def calibracion(df: pd.DataFrame) -> pd.DataFrame:
    g = df.assign(perdio=(df["real"] < 0).astype(float),
                  rango=pd.cut(df["prob_perdida"], BINS, include_lowest=True)).groupby("rango", observed=True)
    return pd.DataFrame({"ventanas": g.size(), "dice": g["prob_perdida"].mean(), "pasó": g["perdio"].mean()})


def main(argv: list[str]) -> int:
    from data.assets import all_symbols
    from data.fetch import get_close, is_crypto

    ap = argparse.ArgumentParser(description="Forecast evaluation")
    ap.add_argument("--desde", default="2022-01-01")
    ap.add_argument("--hasta", default=None)
    ap.add_argument("--plazo", type=int, default=30)
    ap.add_argument("--modelo", default="baseline", choices=["baseline", "model"])
    a = ap.parse_args(argv)

    predict, nombre = load_predictor(a.modelo)
    simbolos = all_symbols()
    precios = {s: get_close(s) for s in simbolos}
    cripto = {s: is_crypto(s) for s in simbolos}
    df = ventanas(simbolos, precios, cripto, predict, a.plazo, a.desde, a.hasta)

    m = metricas(df)
    print(f"Model: {nombre} | horizon {a.plazo} days | from {a.desde} | {m['ventanas']} windows across {len(simbolos)} assets\n")
    print("1) 90% INTERVAL  (target: 90% inside, 5% below, 5% above)")
    print(f"   inside {m['cobertura_90']:.0%} | below the low end {m['abajo_del_bajo']:.0%} | above the high end {m['arriba_del_alto']:.0%}\n")
    print("2) CHANCE OF LOSS")
    print(f"   Brier model {m['brier']:.3f} | Brier naive (historical frequency) {m['brier_ingenuo']:.3f} | "
          f"skill {m['skill']:+.1%}  (>0 = better than naive)")
    print(f"   Real loss frequency in these windows: {m['frec_perdida']:.0%}\n")
    print("   Calibration: when the model says X, was there a loss X of the time?")
    cal = calibracion(df)
    for rango, r in cal.iterrows():
        print(f"   {str(rango):<14} {int(r['ventanas']):>4} windows | says {r['dice']:.0%} | happened {r['pasó']:.0%}")
    print(f"\n3) ORDER: rank correlation, expected vs real = {m['ic_rango']:+.3f}  (0 = no order, 1 = perfect)\n")

    print("4) PER ASSET (inside the interval | below the low end | Brier skill | rank corr.)")
    for s, g in df.groupby("simbolo", sort=False):
        mm = metricas(g)
        print(f"   {s:<12} {mm['cobertura_90']:>4.0%} | {mm['abajo_del_bajo']:>4.0%} | {mm['skill']:>+7.1%} | {mm['ic_rango']:+.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
