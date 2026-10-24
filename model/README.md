# model/ - the hand-built model (Felipe and Brisma)

Forecasting written with NumPy and pandas, without ML libraries.

## Contract with the rest of the team

```python
predict(precios: pd.Series, plazo_dias: int) -> dict
# {
#   "rendimiento_esperado": float,   # for the horizon, e.g. 0.012 = +1.2 %
#   "volatilidad": float,            # standard deviation of the return over the horizon
#   "prob_perdida": float,           # 0 to 1
#   "intervalo": (float, float),     # low and high return, e.g. at 90 %
# }
```

`precios` are daily closes with the date as index. The contract does not change without telling everyone.

## How it connects to the app

Put the function in `model/predict.py` with `NOMBRE = "your-model-name"`. The API picks it up on its own as soon as it exists; until then it uses `api/baseline.py`.
Optional: if `predict` accepts `es_cripto: bool = False`, the API tells it when the asset trades 365 days a year instead of 252.

## Validation

- In time order, with rolling windows. Never shuffling dates at random.
- Against baselines: zero return, historical average and simple historical volatility.

Done when: `python -m model.evaluate SPY` prints the error of the model and of the baseline.
