"""Re-trains the TDA model on data up to a cut-off date, with the code from Brisma's notebook.

It doesn't copy the code: it reads and runs the cells of model/modelo_regresion_tda.ipynb (load, signals,
build and fit) and only changes which dates it trains on. So the 2022-today backtest can't see the future.

Usage:
    python -m model.entrenar_tda_corte --hasta 2022-01-01   # writes model/params_tda_hasta_2021.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

NOTEBOOK = Path(__file__).with_name("modelo_regresion_tda.ipynb")


def _celdas() -> str:
    nb = json.loads(NOTEBOOK.read_text())
    src = ["".join(c["source"]) for c in nb["cells"]]
    carga = src[2].replace("import numpy as np, pandas as pd, matplotlib.pyplot as plt", "import numpy as np, pandas as pd")
    senales = src[5].split("# Visual example")[0]   # functions, without the chart
    ajuste = src[11].split('MODELS = ["Zero"]')[0]   # DESIGNS, FINAL and fit, without the walk-forward
    return "\n".join([carga, src[3], senales, src[7], ajuste])


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Re-train the TDA model up to a date")
    ap.add_argument("--hasta", default="2022-01-01", help="first day NOT included (the test starts here)")
    ap.add_argument("--salida", default=str(Path(__file__).with_name("params_tda_hasta_2021.json")))
    a = ap.parse_args(argv)
    ns: dict = {}
    exec(compile(_celdas(), str(NOTEBOOK), "exec"), ns)
    ds, H = ns["dataset"], ns["H"]
    # A 2H+2-day gap as in the notebook: the label looks H sessions ahead.
    train = ds[ds.date < pd.Timestamp(a.hasta) - pd.Timedelta(days=2 * H + 2)]
    diseno = ns["DESIGNS"][ns["FINAL"]]
    w = ns["fit"](diseno, train)
    res = np.sort(train.z.values - diseno(train) @ w)
    n = 2000
    params = {"model": ns["FINAL"], "H": H, "lambda": ns["LAMBDA"], "tda_window": ns["TDA_WINDOW"],
              "tda_dim": ns["TDA_DIM"], "coef": w.tolist(),
              "quantiles": np.quantile(res, (np.arange(n) + 0.5) / n).tolist(),
              "trained_until": str(train.date.max().date())}
    Path(a.salida).write_text(json.dumps(params))
    print(f"Trained up to {params['trained_until']} on {len(train):,} rows -> {a.salida}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
