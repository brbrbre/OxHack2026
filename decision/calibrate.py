"""Honest calibration of the decision rule's parameters.

Protocol:
1. A SMALL grid, fixed before seeing results: 6 settings.
   With about 6 years of training data, more trials would make the best result
   look good by pure luck (Bailey and López de Prado 2014).
2. One set of parameters for every asset (not one per asset).
3. Chosen on 2016-2021 (training) and tested on 2022 onwards.
4. Walk-forward: every January the choice is redone with all prior data.
5. Confidence interval by circular block bootstrap (Ledoit and Wolf 2008)
   and a placebo: random timings with the same average exposure.
6. Timing or sizing? Each asset at ITS average share in the test. If the app
   can't beat that, its edge comes from how much it puts in each asset, not when.

Each profile's tolerance (5%, 10%, 20%) is NOT calibrated: the person picks it.

Usage:
    python -m decision.calibrate                 # moderate profile, 30-day horizon
    python -m decision.calibrate --perfil agresivo
"""

from __future__ import annotations

import argparse
import itertools
import math
import sys

import numpy as np
import pandas as pd

from decision.backtest import _call, load_predictor, run

GRID = [
    {"exigir_expectativa_positiva": e, "freno_tendencia": f}
    for e, f in itertools.product([True, False], [1.0, 0.5, 0.0])
]
INICIO = "2016-01-01"
FIN_ENTRENAMIENTO = "2021-12-31"
INICIO_PRUEBA = "2022-01-01"


def nombre(cfg: dict) -> str:
    gate = "requires μ>0" if cfg["exigir_expectativa_positiva"] else "no μ filter"
    return f"{gate}, trend brake x{cfg['freno_tendencia']}"


def con_memoria(predict):
    """Caches each forecast so the 6 settings don't recompute it.

    The forecast depends only on prices up to the cut-off date and on the horizon;
    a setting changes the rule, not the model. With XGBoost this cuts the
    calibration from over an hour to a few minutes.
    """
    guardadas: dict = {}

    def predict_guardado(precios, plazo_dias, es_cripto=False):
        clave = (precios.name, precios.index[-1], len(precios), float(precios.iloc[-1]), plazo_dias, es_cripto)
        if clave not in guardadas:
            guardadas[clave] = _call(predict, precios, plazo_dias, es_cripto)
        return dict(guardadas[clave])

    return predict_guardado


def por_activo(simbolos, precios, es_cripto, cfg, predict, plazo, perfil) -> pd.DataFrame:
    """One row per asset and window, with the return of always investing and of the app."""
    filas = []
    for s in simbolos:
        df = run(precios[s], s, plazo_dias=plazo, perfil=perfil, predict=predict,
                 es_cripto=es_cripto[s], desde=INICIO, params=cfg)
        if df.empty:
            continue
        df["simbolo"] = s
        filas.append(df)
    todo = pd.concat(filas)
    todo["r_siempre"] = todo["pnl_siempre"] / 1000
    todo["r_app"] = todo["pnl_app"] / 1000
    return todo


def cartera(simbolos, precios, es_cripto, cfg, predict, plazo, perfil) -> pd.DataFrame:
    """Return per date of an equal-weight portfolio of the assets available."""
    return cartera_de(por_activo(simbolos, precios, es_cripto, cfg, predict, plazo, perfil))


def cartera_de(todo: pd.DataFrame) -> pd.DataFrame:
    g = todo.groupby("ventana")
    return pd.DataFrame({
        "r_siempre": g["r_siempre"].mean(),
        "r_app": g["r_app"].mean(),
        "exposicion": g["fraccion"].mean(),
        "activos": g.size(),
    }).sort_index()


def sharpe(x: pd.Series, plazo: int) -> float:
    sd = x.std(ddof=1)
    return float(x.mean() / sd * math.sqrt(365 / plazo)) if len(x) > 1 and sd > 0 else float("nan")


def caida_max(x: pd.Series) -> float:
    curva = x.cumsum()
    return float((curva - curva.cummax()).min())


def metricas(df: pd.DataFrame, plazo: int) -> dict:
    exp = float(df["exposicion"].mean())
    r_const = exp * df["r_siempre"]
    return {
        "ventanas": len(df),
        "exposicion": exp,
        "sharpe_siempre": sharpe(df["r_siempre"], plazo),
        "sharpe_app": sharpe(df["r_app"], plazo),
        "sharpe_misma_exp": sharpe(r_const, plazo),
        "suma_siempre": float(df["r_siempre"].sum()),
        "suma_app": float(df["r_app"].sum()),
        "suma_misma_exp": float(r_const.sum()),
        "caida_siempre": caida_max(df["r_siempre"]),
        "caida_app": caida_max(df["r_app"]),
        "caida_misma_exp": caida_max(r_const),
    }


def bootstrap_dif(df: pd.DataFrame, plazo: int, reps: int = 2000, bloque: int = 4, seed: int = 0):
    """90% interval of Sharpe(app) - Sharpe(same exposure), circular block bootstrap."""
    rng = np.random.default_rng(seed)
    a = df["r_app"].to_numpy()
    c = (df["exposicion"].mean() * df["r_siempre"]).to_numpy()
    n = len(a)
    k = math.ceil(n / bloque)
    difs = []
    for _ in range(reps):
        starts = rng.integers(0, n, k)
        ix = (starts[:, None] + np.arange(bloque)[None, :]).ravel()[:n] % n
        difs.append(sharpe(pd.Series(a[ix]), plazo) - sharpe(pd.Series(c[ix]), plazo))
    return float(np.nanpercentile(difs, 5)), float(np.nanpercentile(difs, 95))


def placebo(df: pd.DataFrame, plazo: int, reps: int = 1000, seed: int = 1) -> float:
    """Share of 'random timings' (same shares, shuffled dates) that match or beat the app."""
    rng = np.random.default_rng(seed)
    real = sharpe(df["r_app"], plazo)
    exp = df["exposicion"].to_numpy()
    r = df["r_siempre"].to_numpy()
    mejores = sum(sharpe(pd.Series(rng.permutation(exp) * r), plazo) >= real for _ in range(reps))
    return mejores / reps


def momento_vs_tamano(detalle: pd.DataFrame, plazo: int, reps: int = 1000, seed: int = 1) -> dict:
    """Separates timing (when it invests) from sizing (how much it puts in each asset).

    `detalle` has one row per asset and window (columns ventana, simbolo,
    fraccion, r_siempre, r_app). The app is compared with the same portfolio at
    each asset's average share over all its windows. That yardstick uses the
    whole-period average, so it is for measuring, not for trading.
    The placebo shuffles the share's dates within each asset.
    """
    d = detalle.reset_index(drop=True)
    fija = d.groupby("simbolo")["fraccion"].transform("mean") * d["r_siempre"]
    real = sharpe(d["r_app"].groupby(d["ventana"]).mean(), plazo)
    tamano = sharpe(fija.groupby(d["ventana"]).mean(), plazo)
    rng = np.random.default_rng(seed)
    grupos = list(d.groupby("simbolo").indices.values())
    frac = d["fraccion"].to_numpy()
    r = d["r_siempre"].to_numpy()
    barajada = np.empty_like(frac)
    mejores = 0
    for _ in range(reps):
        for ix in grupos:
            barajada[ix] = frac[rng.permutation(ix)]
        mejores += sharpe(pd.Series(barajada * r).groupby(d["ventana"]).mean(), plazo) >= real - 1e-12
    return {"sharpe_app": real, "sharpe_tamano": tamano, "placebo": mejores / reps}


def main(argv: list[str]) -> int:
    from data.assets import all_symbols
    from data.fetch import get_close, is_crypto

    ap = argparse.ArgumentParser(description="Calibration of the decision rule")
    ap.add_argument("--perfil", default="moderado", choices=["conservador", "moderado", "agresivo"])
    ap.add_argument("--plazo", type=int, default=30)
    ap.add_argument("--modelo", default="baseline", choices=["baseline", "model"])
    a = ap.parse_args(argv)

    predict, nombre_modelo = load_predictor(a.modelo)
    predict = con_memoria(predict)
    simbolos = all_symbols()
    precios = {s: get_close(s) for s in simbolos}
    cripto = {s: is_crypto(s) for s in simbolos}
    detalles = {i: por_activo(simbolos, precios, cripto, cfg, predict, a.plazo, a.perfil)
                for i, cfg in enumerate(GRID)}
    carteras = {i: cartera_de(d) for i, d in detalles.items()}

    print(f"Model: {nombre_modelo} | profile {a.perfil} | horizon {a.plazo} days | "
          f"{len(simbolos)} assets, equal weight | {len(GRID)} settings tried\n")

    print("1) TRAINING 2016-2021 (annual portfolio Sharpe)")
    entrenamiento = {}
    for i, cfg in enumerate(GRID):
        df = carteras[i][carteras[i].index <= pd.Timestamp(FIN_ENTRENAMIENTO).date()]
        entrenamiento[i] = sharpe(df["r_app"], a.plazo)
        print(f"   [{i}] {nombre(cfg):<40} Sharpe {entrenamiento[i]:.2f}  exposure {df['exposicion'].mean():.0%}")
    elegida = max(entrenamiento, key=entrenamiento.get)
    print(f"   Chosen: [{elegida}] {nombre(GRID[elegida])}\n")

    prueba = carteras[elegida][carteras[elegida].index >= pd.Timestamp(INICIO_PRUEBA).date()]
    m = metricas(prueba, a.plazo)
    print(f"2) TEST {INICIO_PRUEBA[:4]}-today with the chosen setting ({m['ventanas']} windows, mean exposure {m['exposicion']:.0%})")
    print(f"   {'':<22}{'always invest':>18}{'app':>10}{'same exposure':>18}")
    print(f"   {'Annual Sharpe':<22}{m['sharpe_siempre']:>18.2f}{m['sharpe_app']:>10.2f}{m['sharpe_misma_exp']:>18.2f}")
    print(f"   {'Sum of window returns':<22}{m['suma_siempre']:>18.1%}{m['suma_app']:>10.1%}{m['suma_misma_exp']:>18.1%}")
    print(f"   {'Max drawdown':<22}{m['caida_siempre']:>18.1%}{m['caida_app']:>10.1%}{m['caida_misma_exp']:>18.1%}")
    lo, hi = bootstrap_dif(prueba, a.plazo)
    print(f"   Sharpe app - same exposure: {m['sharpe_app'] - m['sharpe_misma_exp']:+.2f}  "
          f"(90% bootstrap interval: {lo:+.2f} to {hi:+.2f})")
    print(f"   Placebo: {placebo(prueba, a.plazo):.0%} of random timings with the same exposure match or beat the app")
    d = detalles[elegida]
    mt = momento_vs_tamano(d[d["ventana"] >= pd.Timestamp(INICIO_PRUEBA).date()], a.plazo)
    print(f"   Timing or sizing? Sharpe app {mt['sharpe_app']:.2f} vs each asset at its average share "
          f"{mt['sharpe_tamano']:.2f} (timing {mt['sharpe_app'] - mt['sharpe_tamano']:+.2f})")
    print(f"   Per-asset placebo: {mt['placebo']:.0%} of dates shuffled within each asset match or beat the app\n")

    print("3) TEST YEAR BY YEAR (portfolio return: always / app)")
    fechas = pd.to_datetime(pd.Series(prueba.index, index=prueba.index))
    for anio, df in prueba.groupby(fechas.dt.year.values):
        print(f"   {anio}: {df['r_siempre'].sum():+7.1%} / {df['r_app'].sum():+7.1%}  (exposure {df['exposicion'].mean():.0%})")

    print("\n4) WALK-FORWARD (each January the setting is chosen with all prior data)")
    trozos = []
    for anio in range(2019, pd.Timestamp.today().year + 1):
        corte = pd.Timestamp(f"{anio}-01-01").date()
        mejor = max(range(len(GRID)), key=lambda i: sharpe(carteras[i][carteras[i].index < corte]["r_app"], a.plazo))
        df = carteras[mejor][(carteras[mejor].index >= corte) & (carteras[mejor].index < pd.Timestamp(f"{anio + 1}-01-01").date())]
        trozos.append(df)
        print(f"   {anio}: chooses [{mejor}] {nombre(GRID[mejor])}")
    wf = pd.concat(trozos)
    mw = metricas(wf, a.plazo)
    print(f"   Result 2019-today: Sharpe app {mw['sharpe_app']:.2f} | always {mw['sharpe_siempre']:.2f} | "
          f"same exposure {mw['sharpe_misma_exp']:.2f} | max drawdown app {mw['caida_app']:.1%} vs always {mw['caida_siempre']:.1%}")

    print(f"\nLimitations: cash earns 0%; no trading costs; the {len(simbolos)} assets were picked in 2026 "
          "(survivorship bias); the Fed calendar does not exist before October 2026.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
