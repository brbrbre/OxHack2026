"""Asset catalogue for the app's picker. Names and groups are in English.

Every symbol was checked with data.fetch on 24 October 2026 (all returned
history up to 23-24 October). To add one: test it with
`python -m data.fetch SYMBOL`, then add it here.
"""

ASSETS = {
    "ETFs": {
        "SPY": "S&P 500 (SPDR)",
        "VOO": "S&P 500 (Vanguard)",
        "QQQ": "Nasdaq 100",
        "GLD": "Gold",
    },
    "US stocks": {
        "AAPL": "Apple",
        "MSFT": "Microsoft",
        "NVDA": "NVIDIA",
    },
    "Mexican stocks (BMV)": {
        "WALMEX.MX": "Walmart de México",
        "AMXB.MX": "América Móvil",
        "FEMSAUBD.MX": "FEMSA",
    },
    "UK stocks": {
        # London prices are in pence (GBp): 1,352 = £13.52.
        "VOD.L": "Vodafone",
        "HSBA.L": "HSBC",
        "SHEL.L": "Shell",
    },
    "Indices": {
        "^GSPC": "S&P 500",
        "^FTSE": "FTSE 100",
        "^MXX": "S&P/BMV IPC",
    },
    "Currencies": {
        "GBPUSD=X": "British pound / US dollar",
        "MXN=X": "US dollar / Mexican peso",
    },
    "Crypto": {
        "BTCUSDT": "Bitcoin",
        "ETHUSDT": "Ethereum",
        "SOLUSDT": "Solana",
    },
}


def all_symbols() -> list[str]:
    return [s for group in ASSETS.values() for s in group]


def label(symbol: str) -> str:
    for group in ASSETS.values():
        if symbol in group:
            return f"{group[symbol]} ({symbol})"
    return symbol
