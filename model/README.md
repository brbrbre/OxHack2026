# model/ - modelos de predicción (Brisma y Felipe)

## Qué modelo usa la app

- **Principal: tendencia + TDA de Brisma** (`predict_tda.py`, NOMBRE `tendencia-tda`). Momentum de 1, 3, 6 y 12 meses, más la homología persistente H0 de un embedding de Takens de los últimos 63 rendimientos, con colas empíricas. Se entrena en `modelo_regresion_tda.ipynb`; la app usa `params_tda.json` (entrenado con toda la historia).
- **Respaldo: XGBoost de Felipe** (`predict_xgboost.py`). Se activa con `MODELO=xgboost`.
- `predict.py` solo elige entre los dos.

Para medir sin ver el futuro se usa `params_tda_hasta_2021.json`, entrenado con el mismo notebook hasta nov 2021 (`python -m model.entrenar_tda_corte`):

```bash
TDA_PARAMS=model/params_tda_hasta_2021.json python -m decision.evaluate_forecasts --desde 2022-01-01 --modelo model
TDA_PARAMS=model/params_tda_hasta_2021.json python -m decision.calibrate --modelo model --perfil moderado
```

Con `params_tda.json` esos números quedarían dentro de la muestra: no se reportan. El walk-forward 2019-hoy de calibrate tampoco, porque 2019-2021 cae dentro del entrenamiento.

## Contrato con el resto del equipo

```python
predict(precios: pd.Series, plazo_dias: int) -> dict
# {
#   "rendimiento_esperado": float,   # para el plazo, ej. 0.012 = +1.2 %
#   "volatilidad": float,            # desviación estándar del rendimiento en el plazo
#   "prob_perdida": float,           # 0 a 1
#   "intervalo": (float, float),     # rendimiento bajo y alto, ej. al 90 %
# }
```

`precios` son cierres diarios con fecha como índice. El contrato no cambia sin avisar a todos.

## Cómo se conecta con la app

Pongan la función en `model/predict.py` con `NOMBRE = "nombre-de-su-modelo"`. El API la usa sola en cuanto existe; mientras no, usa `api/baseline.py`.
Opcional: si `predict` acepta `es_cripto: bool = False`, el API le avisa cuándo el activo cotiza 365 días al año en lugar de 252.

## Validación

- En orden de tiempo, con ventanas que avanzan. Nunca mezclando fechas al azar.
- Contra baselines: rendimiento cero, promedio histórico y volatilidad histórica simple.

Listo cuando: `python -m model.evaluate SPY` imprime el error del modelo y del baseline.

## Si usan XGBoost (o cualquier modelo de ML)

1. **Solo con los precios que reciben.** `predict` entrena y predice con `precios`, que ya viene cortado en la fecha de decisión. Nunca lean `data/cache` ni llamen a `data.fetch` adentro: eso mete el futuro en el backtest.
2. **Cuidado con las etiquetas.** Si la etiqueta es el rendimiento de los siguientes `h` días, las últimas `h` filas no tienen etiqueta todavía. Se descartan para entrenar; si no, el modelo ve el futuro.
3. **Variables solo del pasado:** rendimientos de 1, 3, 6 y 12 meses (la evidencia de tendencia está en ese rango), volatilidad reciente (EWMA), distancia a máximos, etc.
4. **Cómo sacar lo que pide el contrato:**
   - `intervalo`: regresión por cuantiles con `objective="reg:quantileerror"` y `quantile_alpha=[0.05, 0.5, 0.95]`. Probado en la Mac de Rocco con XGBoost 3.4.1.
   - `rendimiento_esperado`: la mediana (cuantil 0.5) o una regresión normal.
   - `prob_perdida`: un `XGBClassifier` con etiqueta "rendimiento < 0", o la proporción de cuantiles bajo cero.
   - `volatilidad`: `(q95 - q05) / 3.29`.
5. **Rápido:** el backtest llama a `predict` unas 1,200 veces. Con `n_estimators` de 100-200 y `max_depth` 3 debería tardar menos de 1 s por llamada.
6. **Determinista:** fijen `random_state`.

`tests/test_model_contract.py` revisa todo esto en cuanto exista `model/predict.py`: `python -m pytest -q tests/test_model_contract.py`.

Para saber si su modelo sirve:

```bash
python -m decision.evaluate_forecasts --desde 2022-01-01 --modelo model   # meta: skill > 0, IC > 0, cobertura ~90 %
python -m decision.calibrate --modelo model                               # ¿le gana a la misma exposición?
```

Mac sin Homebrew: si `import xgboost` falla por `libomp.dylib`, corran `sh scripts/mac_xgboost_openmp.sh`.
