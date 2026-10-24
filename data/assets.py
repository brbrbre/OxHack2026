"""Catálogo de activos para el selector de la app.

Cada símbolo se comprobó con data.fetch el 24 oct 2026 (todos devolvieron
historial hasta el 23-24 oct). Para agregar uno: probarlo con
`python -m data.fetch SIMBOLO` y luego añadirlo aquí.
"""

ASSETS = {
    "ETFs": {
        "SPY": "S&P 500 (SPDR)",
        "VOO": "S&P 500 (Vanguard)",
        "QQQ": "Nasdaq 100",
        "GLD": "Oro",
    },
    "Acciones EE. UU.": {
        "AAPL": "Apple",
        "MSFT": "Microsoft",
        "NVDA": "NVIDIA",
    },
    "Acciones México (BMV)": {
        "WALMEX.MX": "Walmart de México",
        "AMXB.MX": "América Móvil",
        "FEMSAUBD.MX": "FEMSA",
    },
    "Acciones Reino Unido": {
        "VOD.L": "Vodafone",
    },
    "Índices": {
        "^GSPC": "S&P 500",
        "^FTSE": "FTSE 100",
        "^MXX": "S&P/BMV IPC",
    },
    "Divisas": {
        "GBPUSD=X": "Libra / dólar",
        "MXN=X": "Dólar / peso mexicano",
    },
    "Cripto": {
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
