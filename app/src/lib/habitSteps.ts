import type { HabitStatus } from '../api/types'

export type StepState = 'done' | 'missed' | 'waiting'

export interface HabitStep {
  key: 'saved' | 'sent' | 'next'
  label: string
  state: StepState
}

const CALL_MISSED: Record<string, string> = {
  busy: 'the line was busy',
  'no-answer': 'nobody answered',
  failed: 'the call failed',
  canceled: 'the call was canceled',
}

/** The three steps of the reminder, told as Twilio reports them, not as we hoped they went. */
export function habitSteps(s: HabitStatus): HabitStep[] {
  const message = s.mensaje_estado ?? null
  const sent: HabitStep = !s.enviado_en ? { key: 'sent', label: 'WhatsApp sent', state: 'waiting' }
    : message === 'delivered' || message === 'read' ? { key: 'sent', label: 'WhatsApp delivered', state: 'done' }
    : message === 'failed' || message === 'undelivered' ? { key: 'sent', label: 'WhatsApp not delivered', state: 'missed' }
    : { key: 'sent', label: 'WhatsApp sent', state: 'done' }

  const call = s.llamada_estado ?? ''
  const next: HabitStep = s.abierto_en ? { key: 'next', label: 'You opened the reminder', state: 'done' }
    : s.estado === 'llamado' ? { key: 'next', label: 'Not opened yet, so we called you', state: 'done' }
    : s.estado === 'sin_respuesta' ? { key: 'next', label: `We called, but ${CALL_MISSED[call] ?? 'the call did not connect'}`, state: 'missed' }
    : s.estado === 'llamando' ? { key: 'next', label: call === 'ringing' || call === 'in-progress' ? 'Calling you now…' : 'Placing the call…', state: 'waiting' }
    : { key: 'next', label: 'Opened, or we call you', state: 'waiting' }

  return [{ key: 'saved', label: 'Reminder saved', state: 'done' }, sent, next]
}

/** The panel stops asking once nothing else can change. */
export function habitSettled(s: HabitStatus): boolean {
  return Boolean(s.abierto_en) || s.estado === 'llamado' || s.estado === 'sin_respuesta' || s.estado === 'error'
}
