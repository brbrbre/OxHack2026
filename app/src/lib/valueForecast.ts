import type { DecideResponse } from '../api/types'
import { HORIZONS } from '../config'

export interface ValueProjectionPoint {
  day: number
  date: null
  value: number
  gain: number
  return: number
  lower: number
  upper: number
}

export interface ValueProjection {
  points: ValueProjectionPoint[]
  amount: number
  days: number
  cash: 0
}

/** Illustrate the requested amount, not a second application of the sizing rule. */
export function buildInvestmentProjection(analysis: DecideResponse): ValueProjection | null {
  const { monto: amount, plazo_dias: days, rendimiento_esperado: expectedReturn,
    peor_caso: lowerGain, mejor_caso: upperGain } = analysis.numeros
  // Current planner horizons end at 365 days. Reject malformed horizons before
  // allocating points; the chart is not a way to create a new API horizon.
  if (![amount, expectedReturn, lowerGain, upperGain].every(Number.isFinite) || amount <= 0 ||
      !Number.isInteger(days) || days < 1 || days > Math.max(...HORIZONS) || lowerGain > upperGain) return null

  const expectedGain = amount * expectedReturn
  if (![expectedGain, amount + expectedGain, amount + lowerGain, amount + upperGain].every(Number.isFinite)) return null

  // The response contains terminal estimates, not an as-of date or a daily
  // prediction. Day 0…T is a straight-line illustration of those endpoints.
  const points = Array.from({ length: days + 1 }, (_, day): ValueProjectionPoint => {
    const progress = day / days
    const gain = day === 0 || expectedGain === 0 ? 0 : expectedGain * progress
    return {
      day, date: null, value: amount + gain, gain,
      return: day === 0 || expectedReturn === 0 ? 0 : expectedReturn * progress,
      lower: amount + lowerGain * progress,
      upper: amount + upperGain * progress,
    }
  })
  return { points, amount, days, cash: 0 }
}
