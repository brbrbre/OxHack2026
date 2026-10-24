"""¿Las predicciones dicen la verdad? Evalúa el pronóstico, no la decisión.

Sirve para cualquier predictor (el baseline hoy, el modelo del equipo después).
Usa las mismas ventanas que el backtest: el modelo solo ve el pasado.

Qué mide:
- Cobertura del intervalo del 90 %: el precio real debería caer dentro 90 % de
  las veces, y abajo del extremo bajo solo 5 %. De ese extremo depende cuánto
  invierte la app.
- Brier de prob_perdida: error cuadrático de la probabilidad de pérdida contra
  lo que pasó (0 = perfecto). Se compara con un pronóstico ingenuo: la
  frecuencia histórica de pérdidas hasta ese día. Skill > 0 = mejor que el ingenuo.
- Tabla de calibración: cuando el modelo dice 40 %, ¿se pierde 40 % de las veces?
- IC de rango (Spearman) entre rendimiento esperado y real: ¿ordena bien?

Uso:
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
        # Pronóstico ingenuo: frecuencia de pérdida de las ventanas de este plazo hasta la fecha.
        p = precios[s]
        # Mismo plazo en sesiones: cripto cotiza 365 días al año, lo demás ~252.
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

    ap = argparse.ArgumentParser(description="Evaluación de los pronósticos")
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
    print(f"Modelo: {nombre} | plazo {a.plazo} días | desde {a.desde} | {m['ventanas']} ventanas en {len(simbolos)} activos\n")
    print("1) INTERVALO DEL 90 %  (meta: 90 % dentro, 5 % abajo, 5 % arriba)")
    print(f"   dentro {m['cobertura_90']:.0%} | abajo del extremo bajo {m['abajo_del_bajo']:.0%} | arriba del alto {m['arriba_del_alto']:.0%}\n")
    print("2) PROBABILIDAD DE PÉRDIDA")
    print(f"   Brier modelo {m['brier']:.3f} | Brier ingenuo (frecuencia histórica) {m['brier_ingenuo']:.3f} | "
          f"skill {m['skill']:+.1%}  (>0 = mejor que el ingenuo)")
    print(f"   Frecuencia real de pérdida en estas ventanas: {m['frec_perdida']:.0%}\n")
    print("   Calibración: cuando el modelo dice X, ¿se perdió X de las veces?")
    cal = calibracion(df)
    for rango, r in cal.iterrows():
        print(f"   {str(rango):<14} {int(r['ventanas']):>4} ventanas | dice {r['dice']:.0%} | pasó {r['pasó']:.0%}")
    print(f"\n3) ORDEN: IC de rango esperado vs real = {m['ic_rango']:+.3f}  (0 = no ordena, 1 = perfecto)\n")

    print("4) POR ACTIVO (dentro del intervalo | abajo del bajo | skill Brier | IC)")
    for s, g in df.groupby("simbolo", sort=False):
        mm = metricas(g)
        print(f"   {s:<12} {mm['cobertura_90']:>4.0%} | {mm['abajo_del_bajo']:>4.0%} | {mm['skill']:>+7.1%} | {mm['ic_rango']:+.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
