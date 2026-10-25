"""Tests for the data block. No internet needed."""

import pandas as pd

from data import fetch


def test_routing_crypto_vs_yahoo():
    assert fetch.is_crypto("BTCUSDT")
    assert fetch.is_crypto("ethusdc")
    for s in ["SPY", "WALMEX.MX", "^GSPC", "GBPUSD=X", "USDT"]:
        assert not fetch.is_crypto(s)


def test_binance_parse_uses_milliseconds():
    # 2026-10-23 00:00 UTC in milliseconds, as the REST API gives it.
    rows = [[1792713600000, "100", "110", "90", "105", "12.5", 0, "0", 1, "0", "0", "0"]]
    df = fetch.parse_binance_klines(rows)
    assert df.index[0] == pd.Timestamp("2026-10-23")
    assert list(df.columns) == fetch.COLUMNS
    assert df.loc["2026-10-23", "close"] == 105.0


def test_cache_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch, "CACHE_DIR", tmp_path)
    idx = pd.DatetimeIndex(["2026-10-21", "2026-10-22"], name="date")
    df = pd.DataFrame({c: [1.0, 2.0] for c in fetch.COLUMNS}, index=idx)
    fetch.save("WALMEX.MX", df)
    back = fetch.load("WALMEX.MX")
    pd.testing.assert_frame_equal(back, df, check_freq=False)
    assert fetch.get_close("WALMEX.MX").name == "WALMEX.MX"
