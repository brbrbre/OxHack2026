import { describe, expect, it } from 'vitest'
import type { PlanDraft } from '../components/InvestmentForm'
import { hasPlanLink, planFromSearch } from './planLink'

const base: PlanDraft = { simbolo: 'SPY', monto: '1000', plazo_dias: 30, perfil: 'moderado', tipos: ['ETFs'] }

describe('reminder link', () => {
  it('recognizes only a complete valid plan link, independently of the landing route', () => {
    expect(hasPlanLink('?simbolo=SPY&monto=1000.5&plazo=90&perfil=moderado')).toBe(true)
    for (const search of ['', '?simbolo=SPY', '?monto=1000&plazo=90&perfil=moderado',
      '?simbolo=SPY&monto=-5&plazo=90&perfil=moderado', '?simbolo=SPY&monto=Infinity&plazo=90&perfil=moderado',
      '?simbolo=SPY&monto=1000&plazo=45&perfil=moderado', '?simbolo=SPY&monto=1000&plazo=90&perfil=yolo']) {
      expect(hasPlanLink(search)).toBe(false)
    }
  })
  it('opens the app with the plan from the WhatsApp link', () => {
    expect(planFromSearch('?simbolo=WALMEX.MX&monto=500&plazo=180&perfil=conservador', base))
      .toEqual({ ...base, simbolo: 'WALMEX.MX', monto: '500', plazo_dias: 180, perfil: 'conservador' })
  })

  it('ignores missing or invalid values', () => {
    expect(planFromSearch('', base)).toEqual(base)
    expect(planFromSearch('?monto=-5&plazo=45&perfil=yolo', base)).toEqual(base)
  })
})
