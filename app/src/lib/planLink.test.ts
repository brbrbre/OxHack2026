import { describe, expect, it } from 'vitest'
import type { PlanDraft } from '../components/InvestmentForm'
import { planFromSearch, reminderFromSearch } from './planLink'

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

describe('reminder token', () => {
  it('reads the token the reminder link adds', () => {
    expect(reminderFromSearch('?simbolo=SPY&recordatorio=abcDEF_123-xyz')).toBe('abcDEF_123-xyz')
    expect(reminderFromSearch('?simbolo=SPY')).toBeNull()
    expect(reminderFromSearch('?recordatorio=../../etc')).toBeNull()
  })
})
