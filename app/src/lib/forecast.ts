import type { DecideResponse, PricesResponse } from '../api/types'

const DAY_MS = 86_400_000

export interface PriceChartPoint {
  date: string
  timestamp: number
  close: number | null
  range: [number, number] | null
  expected: number | null
  forecastDay?: number
  expectedReturn?: number
  estimatedGain?: number
}

export interface ForecastSummary {
  days: number
  startDate: string
  endDate: string
  low: number
  high: number
  expected: number
  investmentAmount: number
}

export function buildPriceSeries(prices: PricesResponse | null, symbol: string, result: DecideResponse | null) {
  const points: PriceChartPoint[] = prices?.simbolo === symbol
    ? prices.fechas.map((date, index) => ({
      date, timestamp: Date.parse(date + 'T00:00:00Z'), close: prices.cierres[index],
      range: null, expected: null,
    })) : []
  const historyLength = points.length
  let forecast: ForecastSummary | null = null
  const last = points.at(-1)
  if (!last || historyLength < 2 || !last.close || !result || result.simbolo !== symbol) {
    return { points, historyLength, forecast }
  }

  const numbers = result.numeros
  if (numbers.monto <= 0 || !Number.isInteger(numbers.plazo_dias) || numbers.plazo_dias < 1) {
    return { points, historyLength, forecast }
  }
  // The API's monetary range is based on the full requested amount.
  const low = last.close * (1 + numbers.peor_caso / numbers.monto)
  const high = last.close * (1 + numbers.mejor_caso / numbers.monto)
  const expected = last.close * (1 + numbers.rendimiento_esperado)
  const timestamp = last.timestamp + numbers.plazo_dias * DAY_MS
  if (![low, high, expected, timestamp].every(Number.isFinite)) return { points, historyLength, forecast }
  const endDate = new Date(timestamp).toISOString().slice(0, 10)
  forecast = {
    days: numbers.plazo_dias, startDate: last.date, endDate, low, high, expected,
    investmentAmount: numbers.monto_sugerido,
  }
  last.range = [last.close, last.close]
  last.expected = last.close
  last.forecastDay = 0
  last.expectedReturn = 0
  last.estimatedGain = 0
  // Intermediate points illustrate the straight line already drawn to the API endpoint.
  // They are calendar-day approximations, not additional predictions from the model.
  for (let day = 1; day <= numbers.plazo_dias; day += 1) {
    const progress = day / numbers.plazo_dias
    const pointTimestamp = last.timestamp + day * DAY_MS
    const expectedReturn = numbers.rendimiento_esperado * progress
    points.push({
      date: new Date(pointTimestamp).toISOString().slice(0, 10),
      timestamp: pointTimestamp,
      close: null,
      range: [last.close + (low - last.close) * progress, last.close + (high - last.close) * progress],
      expected: last.close + (expected - last.close) * progress,
      forecastDay: day,
      expectedReturn,
      estimatedGain: numbers.monto_sugerido === 0 ? 0 : numbers.monto_sugerido * expectedReturn,
    })
  }
  return { points, historyLength, forecast }
}
