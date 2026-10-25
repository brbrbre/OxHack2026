"""Daily prices of stocks, ETFs, indices, FX and crypto, with a disk cache.

From code:
    from data.fetch import get_prices, get_close
    precios = get_close("SPY")          # pd.Series of daily closes, indexed by date

From the terminal (downloads, stores and reads back):
    python -m data.fetch SPY BTCUSDT WALMEX.MX

Sources:
    - Yahoo Finance through yfinance (no key): stocks, ETFs, indices, FX.
      Closes adjusted for dividends and splits (auto_adjust=True).
    - Binance REST (no key): crypto pairs such as BTCUSDT.
"""

from __future__ import annotations

import sys
import time
import warnings
from pathlib import Path

import pandas as pd
import requests

CACHE_DIR = Path(__file__).resolve().parent / "cache"
COLUMNS = ["open", "high", "low", "close", "volume"]

BINANCE_HOSTS = ("https://api.binance.com", "https://data-api.binance.vision")
BINANCE_QUOTES = ("USDT", "USDC", "FDUSD")
BINANCE_LIMIT = 1000
# 2017-01-01 in milliseconds: Binance has no data before August 2017.
BINANCE_START_MS = 1483228800000


def is_crypto(symbol: str) -> bool:
    """BTCUSDT, ETHUSDC... go to Binance. Everything else, to Yahoo."""
    s = symbol.upper()
    return s.isalnum() and any(s.endswith(q) and len(s) > len(q) for q in BINANCE_QUOTES)


def cache_path(symbol: str) -> Path:
    safe = "".join(c if c.isalnum() else "_" for c in symbol.upper())
    return CACHE_DIR / f"{safe}_1d.csv"


# --- Binance -----------------------------------------------------------------

def parse_binance_klines(rows: list[list]) -> pd.DataFrame:
    """Converts the /api/v3/klines response into the common format.

    Careful: the REST API gives time in MILLIseconds. The 2026 bulk files on
    data.binance.vision give it in MICROseconds. This function is for the
    API only.
    """
    if not rows:
        return pd.DataFrame(columns=COLUMNS, index=pd.DatetimeIndex([], name="date"))
    df = pd.DataFrame([r[:6] for r in rows], columns=["open_time"] + COLUMNS)
    df["date"] = pd.to_datetime(df["open_time"], unit="ms", utc=True).dt.tz_localize(None).dt.normalize()
    df = df.drop(columns="open_time").set_index("date")
    return df.astype(float)


def fetch_binance(symbol: str, start_ms: int = BINANCE_START_MS) -> pd.DataFrame:
    """All daily candles since start_ms, 1,000 at a time."""
    last_error = None
    for host in BINANCE_HOSTS:
        try:
            frames, cursor = [], start_ms
            while True:
                r = requests.get(
                    f"{host}/api/v3/klines",
                    params={"symbol": symbol.upper(), "interval": "1d",
                            "startTime": cursor, "limit": BINANCE_LIMIT},
                    timeout=20,
                )
                r.raise_for_status()
                rows = r.json()
                if not rows:
                    break
                frames.append(parse_binance_klines(rows))
                if len(rows) < BINANCE_LIMIT:
                    break
                cursor = rows[-1][0] + 1
                time.sleep(0.2)
            df = pd.concat(frames) if frames else parse_binance_klines([])
            return df[~df.index.duplicated(keep="last")].sort_index()
        except requests.RequestException as e:
            last_error = e
    raise RuntimeError(f"Binance did not respond for {symbol}: {last_error}")


# --- Yahoo -------------------------------------------------------------------

def _tidy_yahoo(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.rename(columns=str.lower)[COLUMNS].dropna(subset=["close"])
    df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
    df.index.name = "date"
    return df.astype(float)


def fetch_yahoo(symbols: list[str]) -> dict[str, pd.DataFrame]:
    """One call per batch: Yahoo blocks (429) if asked one by one."""
    import yfinance as yf

    # yfinance prints pandas warnings that don't affect the data.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        raw = yf.download(symbols, period="max", interval="1d", auto_adjust=True,
                          group_by="ticker", progress=False, threads=True)
    out: dict[str, pd.DataFrame] = {}
    if raw is None or raw.empty:
        return out
    for s in symbols:
        if isinstance(raw.columns, pd.MultiIndex):
            if s not in raw.columns.get_level_values(0):
                continue
            part = raw[s]
        else:
            part = raw
        df = _tidy_yahoo(part)
        if not df.empty:
            out[s] = df
    return out


# --- Cache and public API ----------------------------------------------------

def save(symbol: str, df: pd.DataFrame) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = cache_path(symbol)
    df.to_csv(path)
    return path


def load(symbol: str) -> pd.DataFrame | None:
    path = cache_path(symbol)
    if not path.exists():
        return None
    df = pd.read_csv(path, index_col="date", parse_dates=["date"])
    return df[COLUMNS].astype(float)


def fetch_many(symbols: list[str]) -> dict[str, pd.DataFrame]:
    """Downloads every symbol (Yahoo in one batch, crypto one by one) and stores them."""
    crypto = [s for s in symbols if is_crypto(s)]
    stocks = [s for s in symbols if not is_crypto(s)]
    result = fetch_yahoo(stocks) if stocks else {}
    for s in crypto:
        result[s] = fetch_binance(s)
    for s, df in result.items():
        save(s, df)
    return result


def get_prices(symbol: str, refresh: bool = False) -> pd.DataFrame:
    """Daily candles for the symbol. Reads the cache; downloads only if missing or refresh=True."""
    if not refresh:
        cached = load(symbol)
        if cached is not None and not cached.empty:
            return cached
    data = fetch_many([symbol])
    if symbol not in data:
        raise ValueError(f"No data for {symbol}. Is the symbol spelled right?")
    return data[symbol]


def get_close(symbol: str, refresh: bool = False) -> pd.Series:
    """Daily closes: what model.predict() receives."""
    return get_prices(symbol, refresh=refresh)["close"].rename(symbol)


def main(argv: list[str]) -> int:
    symbols = argv or ["SPY", "BTCUSDT", "WALMEX.MX"]
    t0 = time.time()
    fetched = fetch_many(symbols)
    print(f"Descargado en {time.time() - t0:.1f} s\n")
    ok = True
    for s in symbols:
        if s not in fetched:
            print(f"{s:<12} NO DATA")
            ok = False
            continue
        back = load(s)
        if back is None:
            print(f"{s:<12} COULD NOT READ THE CACHE")
            ok = False
            continue
        same = len(back) == len(fetched[s])
        ok &= same
        print(f"{s:<12} {len(back):>6} rows  {back.index.min().date()} to {back.index.max().date()}"
              f"  last close {back['close'].iloc[-1]:,.2f}  cache {'OK' if same else 'DIFFERENT'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
