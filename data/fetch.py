"""Precios diarios de acciones, ETFs, índices, FX y cripto, con caché en disco.

Uso desde código:
    from data.fetch import get_prices, get_close
    precios = get_close("SPY")          # pd.Series de cierres diarios, índice = fecha

Uso desde terminal (baja, guarda y lee de vuelta):
    python -m data.fetch SPY BTCUSDT WALMEX.MX

Fuentes:
    - Yahoo Finance vía yfinance (sin clave): acciones, ETFs, índices, FX.
      Cierres ajustados por dividendos y splits (auto_adjust=True).
    - Binance REST (sin clave): pares cripto como BTCUSDT.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pandas as pd
import requests

CACHE_DIR = Path(__file__).resolve().parent / "cache"
COLUMNS = ["open", "high", "low", "close", "volume"]

BINANCE_HOSTS = ("https://api.binance.com", "https://data-api.binance.vision")
BINANCE_QUOTES = ("USDT", "USDC", "FDUSD")
BINANCE_LIMIT = 1000
# 2017-01-01 en milisegundos: Binance no tiene datos antes de agosto de 2017.
BINANCE_START_MS = 1483228800000


def is_crypto(symbol: str) -> bool:
    """BTCUSDT, ETHUSDC... van a Binance. Todo lo demás, a Yahoo."""
    s = symbol.upper()
    return s.isalnum() and any(s.endswith(q) and len(s) > len(q) for q in BINANCE_QUOTES)


def cache_path(symbol: str) -> Path:
    safe = "".join(c if c.isalnum() else "_" for c in symbol.upper())
    return CACHE_DIR / f"{safe}_1d.csv"


# --- Binance -----------------------------------------------------------------

def parse_binance_klines(rows: list[list]) -> pd.DataFrame:
    """Convierte la respuesta de /api/v3/klines en el formato común.

    Ojo: la API REST da la hora en MILIsegundos. Los archivos masivos de
    data.binance.vision de 2026 la dan en MICROsegundos. Esta función es
    solo para la API.
    """
    if not rows:
        return pd.DataFrame(columns=COLUMNS, index=pd.DatetimeIndex([], name="date"))
    df = pd.DataFrame([r[:6] for r in rows], columns=["open_time"] + COLUMNS)
    df["date"] = pd.to_datetime(df["open_time"], unit="ms", utc=True).dt.tz_localize(None).dt.normalize()
    df = df.drop(columns="open_time").set_index("date")
    return df.astype(float)


def fetch_binance(symbol: str, start_ms: int = BINANCE_START_MS) -> pd.DataFrame:
    """Todas las velas diarias desde start_ms, de 1000 en 1000."""
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
    raise RuntimeError(f"Binance no respondió para {symbol}: {last_error}")


# --- Yahoo -------------------------------------------------------------------

def _tidy_yahoo(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.rename(columns=str.lower)[COLUMNS].dropna(subset=["close"])
    df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
    df.index.name = "date"
    return df.astype(float)


def fetch_yahoo(symbols: list[str]) -> dict[str, pd.DataFrame]:
    """Una sola llamada por lote: Yahoo bloquea (429) si se le pide uno por uno."""
    import yfinance as yf

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


# --- Caché y API pública -----------------------------------------------------

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
    """Baja todos los símbolos (Yahoo en un lote, cripto uno por uno) y los guarda."""
    crypto = [s for s in symbols if is_crypto(s)]
    stocks = [s for s in symbols if not is_crypto(s)]
    result = fetch_yahoo(stocks) if stocks else {}
    for s in crypto:
        result[s] = fetch_binance(s)
    for s, df in result.items():
        save(s, df)
    return result


def get_prices(symbol: str, refresh: bool = False) -> pd.DataFrame:
    """Velas diarias del símbolo. Lee la caché; solo baja si no existe o refresh=True."""
    if not refresh:
        cached = load(symbol)
        if cached is not None and not cached.empty:
            return cached
    data = fetch_many([symbol])
    if symbol not in data:
        raise ValueError(f"Sin datos para {symbol}. ¿Está bien escrito el símbolo?")
    return data[symbol]


def get_close(symbol: str, refresh: bool = False) -> pd.Series:
    """Cierres diarios: lo que recibe model.predict()."""
    return get_prices(symbol, refresh=refresh)["close"].rename(symbol)


def main(argv: list[str]) -> int:
    symbols = argv or ["SPY", "BTCUSDT", "WALMEX.MX"]
    t0 = time.time()
    fetched = fetch_many(symbols)
    print(f"Descargado en {time.time() - t0:.1f} s\n")
    ok = True
    for s in symbols:
        if s not in fetched:
            print(f"{s:<12} SIN DATOS")
            ok = False
            continue
        back = load(s)
        if back is None:
            print(f"{s:<12} NO SE PUDO LEER LA CACHÉ")
            ok = False
            continue
        same = len(back) == len(fetched[s])
        ok &= same
        print(f"{s:<12} {len(back):>6} filas  {back.index.min().date()} a {back.index.max().date()}"
              f"  último cierre {back['close'].iloc[-1]:,.2f}  caché {'OK' if same else 'DIFERENTE'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
