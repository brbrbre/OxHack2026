# tiger/ - precios y predicciones calificadas en Tiger Data (Rocco)

Tiger Data es Postgres con TimescaleDB. Aquí guarda dos hypertables:

- `precios`: cierres diarios de los 21 activos, más la vista continua `precios_semanales` (time_bucket de 7 días).
- `predicciones`: cada predicción con su intervalo, su probabilidad de pérdida, la fracción que dijo la app y, cuando pasa el plazo, el rendimiento real.

Comandos (necesitan `TIGER_DATABASE_URL` en `.env`):

```bash
python -m tiger.cargar               # esquema + precios + backtest del modelo (30 días, desde 2022), ya calificado
python -m tiger.cargar --calificar   # pone el resultado real a las predicciones en vivo cuyo plazo ya pasó
python -m tiger.reporte              # calificación por semestre, calculada en Tiger con time_bucket
python -m tiger.reporte --origen live
```

La API guarda cada respuesta de `/api/decide` como predicción `live`, en un hilo aparte: si Tiger falla, la respuesta no cambia. Sin la URL, nada de esto corre.
