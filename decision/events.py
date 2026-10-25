"""Calendar of central bank decisions that can move prices.

Dates taken from the official pages on 24 October 2026:
- Fed (FOMC): https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
- ECB: https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html
- Bank of England: https://www.bankofengland.co.uk/news/2024/december/mpc-dates-for-2026

Banxico is missing: its November-December 2026 dates were not found. Check
banxico.org.mx by hand before adding it.

"date" is the announcement day (the last day of the meeting).
"""

from __future__ import annotations

from datetime import date

EVENTS = [
    {"date": date(2026, 10, 28), "name": "Fed rate decision", "region": "US"},
    {"date": date(2026, 10, 29), "name": "ECB rate decision", "region": "EU"},
    {"date": date(2026, 11, 5), "name": "Bank of England rate decision", "region": "UK"},
    {"date": date(2026, 12, 9), "name": "Fed rate decision", "region": "US"},
    {"date": date(2026, 12, 17), "name": "ECB rate decision", "region": "EU"},
    {"date": date(2027, 1, 27), "name": "Fed rate decision", "region": "US"},
]

UK_SYMBOLS = ("^FTSE", "GBPUSD=X")


def regions_for(symbol: str) -> set[str]:
    """Which central banks move this asset.

    The Fed moves almost everything (dollar, global stocks, crypto). The Bank of
    England moves UK assets. The ECB moves euro assets (none in the catalogue
    today).
    """
    s = symbol.upper()
    regions = {"US"}
    if s.endswith(".L") or s in UK_SYMBOLS:
        regions.add("UK")
    if s.endswith(".DE") or s.endswith(".PA") or "EUR" in s:
        regions.add("EU")
    return regions


def upcoming(symbol: str, today: date, within_days: int) -> list[dict]:
    """Events that affect the asset between today and today + within_days."""
    regions = regions_for(symbol)
    return [
        e for e in EVENTS
        if e["region"] in regions and 0 <= (e["date"] - today).days <= within_days
    ]
