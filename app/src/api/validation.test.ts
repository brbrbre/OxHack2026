import { describe, expect, it } from 'vitest'
import { decisionFixtures } from '../mocks/decisions'
import { planFixtures } from '../mocks/plan'
import { parseDecision, parsePlan } from './validation'

describe('investment sizing contract', () => {
  it.each([0, 0.455, 1])('accepts a matching allocation fraction of %s', (fraction) => {
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.fraccion = fraction
    result.numeros.monto_sugerido = result.numeros.monto * fraction
    expect(parseDecision(result)).toBe(result)
  })

  it.each([-0.2, 0, 0.14, null])('preserves a historic trend of %s', (trend) => {
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.tendencia_12m = trend
    expect(parseDecision(result).numeros.tendencia_12m).toBe(trend)
  })

  it.each(['fraccion', 'monto_sugerido', 'tendencia_12m'])('requires the new %s field', (key) => {
    const result = structuredClone(decisionFixtures.invest)
    Reflect.deleteProperty(result.numeros, key)
    expect(() => parseDecision(result)).toThrow('incomplete analysis')
  })

  it.each([
    { fraccion: -0.1 }, { fraccion: 1.1 }, { fraccion: Number.NaN },
    { fraccion: null }, { fraccion: '1' },
    { monto_sugerido: -1 }, { monto_sugerido: 1001 },
    { monto_sugerido: Number.POSITIVE_INFINITY }, { monto_sugerido: null },
    { tendencia_12m: Number.NaN }, { tendencia_12m: Number.POSITIVE_INFINITY }, { tendencia_12m: '0.14' },
  ])('rejects invalid sizing or trend values: %j', (patch) => {
    const result = structuredClone(decisionFixtures.invest)
    Object.assign(result.numeros, patch)
    expect(() => parseDecision(result)).toThrow('incomplete analysis')
  })

  it('rejects a suggested amount that disagrees with its fraction', () => {
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.fraccion = 0.5
    expect(() => parseDecision(result)).toThrow('incomplete analysis')
  })
})

describe('portfolio plan contract', () => {
  it('accepts an allocated plan and the all-cash response', () => {
    expect(parsePlan(planFixtures.sample)).toEqual(planFixtures.sample)
    expect(parsePlan(planFixtures.allCash)).toEqual(planFixtures.allCash)
    expect(planFixtures.allCash.cartera).toEqual([])
    expect(planFixtures.allCash.efectivo).toBe(planFixtures.allCash.numeros.monto)
  })

  it('allows empty classification lists and a positive lower bound', () => {
    const result = structuredClone(planFixtures.allCash)
    result.invertir = []
    result.esperar = []
    result.no_por_ahora = []
    result.numeros.peor_caso = 1
    expect(parsePlan(result)).toBe(result)
  })

  it.each(['cartera', 'efectivo', 'invertir', 'esperar', 'no_por_ahora', 'resumen', 'numeros', 'modelo', 'aviso'])(
    'requires the plan field %s', (key) => {
      const result = structuredClone(planFixtures.sample)
      Reflect.deleteProperty(result, key)
      expect(() => parsePlan(result)).toThrow('incomplete investment plan')
    },
  )

  it.each(['monto', 'plazo_dias', 'perfil', 'invertido', 'rendimiento_esperado', 'volatilidad', 'peor_caso', 'tolerancia'])(
    'requires the plan numeric field %s', (key) => {
      const result = structuredClone(planFixtures.sample)
      Reflect.deleteProperty(result.numeros, key)
      expect(() => parsePlan(result)).toThrow('incomplete investment plan')
    },
  )

  it.each([
    { volatilidad: -0.1 }, { volatilidad: Number.NaN }, { tolerancia: 1.1 },
    { tolerancia: null }, { peor_caso: Number.NEGATIVE_INFINITY },
    { invertido: -1 }, { plazo_dias: 0.5 }, { perfil: 'medium' },
  ])('rejects invalid plan numbers: %j', (patch) => {
    const result = structuredClone(planFixtures.sample)
    Object.assign(result.numeros, patch)
    expect(() => parsePlan(result)).toThrow('incomplete investment plan')
  })

  it('rejects inconsistent cash or portfolio totals', () => {
    const result = structuredClone(planFixtures.sample)
    result.efectivo += 100
    expect(() => parsePlan(result)).toThrow('incomplete investment plan')
    result.efectivo -= 100
    result.cartera[0].monto += 100
    expect(() => parsePlan(result)).toThrow('incomplete investment plan')
  })

  it('keeps portfolio weights relative to the full budget, including cash', () => {
    const result = structuredClone(planFixtures.sample)
    result.cartera = result.cartera.slice(0, 1)
    result.numeros.invertido = result.cartera[0].monto
    result.efectivo = result.numeros.monto - result.numeros.invertido
    expect(result.cartera[0].peso).toBeLessThanOrEqual(0.4)
    expect(parsePlan(result)).toBe(result)
  })

  it('accepts insignificant floating point differences', () => {
    const result = structuredClone(planFixtures.sample)
    result.efectivo += 1e-10
    expect(parsePlan(result)).toBe(result)
  })

  it('preserves a consistent API allocation above its documented 40 percent target', () => {
    const result = structuredClone(planFixtures.sample)
    result.cartera = result.cartera.slice(0, 1)
    result.cartera[0].peso = 0.405070562
    result.cartera[0].monto = result.numeros.monto * result.cartera[0].peso
    result.numeros.invertido = result.cartera[0].monto
    result.efectivo = result.numeros.monto - result.numeros.invertido
    expect(parsePlan(result)).toBe(result)
  })

  it('rejects missing candidate copy, null fractions and duplicate classifications', () => {
    const result = structuredClone(planFixtures.sample)
    Reflect.deleteProperty(result.invertir[0], 'razon')
    expect(() => parsePlan(result)).toThrow('incomplete investment plan')
    const nullFraction = structuredClone(planFixtures.sample)
    Object.assign(nullFraction.invertir[0], { fraccion: null })
    expect(() => parsePlan(nullFraction)).toThrow('incomplete investment plan')
    const duplicate = structuredClone(planFixtures.sample)
    duplicate.esperar.push({ ...duplicate.invertir[0] })
    expect(() => parsePlan(duplicate)).toThrow('incomplete investment plan')
  })

  it('rejects positions missing from the invest group', () => {
    const result = structuredClone(planFixtures.sample)
    result.invertir = result.invertir.filter((asset) => asset.simbolo !== result.cartera[0].simbolo)
    expect(() => parsePlan(result)).toThrow('incomplete investment plan')
  })
})
