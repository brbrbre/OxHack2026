import { describe, expect, it } from 'vitest'
import type { PlanDraft } from '../components/InvestmentForm'
import { modelLabel } from './labels'
import { modeFromSearch, planFromSearch, reminderFromSearch } from './planLink'

const base: PlanDraft = { simbolo: 'SPY', monto: '1000', plazo_dias: 30, perfil: 'moderado', tipos: ['ETFs'] }

describe('reminder link', () => {
  it('opens the app with the plan from the WhatsApp link', () => {
    expect(planFromSearch('?simbolo=WALMEX.MX&monto=500&plazo=180&perfil=conservador', base))
      .toEqual({ ...base, simbolo: 'WALMEX.MX', monto: '500', plazo_dias: 180, perfil: 'conservador' })
  })

  it('ignores missing or invalid values', () => {
    expect(planFromSearch('', base)).toEqual(base)
    expect(planFromSearch('?monto=-5&plazo=61&perfil=yolo', base)).toEqual(base)
  })

  it.each([1, 37, 60])('restores an arbitrary supported %s-day plan from a new link', (days) => {
    expect(planFromSearch('?simbolo=AAPL&monto=500&plazo=' + days + '&perfil=agresivo', base))
      .toEqual({ ...base, simbolo: 'AAPL', monto: '500', plazo_dias: days, perfil: 'agresivo' })
  })

  it.each([90, 180, 365])('preserves the exact historical %s-day reminder duration', (days) => {
    expect(planFromSearch('?simbolo=SPY&plazo=' + days, base).plazo_dias).toBe(days)
  })

  it.each(['0', '-1', '1.5', '61', '89', '181', 'Infinity', 'text'])('rejects unsupported duration %s', (days) => {
    expect(planFromSearch('?plazo=' + days, base).plazo_dias).toBe(base.plazo_dias)
  })
})

describe('reminder token', () => {
  it('reads the token the reminder link adds', () => {
    expect(reminderFromSearch('?simbolo=SPY&recordatorio=abcDEF_123-xyz')).toBe('abcDEF_123-xyz')
    expect(reminderFromSearch('?simbolo=SPY')).toBeNull()
    expect(reminderFromSearch('?recordatorio=../../etc')).toBeNull()
  })
})

describe('plan reminder link', () => {
  it('reopens Help me choose with the same asset types', () => {
    const search = '?view=planner&modo=plan&tipos=ETFs%2CCrypto&monto=1000&plazo=90&perfil=agresivo&recordatorio=abcDEF_123-xyz'
    expect(modeFromSearch(search)).toBe('plan')
    expect(planFromSearch(search, base)).toMatchObject({ tipos: ['ETFs', 'Crypto'], monto: '1000', plazo_dias: 90, perfil: 'agresivo' })
    expect(modeFromSearch('?simbolo=SPY')).toBe('asset')
    expect(planFromSearch('?simbolo=SPY', base).tipos).toEqual(base.tipos)
  })

  it('restores an automatic 37-day reminder with its types and token without reducing it to a fixed horizon', () => {
    const search = '?view=planner&modo=plan&tipos=ETFs%2CUS%20stocks%2CCrypto&monto=5000.25&plazo=37&perfil=conservador&recordatorio=abcDEF_123-xyz'
    expect(modeFromSearch(search)).toBe('plan')
    expect(planFromSearch(search, base)).toEqual({ ...base, tipos: ['ETFs', 'US stocks', 'Crypto'],
      monto: '5000.25', plazo_dias: 37, perfil: 'conservador' })
    expect(reminderFromSearch(search)).toBe('abcDEF_123-xyz')
  })
})

describe('model name', () => {
  it('shows a readable name, not the internal id', () => {
    expect(modelLabel('tendencia-tda')).toBe('Trend + TDA')
    expect(modelLabel('xgboost')).toBe('XGBoost')
    expect(modelLabel('other')).toBe('other')
  })
})
