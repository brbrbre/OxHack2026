import { describe, expect, it } from 'vitest'
import type { HabitStatus } from '../api/types'
import { habitSettled, habitSteps } from './habitSteps'

const base: HabitStatus = {
  token: 't', vence: '2026-10-25T09:00:00+00:00', estado: 'enviado', enviado_en: '2026-10-25T09:00:00+00:00',
  abierto_en: null, llamado_en: null, error: null, simbolo: 'SPY', plazo_dias: 30, demo: true,
  mensaje_estado: 'queued', llamada_estado: null,
}

const step = (s: HabitStatus, key: string) => habitSteps(s).find((x) => x.key === key)!

describe('reminder steps', () => {
  it('says delivered only when Twilio says so', () => {
    expect(step(base, 'sent')).toEqual({ key: 'sent', label: 'WhatsApp sent', state: 'done' })
    expect(step({ ...base, mensaje_estado: 'delivered' }, 'sent').label).toBe('WhatsApp delivered')
    expect(step({ ...base, mensaje_estado: 'undelivered' }, 'sent')).toEqual({ key: 'sent', label: 'WhatsApp not delivered', state: 'missed' })
    expect(step({ ...base, enviado_en: null, estado: 'pendiente' }, 'sent').state).toBe('waiting')
  })

  it('does not claim a call that nobody answered', () => {
    expect(step({ ...base, estado: 'llamando', llamada_estado: 'queued' }, 'next')).toEqual({ key: 'next', label: 'Placing the call…', state: 'waiting' })
    expect(step({ ...base, estado: 'llamando', llamada_estado: 'ringing' }, 'next').label).toBe('Calling you now…')
    expect(step({ ...base, estado: 'sin_respuesta', llamada_estado: 'busy' }, 'next')).toEqual({ key: 'next', label: 'We called, but the line was busy', state: 'missed' })
    expect(step({ ...base, estado: 'sin_respuesta', llamada_estado: 'no-answer' }, 'next').label).toBe('We called, but nobody answered')
    expect(step({ ...base, estado: 'llamado', llamada_estado: 'completed', llamado_en: base.vence }, 'next')).toEqual({ key: 'next', label: 'Not opened yet, so we called you', state: 'done' })
  })

  it('an opened link wins over the call', () => {
    expect(step({ ...base, estado: 'sin_respuesta', abierto_en: base.vence }, 'next').label).toBe('You opened the reminder')
  })

  it('stops polling only when nothing else can change', () => {
    expect(habitSettled(base)).toBe(false)
    expect(habitSettled({ ...base, estado: 'llamando' })).toBe(false)
    expect(habitSettled({ ...base, estado: 'sin_respuesta' })).toBe(true)
    expect(habitSettled({ ...base, estado: 'llamado' })).toBe(true)
    expect(habitSettled({ ...base, abierto_en: base.vence })).toBe(true)
  })
})
