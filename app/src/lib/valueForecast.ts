import type { DecideResponse, PlanAllocation, PlanResponse } from '../api/types'

export interface ValueProjectionPoint {
  day: number
  date: string | null
  value: number
  gain: number
  return: number
  lower: number | null
  upper: number | null
}

export interface ValueProjection {
  points: ValueProjectionPoint[]
  amount: number
  days: number
  cash: number
}

// These points illustrate straight lines to the API's final estimates.
// The API has no as-of date or daily predictions, so the horizontal axis is Day 0…T.
function project(amount: number, days: number, expectedReturn: number, lowerGain: number,
  upperGain: number | null, cash: number): ValueProjection {
  const points = Array.from({ length: days + 1 }, (_, day): ValueProjectionPoint => {
    const progress = day / days
    const change = day === 0 ? 0 : expectedReturn * progress
    return {
      day, date: null,
      value: amount * (1 + change),
      gain: day === 0 ? 0 : amount * change,
      return: change,
      lower: amount + lowerGain * progress,
      upper: upperGain === null ? null : amount + upperGain * progress,
    }
  })
  return { points, amount, days, cash }
}

export function buildPlanProjection(plan: PlanResponse): ValueProjection {
  const numbers = plan.numeros
  // The portfolio return is already weighted against the complete budget;
  // its cash allocation contributes zero return. Do not scale by invested again.
  return project(numbers.monto, numbers.plazo_dias, numbers.rendimiento_esperado,
    numbers.peor_caso, null, plan.efectivo)
}

export function buildHoldingProjection(holding: PlanAllocation, plan: PlanResponse,
  analysis: DecideResponse): ValueProjection | null {
  const numbers = analysis.numeros
  const assigned = plan.cartera.find((asset) => asset.simbolo === holding.simbolo)
  if (!assigned || assigned.monto !== holding.monto || analysis.simbolo !== holding.simbolo ||
      numbers.monto !== holding.monto || numbers.plazo_dias !== plan.numeros.plazo_dias ||
      numbers.perfil !== plan.numeros.perfil || holding.monto <= 0 ||
      !Number.isInteger(numbers.plazo_dias) || numbers.plazo_dias < 1 ||
      ![holding.monto, numbers.rendimiento_esperado, numbers.peor_caso, numbers.mejor_caso].every(Number.isFinite)) {
    return null
  }
  // The portfolio has already chosen the invested amount. A standalone decision's
  // monto_sugerido is not applied as a second reduction to this position.
  return project(holding.monto, numbers.plazo_dias, numbers.rendimiento_esperado,
    numbers.peor_caso, numbers.mejor_caso, 0)
}
