"""Calendario de decisiones de bancos centrales que pueden mover el precio.

Fechas tomadas de las páginas oficiales el 24 oct 2026:
- Fed (FOMC): https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
- BCE: https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html
- Banco de Inglaterra: https://www.bankofengland.co.uk/news/2024/december/mpc-dates-for-2026

Falta Banxico: no se encontraron sus fechas de nov-dic 2026. Revisar a mano
en banxico.org.mx antes de agregarlo.

"date" es el día del anuncio (el último día de la reunión).
"""

from __future__ import annotations

from datetime import date

EVENTS = [
    {"date": date(2026, 10, 28), "name": "Decisión de tasas de la Fed", "region": "US"},
    {"date": date(2026, 10, 29), "name": "Decisión de tasas del BCE", "region": "EU"},
    {"date": date(2026, 11, 5), "name": "Decisión de tasas del Banco de Inglaterra", "region": "UK"},
    {"date": date(2026, 12, 9), "name": "Decisión de tasas de la Fed", "region": "US"},
    {"date": date(2026, 12, 17), "name": "Decisión de tasas del BCE", "region": "EU"},
    {"date": date(2027, 1, 27), "name": "Decisión de tasas de la Fed", "region": "US"},
]

UK_SYMBOLS = ("^FTSE", "GBPUSD=X")


def regions_for(symbol: str) -> set[str]:
    """Qué bancos centrales mueven a este activo.

    La Fed mueve a casi todo (dólar, acciones globales, cripto). El Banco de
    Inglaterra, a lo británico. El BCE, a activos en euros (hoy ninguno del
    catálogo).
    """
    s = symbol.upper()
    regions = {"US"}
    if s.endswith(".L") or s in UK_SYMBOLS:
        regions.add("UK")
    if s.endswith(".DE") or s.endswith(".PA") or "EUR" in s:
        regions.add("EU")
    return regions


def upcoming(symbol: str, today: date, within_days: int) -> list[dict]:
    """Eventos que afectan al activo entre hoy y hoy + within_days."""
    regions = regions_for(symbol)
    return [
        e for e in EVENTS
        if e["region"] in regions and 0 <= (e["date"] - today).days <= within_days
    ]
