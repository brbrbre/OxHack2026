# data/ - precios y caché (Rocco)

Baja precios diarios y los guarda en `cache/`, para que la app no llame a internet en cada clic.

## Cómo se usa

```python
from data.fetch import get_close, get_prices
from data.assets import ASSETS, all_symbols, label

precios = get_close("SPY")     # pd.Series de cierres diarios; es lo que recibe model.predict()
velas = get_prices("BTCUSDT")  # DataFrame: open, high, low, close, volume
```

`get_close` y `get_prices` leen la caché. Solo bajan de internet si el símbolo no está, o con `refresh=True`.

Para bajar o actualizar todo antes de una sesión:

```bash
python -m data.fetch SPY BTCUSDT WALMEX.MX      # o cualquier lista de símbolos
```

## Fuentes

- Acciones, ETFs, índices y FX: Yahoo Finance con `yfinance`, sin clave. Cierres ajustados por dividendos y splits.
- Cripto (símbolos que terminan en USDT, USDC o FDUSD): Binance, sin clave. Si `api.binance.com` falla, usa `data-api.binance.vision`.
- `data/assets.py`: los 19 activos del selector, todos comprobados el 24 oct.

## Cuidado

- Yahoo bloquea si recibe muchas peticiones seguidas. `fetch_many` pide todos los símbolos de Yahoo en una sola llamada.
- Las fechas de los archivos masivos de Binance de 2026 vienen en microsegundos; las de la API, en milisegundos. Este módulo solo usa la API.
- `cache/` no se sube al repo.

## Pendiente (extra, sin asignar)

Tiger Data (Felipe y/o Rocco): guardar velas y predicciones para calificarlas después.
