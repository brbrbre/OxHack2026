import { describe, expect, it } from 'vitest'
import { inspectPlanAsset } from './assetInspection'
import { planFixtures } from '../mocks/plan'

describe('inspection amount from a portfolio', () => {
  it('uses the actual holding amount, weight and horizon without changing the plan', () => {
    const plan = structuredClone(planFixtures.sample)
    const before = structuredClone(plan)
    const holding = plan.cartera[0]
    const inspection = inspectPlanAsset(plan, holding)
    expect(inspection).toEqual({ symbol: holding.simbolo, name: holding.nombre,
      amount: holding.monto, weight: holding.peso, days: plan.numeros.plazo_dias,
      profile: plan.numeros.perfil, basis: 'allocation' })
    expect(inspection.amount).not.toBe(plan.numeros.monto)
    expect(plan).toEqual(before)
  })

  it('labels an unallocated asset as a full-budget illustration, never a holding', () => {
    const plan = planFixtures.sample
    const asset = { simbolo: 'UNALLOCATED', nombre: 'Comparison only' }
    const inspection = inspectPlanAsset(plan, asset)
    expect(inspection.basis).toBe('hypothetical')
    expect(inspection.amount).toBe(plan.numeros.monto)
    expect(inspection.weight).toBeUndefined()
  })
})
