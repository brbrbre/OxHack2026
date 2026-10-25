# tiger/ - prices and graded predictions in Tiger Data

Tiger Data is Postgres with TimescaleDB. Horizon keeps two hypertables there:

- `precios`: daily closes of the 21 assets, plus the continuous aggregate `precios_semanales` (a 7-day `time_bucket`).
- `predicciones`: every prediction with its interval, its chance of loss, the share the app suggested and, once the horizon has passed, the real return.

Commands (they need `TIGER_DATABASE_URL` in `.env`):

```bash
python -m tiger.cargar               # schema + prices + the model's backtest (30 days, from 2022), already graded
python -m tiger.cargar --calificar   # adds the real outcome to live predictions whose horizon has passed
python -m tiger.reporte              # grades by half-year, computed inside Tiger with time_bucket
python -m tiger.reporte --origen live
```

The API stores every `/api/decide` answer as a `live` prediction, in a background thread: if Tiger fails, the answer doesn't change. Without the URL, none of this runs.
