import { describe, expect, it } from 'vitest'
import type { DecisionNumbers } from '../api/types'
import { decisionFixtures } from '../mocks/decisions'
import { buildInvestmentProjection } from './valueForecast'

function example(numbers: Partial<DecisionNumbers> = {}) {
  const analysis = structuredClone(decisionFixtures.invest)
  analysis.numeros = { ...analysis.numeros, ...numbers }
  return analysis
}

describe('inspected investment value illustration', () => {
  it('matches the API endpoints and keeps intermediate values explicitly undated', () => {
    const analysis = example()
    const before = structuredClone(analysis)
    const projection = buildInvestmentProjection(analysis)!
    expect(projection).toMatchObject({ amount: 1000, days: 30, cash: 0 })
    expect(projection.points).toHaveLength(31)
    expect(projection.points[0]).toEqual({
      day: 0, date: null, value: 1000, gain: 0, return: 0, lower: 1000, upper: 1000,
    })
    expect(projection.points[15]).toEqual({
      day: 15, date: null, value: 1010, gain: 10, return: 0.01, lower: 977.5, upper: 1042.5,
    })
    expect(projection.points.at(-1)).toEqual({
      day: 30, date: null, value: 1020, gain: 20, return: 0.02, lower: 955, upper: 1085,
    })
    expect(projection.points.every((point) => point.date === null)).toBe(true)
    expect(analysis).toEqual(before)
  })

  it.each([0, 0.4, 1])('does not apply the allocation or suggested fraction %s a second time', (fraction) => {
    const projection = buildInvestmentProjection(example({ fraccion: fraction, monto_sugerido: 1000 * fraction }))!
    expect(projection.amount).toBe(1000)
    expect(projection.points.at(-1)).toMatchObject({ value: 1020, gain: 20, lower: 955, upper: 1085 })
  })

  it('preserves losses even when the standalone decision suggests no investment', () => {
    const analysis = example({ rendimiento_esperado: -0.06, fraccion: 0, monto_sugerido: 0 })
    analysis.decision = 'NO_POR_AHORA'
    const projection = buildInvestmentProjection(analysis)!
    expect(projection.points[15]).toMatchObject({ value: 970, gain: -30, return: -0.03 })
    expect(projection.points.at(-1)).toMatchObject({ value: 940, gain: -60, return: -0.06 })
    expect(projection.points[0].gain).toBe(0)
  })

  it('retains a converted amount’s precision and a zero-return path without negative zero', () => {
    const amount = 5000 / (21.0226 / 1.1193)
    const projection = buildInvestmentProjection(example({ monto: amount, rendimiento_esperado: -0,
      peor_caso: -amount * 0.1, mejor_caso: amount * 0.2 }))!
    expect(projection.amount).toBe(amount)
    for (const point of projection.points) {
      expect(point.value).toBe(amount)
      expect(point.gain).toBe(0)
      expect(point.return).toBe(0)
    }
    expect(projection.points.at(-1)?.lower).toBe(amount - amount * 0.1)
    expect(projection.points.at(-1)?.upper).toBe(amount + amount * 0.2)
  })

  it.each([1, 2, 7, 30, 37, 60, 90, 180, 365])('includes both endpoints for a valid %s-day horizon', (days) => {
    const projection = buildInvestmentProjection(example({ plazo_dias: days }))!
    expect(projection.points).toHaveLength(days + 1)
    expect(projection.points[0].day).toBe(0)
    expect(projection.points.at(-1)?.day).toBe(days)
  })

  it.each([0, -1, 1.5, 366, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])(
    'rejects invalid or unsupported horizon %s before allocating points', (days) => {
      expect(buildInvestmentProjection(example({ plazo_dias: days }))).toBeNull()
    },
  )

  it.each([
    { monto: 0 }, { monto: -10 }, { monto: Number.NaN },
    { rendimiento_esperado: Number.POSITIVE_INFINITY },
    { peor_caso: Number.NaN }, { mejor_caso: Number.NEGATIVE_INFINITY },
    { peor_caso: 100, mejor_caso: 50 },
    { monto: Number.MAX_VALUE, rendimiento_esperado: 2 },
  ])('declines malformed monetary estimates %j', (numbers) => {
    expect(buildInvestmentProjection(example(numbers))).toBeNull()
  })
})
