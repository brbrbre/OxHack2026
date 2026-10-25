# data/ - prices and cache

Downloads daily prices and stores them in `cache/`, so the app doesn't call the internet on every click.

## How to use it

```python
from data.fetch import get_close, get_prices
from data.assets import ASSETS, all_symbols, label

precios = get_close("SPY")     # pd.Series of daily closes; this is what model.predict() receives
velas = get_prices("BTCUSDT")  # DataFrame: open, high, low, close, volume
```

`get_close` and `get_prices` read the cache. They only download if the symbol is missing, or with `refresh=True`.

To download or refresh before a session:

```bash
python -m data.fetch SPY BTCUSDT WALMEX.MX      # or any list of symbols
```

## Sources

- Stocks, ETFs, indices and FX: Yahoo Finance through `yfinance`, no key needed. Closes adjusted for dividends and splits.
- Crypto (symbols ending in USDT, USDC or FDUSD): Binance public market data, no key needed. If `api.binance.com` fails, it uses `data-api.binance.vision`.
- `data/assets.py`: the 21 assets in the picker, all checked on 24 October 2026. History goes back to 1993 for SPY and 2017 for Bitcoin.
- Tiger Data (`tiger/`) keeps a copy of these prices and every prediction, to grade them later.

## Watch out

- Yahoo blocks many requests in a row. `fetch_many` asks for all Yahoo symbols in one call.
- `cache/` is not in the repo. It also holds `habito.sqlite`, the reminders, which contain phone numbers.
