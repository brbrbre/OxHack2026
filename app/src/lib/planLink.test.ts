import { describe, expect, it } from 'vitest'
import type { PlanDraft } from '../components/InvestmentForm'
import { planFromSearch } from './planLink'

const base: PlanDraft = { simbolo: 'SPY', monto: '1000', plazo_dias: 30, perfil: 'moderado', tipos: ['ETFs'] }

describe('reminder link', () => {
  it('opens the app with the plan from the WhatsApp link', () => {
    expect(planFromSearch('?simbolo=WALMEX.MX&monto=500&plazo=180&perfil=conservador', base))
      .toEqual({ ...base, simbolo: 'WALMEX.MX', monto: '500', plazo_dias: 180, perfil: 'conservador' })
  })

  it('ignores missing or invalid values', () => {
    expect(planFromSearch('', base)).toEqual(base)
    expect(planFromSearch('?monto=-5&plazo=45&perfil=yolo', base)).toEqual(base)
  })
})
