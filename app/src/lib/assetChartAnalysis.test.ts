import { describe, expect, it } from 'vitest'
import { decisionFixtures } from '../mocks/decisions'
import { matchingInspectionAnalysis } from './assetChartAnalysis'
import type { AssetInspection } from './assetInspection'

const analysis = decisionFixtures.invest
const selection: AssetInspection = { symbol: analysis.simbolo, name: analysis.nombre, amount: analysis.numeros.monto,
  days: analysis.numeros.plazo_dias, profile: analysis.numeros.perfil, basis: 'allocation', weight: 0.2 }

describe('asset chart analysis reuse', () => {
  it.each(['allocation', 'comparison', 'hypothetical'] as const)('reuses the exact USD analysis for a %s without modifying it', (basis) => {
    const before = structuredClone(analysis)
    expect(matchingInspectionAnalysis({ ...selection, basis }, analysis)).toBe(analysis)
    expect(analysis).toEqual(before)
  })

  it.each([
    { symbol: 'AAPL' }, { amount: selection.amount / 2 }, { amount: selection.amount + 0.001 },
    { days: 90 }, { profile: 'agresivo' as const },
  ])('requires a separate estimate when the USD request differs: %j', (changes) => {
    expect(matchingInspectionAnalysis({ ...selection, ...changes }, analysis)).toBeNull()
  })

  it('never treats a missing analysis as a matching one', () => {
    expect(matchingInspectionAnalysis(selection)).toBeNull()
    expect(matchingInspectionAnalysis(selection, null)).toBeNull()
  })
})
