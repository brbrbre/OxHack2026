import { describe, expect, it } from 'vitest'
import type { DecideResponse, PlanAllocation, PlanResponse } from '../api/types'
import { decisionFixtures } from '../mocks/decisions'
import { planFixtures } from '../mocks/plan'
import { buildHoldingProjection, buildPlanProjection } from './valueForecast'

function portfolio(): PlanResponse {
  const plan = structuredClone(planFixtures.sample)
  plan.numeros = {
    ...plan.numeros, monto: 5000, invertido: 4000, plazo_dias: 90,
    rendimiento_esperado: 0.04, peor_caso: -250,
  }
  plan.efectivo = 1000
  plan.cartera = [
    { simbolo: 'QQQ', nombre: 'Nasdaq 100', grupo: 'ETFs', monto: 1500, peso: 0.3 },
    { simbolo: 'GLD', nombre: 'Gold', grupo: 'ETFs', monto: 1500, peso: 0.3 },
    { simbolo: 'SPY', nombre: 'S&P 500 (SPDR)', grupo: 'ETFs', monto: 1000, peso: 0.2 },
  ]
  return plan
}

function holdingExample(): { plan: PlanResponse; holding: PlanAllocation; analysis: DecideResponse } {
  const plan = portfolio()
  const holding = plan.cartera.find((asset) => asset.simbolo === 'SPY')!
  const analysis = structuredClone(decisionFixtures.invest)
  analysis.numeros.plazo_dias = 90
  analysis.numeros.perfil = plan.numeros.perfil
  return { plan, holding, analysis }
}

describe('portfolio value projection', () => {
  it('keeps cash in the initial budget without applying its weighting twice', () => {
    const plan = portfolio()
    const before = structuredClone(plan)
    const projection = buildPlanProjection(plan)
    expect(projection).toMatchObject({ amount: 5000, days: 90, cash: 1000 })
    expect(projection.points).toHaveLength(91)
    expect(projection.points[0]).toEqual({
      day: 0, date: null, value: 5000, gain: 0, return: 0, lower: 5000, upper: null,
    })
    expect(projection.points[45]).toMatchObject({ day: 45, value: 5100, gain: 100, return: 0.02, lower: 4875 })
    expect(projection.points.at(-1)).toMatchObject({ day: 90, value: 5200, gain: 200, return: 0.04, lower: 4750 })
    expect(projection.points.every((point) => point.date === null && point.upper === null)).toBe(true)
    expect(plan).toEqual(before)
  })

  it('draws a flat complete budget when the plan keeps everything in cash', () => {
    const projection = buildPlanProjection(planFixtures.allCash)
    expect(projection.amount).toBe(5000)
    expect(projection.cash).toBe(5000)
    for (const point of projection.points) {
      expect(point).toMatchObject({ value: 5000, lower: 5000, upper: null, gain: 0, return: 0 })
    }
  })

  it('preserves a negative expected return and a positive lower estimate without manufacturing an upper bound', () => {
    const plan = portfolio()
    plan.numeros.rendimiento_esperado = -0.06
    const negative = buildPlanProjection(plan)
    expect(negative.points[45].value).toBeCloseTo(4850)
    expect(negative.points[45].gain).toBeCloseTo(-150)
    expect(negative.points.at(-1)?.value).toBeCloseTo(4700)
    expect(negative.points[0].gain).toBe(0)
    expect(negative.points[0].return).toBe(0)
    plan.numeros.rendimiento_esperado = 0.08
    plan.numeros.peor_caso = 100
    const positiveLower = buildPlanProjection(plan)
    expect(positiveLower.points.at(-1)).toMatchObject({ value: 5400, lower: 5100, upper: null })
  })
})

describe('allocated holding value projection', () => {
  it('uses the portfolio allocation even when the standalone analysis suggests only part of it', () => {
    const { plan, holding, analysis } = holdingExample()
    analysis.numeros.fraccion = 0.4
    analysis.numeros.monto_sugerido = 400
    const before = structuredClone({ plan, holding, analysis })
    const projection = buildHoldingProjection(holding, plan, analysis)!
    expect(projection).toMatchObject({ amount: 1000, days: 90, cash: 0 })
    expect(projection.points[0]).toMatchObject({ value: 1000, lower: 1000, upper: 1000, gain: 0, return: 0 })
    expect(projection.points[45]).toMatchObject({ value: 1010, gain: 10, lower: 977.5, upper: 1042.5 })
    expect(projection.points.at(-1)).toMatchObject({ value: 1020, gain: 20, lower: 955, upper: 1085 })
    expect(projection.points.every((point) => point.date === null)).toBe(true)
    expect({ plan, holding, analysis }).toEqual(before)
  })

  it('retains the chosen holding amount when the new standalone analysis suggests none', () => {
    const { plan, holding, analysis } = holdingExample()
    analysis.decision = 'NO_POR_AHORA'
    analysis.numeros.fraccion = 0
    analysis.numeros.monto_sugerido = 0
    analysis.numeros.rendimiento_esperado = -0.02
    const projection = buildHoldingProjection(holding, plan, analysis)!
    expect(projection.points.at(-1)).toMatchObject({ value: 980, gain: -20, return: -0.02 })
    expect(projection.points[0].gain).toBe(0)
  })

  it.each(['symbol', 'amount', 'days', 'profile', 'membership'] as const)(
    'rejects a mismatched %s instead of attaching another analysis to the position', (field) => {
      const { plan, holding, analysis } = holdingExample()
      if (field === 'symbol') analysis.simbolo = 'BTCUSDT'
      if (field === 'amount') analysis.numeros.monto = 5000
      if (field === 'days') analysis.numeros.plazo_dias = 30
      if (field === 'profile') analysis.numeros.perfil = 'agresivo'
      if (field === 'membership') plan.cartera = []
      expect(buildHoldingProjection(holding, plan, analysis)).toBeNull()
    },
  )
})
