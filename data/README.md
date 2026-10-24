# data/ - precios y caché (Rocco)

Baja precios históricos y los guarda para que la app no llame a internet en cada clic.

- Acciones, ETFs, índices y FX: `yfinance` (sin clave).
- Cripto: Binance (sin clave). Respaldo: Bybit.
- `cache/` guarda lo descargado. No se sube al repo.
- Extra sin asignar (Felipe y/o Rocco): Tiger Data guarda las velas y cada predicción, para calificarla después.

Listo cuando: `python -m data.fetch SPY BTCUSDT WALMEX.MX` guarda los datos y los lee de vuelta.

Cuidado: las fechas de los archivos masivos de Binance de 2026 vienen en microsegundos; las de la API, en milisegundos.
