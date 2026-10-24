# model/ - el modelo a mano (Felipe y Brisma)

Predicción escrita con NumPy y pandas, sin librerías de ML.

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

## Validación

- En orden de tiempo, con ventanas que avanzan. Nunca mezclando fechas al azar.
- Contra baselines: rendimiento cero, promedio histórico y volatilidad histórica simple.

Listo cuando: `python -m model.evaluate SPY` imprime el error del modelo y del baseline.
