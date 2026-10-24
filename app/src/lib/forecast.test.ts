import { describe, expect, it } from 'vitest'
import { decisionFixtures } from '../mocks/decisions'
import { buildPriceSeries } from './forecast'

function series(lastDate = '2026-10-23', days = 30) {
  const result = structuredClone(decisionFixtures.invest)
  result.numeros.plazo_dias = days
  return buildPriceSeries({ simbolo: 'SPY', fechas: ['2026-10-22', lastDate], cierres: [98, 100] }, 'SPY', result)
}

describe('forecast calendar and API estimates', () => {
  it.each([
    [7, '2026-10-30'], [30, '2026-11-22'], [90, '2027-01-21'],
    [180, '2027-04-21'], [365, '2027-10-23'],
  ])('places a %s-day forecast on %s using calendar days', (days, date) => {
    const { forecast, points } = series('2026-10-23', days)
    expect(forecast?.endDate).toBe(date)
    expect(points.at(-1)?.timestamp).toBe(Date.parse(date + 'T00:00:00Z'))
  })

  it.each([
    ['2026-10-23', 1, '2026-10-24'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2028-02-28', 2, '2028-03-01'],
    ['2026-12-31', 7, '2027-01-07'],
  ])('counts weekends, leap days and year boundaries from %s', (start, days, end) => {
    expect(series(start, days).forecast?.endDate).toBe(end)
  })

  it('uses the original budget for the exact lower and upper endpoints', () => {
    const { forecast, points, historyLength } = series()
    expect(forecast).toMatchObject({ low: 95.5, high: 108.5, expected: 102, days: 30 })
    expect(historyLength).toBe(2)
    expect(points[0]).toMatchObject({ range: null, expected: null, close: 98 })
    expect(points[1]).toMatchObject({ range: [100, 100], expected: 100, close: 100 })
    expect(points.at(-1)).toMatchObject({ range: [95.5, 108.5], expected: 102, close: null })
  })

  it('adds one point per calendar day, including a weekend, with a labelled linear midpoint', () => {
    const { points, historyLength, forecast } = series('2026-10-23', 90)
    expect(points).toHaveLength(historyLength + 90)
    expect(points[historyLength - 1]).toMatchObject({ forecastDay: 0, expectedReturn: 0, estimatedGain: 0 })
    expect(points[historyLength]).toMatchObject({ date: '2026-10-24', forecastDay: 1 })
    const midpoint = points[historyLength - 1 + 45]
    expect(midpoint).toMatchObject({ date: '2026-12-07', forecastDay: 45, expected: 101, range: [97.75, 104.25] })
    expect(midpoint.expectedReturn).toBeCloseTo(0.01)
    expect(midpoint.estimatedGain).toBeCloseTo(10)
    expect(forecast?.investmentAmount).toBe(1000)
    expect(points.at(-1)).toMatchObject({ forecastDay: 90, expectedReturn: 0.02, estimatedGain: 20 })
    expect(points[0]).not.toHaveProperty('forecastDay')
  })

  it('calculates approximate losses on the suggested amount without changing the price range', () => {
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.rendimiento_esperado = -0.06
    result.numeros.fraccion = 0.25
    result.numeros.monto_sugerido = 250
    const prices = { simbolo: 'SPY', fechas: ['2026-10-22', '2026-10-23'], cierres: [98, 100] }
    const before = structuredClone({ prices, result })
    const { points, historyLength, forecast } = buildPriceSeries(prices, 'SPY', result)
    const midpoint = points[historyLength - 1 + 15]
    expect(forecast).toMatchObject({ low: 95.5, high: 108.5, investmentAmount: 250 })
    expect(midpoint.expectedReturn).toBeCloseTo(-0.03)
    expect(midpoint.estimatedGain).toBeCloseTo(-7.5)
    expect(points.at(-1)?.estimatedGain).toBeCloseTo(-15)
    expect(points.at(-1)?.expected).toBeCloseTo(94)
    expect({ prices, result }).toEqual(before)
  })

  it('keeps zero-investment gains at zero while retaining the negative asset estimate', () => {
    const result = structuredClone(decisionFixtures.notNow)
    const prices = { simbolo: 'NVDA', fechas: ['2026-10-22', '2026-10-23'], cierres: [98, 100] }
    const { points, historyLength, forecast } = buildPriceSeries(prices, 'NVDA', result)
    expect(forecast?.investmentAmount).toBe(0)
    for (const point of points.slice(historyLength - 1)) expect(point.estimatedGain).toBe(0)
    expect(points.at(-1)?.expectedReturn).toBe(-0.018)
    expect(points.at(-1)?.expected).toBeCloseTo(98.2)
  })

  it('keeps partial investment and London pence out of the endpoint calculation', () => {
    const result = structuredClone(decisionFixtures.waitRisk)
    result.simbolo = 'HSBA.L'
    const prices = { simbolo: 'HSBA.L', fechas: ['2026-10-22', '2026-10-23'], cierres: [1300, 1352] }
    const before = structuredClone({ prices, result })
    const { forecast, points, historyLength } = buildPriceSeries(prices, 'HSBA.L', result)
    expect(forecast?.low).toBeCloseTo(1054.56)
    expect(forecast?.high).toBeCloseTo(1553.448)
    expect(forecast?.expected).toBeCloseTo(1368.224)
    expect(forecast?.investmentAmount).toBe(455)
    expect(points[historyLength - 1 + 15].expected).toBeCloseTo(1360.112)
    expect(points[historyLength - 1 + 15].estimatedGain).toBeCloseTo(2.73)
    expect(points.at(-1)?.estimatedGain).toBeCloseTo(5.46)
    expect({ prices, result }).toEqual(before)
  })

  it('does not project a result or prices belonging to a different selected asset', () => {
    const prices = { simbolo: 'SPY', fechas: ['2026-10-22', '2026-10-23'], cierres: [98, 100] }
    expect(buildPriceSeries(prices, 'SPY', decisionFixtures.wait).forecast).toBeNull()
    expect(buildPriceSeries(prices, 'BTCUSDT', decisionFixtures.wait).points).toEqual([])
    expect(buildPriceSeries(prices, 'SPY', null).points).toHaveLength(2)
    expect(buildPriceSeries(prices, 'SPY', null).forecast).toBeNull()
  })

  it('does not draw a cone without enough history or a valid last close', () => {
    expect(buildPriceSeries(null, 'SPY', decisionFixtures.invest).forecast).toBeNull()
    expect(buildPriceSeries({ simbolo: 'SPY', fechas: ['2026-10-23'], cierres: [100] }, 'SPY', decisionFixtures.invest).forecast).toBeNull()
    expect(buildPriceSeries({ simbolo: 'SPY', fechas: ['2026-10-22', '2026-10-23'], cierres: [98, 0] }, 'SPY', decisionFixtures.invest).forecast).toBeNull()
  })
})
