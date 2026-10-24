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
    expect(points[2]).toMatchObject({ range: [95.5, 108.5], expected: 102, close: null })
  })

  it('keeps partial investment and London pence out of the endpoint calculation', () => {
    const result = structuredClone(decisionFixtures.waitRisk)
    result.simbolo = 'HSBA.L'
    const prices = { simbolo: 'HSBA.L', fechas: ['2026-10-22', '2026-10-23'], cierres: [1300, 1352] }
    const before = structuredClone({ prices, result })
    const { forecast } = buildPriceSeries(prices, 'HSBA.L', result)
    expect(forecast?.low).toBeCloseTo(1054.56)
    expect(forecast?.high).toBeCloseTo(1553.448)
    expect(forecast?.expected).toBeCloseTo(1368.224)
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
