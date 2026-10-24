import type { PricesResponse } from '../api/types'

const referencePrices: Record<string, number> = {
  SPY: 601.4, VOO: 552.8, QQQ: 520.4, GLD: 285.7, AAPL: 234.5,
  MSFT: 432.1, NVDA: 142.8, 'WALMEX.MX': 56.4, 'AMXB.MX': 17.2,
  'FEMSAUBD.MX': 192.6, 'VOD.L': 78.4, '^GSPC': 5980.2, '^FTSE': 8310.5,
  '^MXX': 53800.1, 'GBPUSD=X': 1.31, 'MXN=X': 19.8,
  BTCUSDT: 80720, ETHUSDT: 3340, SOLUSDT: 169.2,
}

// Deterministic synthetic histories. No fixture prices are presented as live data.
export function mockPrices(symbol: string, days = 365): PricesResponse {
  const end = Date.UTC(2026, 9, 24)
  const dates: string[] = []
  const closes: number[] = []
  const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const crypto = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(symbol)
  const base = referencePrices[symbol] ?? 100
  for (let offset = days; offset >= 0; offset -= 1) {
    const date = new Date(end - offset * 86_400_000)
    if (!crypto && [0, 6].includes(date.getUTCDay())) continue
    const progress = (days - offset) / Math.max(days, 1)
    const wave = Math.sin(progress * 18 + seed) * 0.025 +
      Math.sin(progress * 71 + seed / 3) * 0.009 +
      Math.cos(progress * 153) * 0.004
    const dip = Math.exp(-Math.pow((progress - 0.43) / 0.07, 2)) * 0.095
    dates.push(date.toISOString().slice(0, 10))
    closes.push(Number((base * (0.81 + progress * 0.19 + wave - dip)).toFixed(4)))
  }
  return { simbolo: symbol, fechas: dates, cierres: closes }
}
