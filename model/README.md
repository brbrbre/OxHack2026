# model/ - prediction models (Brisma and Felipe)

## Which model the app uses

- **Main: Trend + TDA, by Brisma** (`predict_tda.py`, name `tendencia-tda`). Momentum over 1, 3, 6 and 12 months, plus the H0 persistent homology of a Takens embedding of the last 63 returns, with empirical tails. Trained in `modelo_regresion_tda.ipynb`; the app uses `params_tda.json` (trained on all history).
- **Backup: XGBoost, by Felipe** (`predict_xgboost.py`). Switch to it with `MODELO=xgboost`.
- `predict.py` only picks between the two.

To measure without seeing the future, use `params_tda_hasta_2021.json`, trained with the same notebook up to November 2021 (`python -m model.entrenar_tda_corte`):

```bash
TDA_PARAMS=model/params_tda_hasta_2021.json python -m decision.evaluate_forecasts --desde 2022-01-01 --modelo model
TDA_PARAMS=model/params_tda_hasta_2021.json python -m decision.calibrate --modelo model --perfil moderado
```

With `params_tda.json` those numbers would be in sample, so we don't report them. Nor do we report the 2019-2021 part of the walk-forward for Trend + TDA, since it falls inside its training data.

## Contract with the rest of the code

```python
predict(precios: pd.Series, plazo_dias: int) -> dict
# {
#   "rendimiento_esperado": float,   # expected return over the horizon, e.g. 0.012 = +1.2%
#   "volatilidad": float,            # standard deviation of the return over the horizon
#   "prob_perdida": float,           # chance of loss, 0 to 1
#   "intervalo": (float, float),     # low and high return of the 90% interval
# }
```

`precios` are daily closes indexed by date.
Optional: if `predict` accepts `es_cripto: bool = False`, the API tells it when the asset trades 365 days a year instead of 252.

## Validation rules

- Time order with moving windows. Never shuffle dates.
- Compare against baselines: zero return, historical mean and simple historical volatility.
- Only use the prices passed in. `predict` gets `precios` already cut at the decision date. Never read `data/cache` or call `data.fetch` inside it: that leaks the future into the backtest.
- With labels like "return over the next `h` days", drop the last `h` rows when training; they have no label yet.
- Fix `random_state` so results repeat.

`tests/test_model_contract.py` checks the contract: `python -m pytest -q tests/test_model_contract.py`.

## Notebooks (Brisma)

- `modelo_regresion_tda.ipynb`: trains Trend + TDA and writes `params_tda.json`. This is the one the app depends on.
- `modelo_retorno_riesgo.ipynb`, `modelo_clasificacion.ipynb` and `modelo_completo (1).ipynb`: earlier models Brisma compared before choosing Trend + TDA (return and risk regression, a loss classifier, and the combined run). Their out-of-sample metrics are in `notebooks/outputs/`.
- `entrenar_tda_corte.py`: re-trains Trend + TDA with data up to November 2021 for the honest test.

## Results

Out of sample (trained to 2021, tested 2022 to today), Trend + TDA is the only one of the three models that beats the naive chance of loss, and its 90% range caught 90% of real outcomes. Full tables: root `README.md` and `decision/README.md`.

Mac without Homebrew: if `import xgboost` fails on `libomp.dylib`, run `sh scripts/mac_xgboost_openmp.sh`.
