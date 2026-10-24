"""Calibración honesta de los parámetros de la regla de decisión.

Protocolo (detalle y fuentes en la investigación del equipo):
1. Rejilla CHICA y fija antes de ver resultados: 6 configuraciones.
   Con ~6 años de entrenamiento, más pruebas harían que el mejor resultado
   salga bueno por pura suerte (Bailey y López de Prado 2014).
2. Un solo juego de parámetros para todos los activos (no uno por activo).
3. Se elige con 2016-2021 (entrenamiento) y se prueba con 2022 en adelante.
4. Walk-forward: cada enero se vuelve a elegir con todo lo anterior.
5. Intervalo de confianza por bootstrap de bloques circular (Ledoit y Wolf 2008)
   y un placebo: decidir al azar con la misma exposición promedio.

La tolerancia de cada perfil (5 %, 10 %, 20 %) NO se calibra: la elige la persona.

Uso:
    python -m decision.calibrate                 # perfil moderado, plazo 30
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
    gate = "exige μ>0" if cfg["exigir_expectativa_positiva"] else "sin filtro μ"
    return f"{gate}, freno tendencia x{cfg['freno_tendencia']}"


def con_memoria(predict):
    """Guarda cada predicción para no repetirla en las 6 configuraciones.

    La predicción depende solo de los precios hasta la fecha de corte y del plazo;
    la configuración cambia la regla, no el modelo. Con XGBoost esto baja la
    calibración de más de una hora a unos minutos.
    """
    guardadas: dict = {}

    def predict_guardado(precios, plazo_dias, es_cripto=False):
        clave = (precios.name, precios.index[-1], len(precios), float(precios.iloc[-1]), plazo_dias, es_cripto)
        if clave not in guardadas:
            guardadas[clave] = _call(predict, precios, plazo_dias, es_cripto)
        return dict(guardadas[clave])

    return predict_guardado


def cartera(simbolos, precios, es_cripto, cfg, predict, plazo, perfil) -> pd.DataFrame:
    """Rendimiento por fecha de una cartera con el mismo peso en cada activo disponible."""
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
    """IC 90 % de Sharpe(app) - Sharpe(misma exposición), bootstrap de bloques circular."""
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
    """Qué parte de los 'timings al azar' (mismas fracciones, fechas barajadas) supera a la app."""
    rng = np.random.default_rng(seed)
    real = sharpe(df["r_app"], plazo)
    exp = df["exposicion"].to_numpy()
    r = df["r_siempre"].to_numpy()
    mejores = sum(sharpe(pd.Series(rng.permutation(exp) * r), plazo) >= real for _ in range(reps))
    return mejores / reps


def main(argv: list[str]) -> int:
    from data.assets import all_symbols
    from data.fetch import get_close, is_crypto

    ap = argparse.ArgumentParser(description="Calibración de la regla de decisión")
    ap.add_argument("--perfil", default="moderado", choices=["conservador", "moderado", "agresivo"])
    ap.add_argument("--plazo", type=int, default=30)
    ap.add_argument("--modelo", default="baseline", choices=["baseline", "model"])
    a = ap.parse_args(argv)

    predict, nombre_modelo = load_predictor(a.modelo)
    predict = con_memoria(predict)
    simbolos = all_symbols()
    precios = {s: get_close(s) for s in simbolos}
    cripto = {s: is_crypto(s) for s in simbolos}
    carteras = {i: cartera(simbolos, precios, cripto, cfg, predict, a.plazo, a.perfil)
                for i, cfg in enumerate(GRID)}

    print(f"Modelo: {nombre_modelo} | perfil {a.perfil} | plazo {a.plazo} días | "
          f"{len(simbolos)} activos, mismo peso | {len(GRID)} configuraciones probadas\n")

    print("1) ENTRENAMIENTO 2016-2021 (Sharpe anual de la cartera)")
    entrenamiento = {}
    for i, cfg in enumerate(GRID):
        df = carteras[i][carteras[i].index <= pd.Timestamp(FIN_ENTRENAMIENTO).date()]
        entrenamiento[i] = sharpe(df["r_app"], a.plazo)
        print(f"   [{i}] {nombre(cfg):<40} Sharpe {entrenamiento[i]:.2f}  exposición {df['exposicion'].mean():.0%}")
    elegida = max(entrenamiento, key=entrenamiento.get)
    print(f"   Elegida: [{elegida}] {nombre(GRID[elegida])}\n")

    prueba = carteras[elegida][carteras[elegida].index >= pd.Timestamp(INICIO_PRUEBA).date()]
    m = metricas(prueba, a.plazo)
    print(f"2) PRUEBA {INICIO_PRUEBA[:4]}-hoy con la elegida ({m['ventanas']} ventanas, exposición media {m['exposicion']:.0%})")
    print(f"   {'':<22}{'invertir siempre':>18}{'app':>10}{'misma exposición':>18}")
    print(f"   {'Sharpe anual':<22}{m['sharpe_siempre']:>18.2f}{m['sharpe_app']:>10.2f}{m['sharpe_misma_exp']:>18.2f}")
    print(f"   {'Suma rend. ventanas':<22}{m['suma_siempre']:>18.1%}{m['suma_app']:>10.1%}{m['suma_misma_exp']:>18.1%}")
    print(f"   {'Caída máxima':<22}{m['caida_siempre']:>18.1%}{m['caida_app']:>10.1%}{m['caida_misma_exp']:>18.1%}")
    lo, hi = bootstrap_dif(prueba, a.plazo)
    print(f"   Sharpe app - misma exposición: {m['sharpe_app'] - m['sharpe_misma_exp']:+.2f}  "
          f"(IC 90 % bootstrap: {lo:+.2f} a {hi:+.2f})")
    print(f"   Placebo: {placebo(prueba, a.plazo):.0%} de los timings al azar con la misma exposición igualan o superan a la app\n")

    print("3) PRUEBA AÑO POR AÑO (rend. de la cartera: siempre / app)")
    fechas = pd.to_datetime(pd.Series(prueba.index, index=prueba.index))
    for anio, df in prueba.groupby(fechas.dt.year.values):
        print(f"   {anio}: {df['r_siempre'].sum():+7.1%} / {df['r_app'].sum():+7.1%}  (exposición {df['exposicion'].mean():.0%})")

    print("\n4) WALK-FORWARD (cada enero se elige con todo lo anterior)")
    trozos = []
    for anio in range(2019, pd.Timestamp.today().year + 1):
        corte = pd.Timestamp(f"{anio}-01-01").date()
        mejor = max(range(len(GRID)), key=lambda i: sharpe(carteras[i][carteras[i].index < corte]["r_app"], a.plazo))
        df = carteras[mejor][(carteras[mejor].index >= corte) & (carteras[mejor].index < pd.Timestamp(f"{anio + 1}-01-01").date())]
        trozos.append(df)
        print(f"   {anio}: elige [{mejor}] {nombre(GRID[mejor])}")
    wf = pd.concat(trozos)
    mw = metricas(wf, a.plazo)
    print(f"   Resultado 2019-hoy: Sharpe app {mw['sharpe_app']:.2f} | siempre {mw['sharpe_siempre']:.2f} | "
          f"misma exposición {mw['sharpe_misma_exp']:.2f} | caída máx app {mw['caida_app']:.1%} vs siempre {mw['caida_siempre']:.1%}")

    print(f"\nLimitaciones: el efectivo rinde 0 %; sin comisiones; los {len(simbolos)} activos se eligieron en 2026 "
          "(sesgo de supervivencia); el calendario de la Fed no existe antes de oct 2026.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
