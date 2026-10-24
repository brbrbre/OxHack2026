import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BellRing, Check, LoaderCircle } from 'lucide-react'
import { api } from '../api/client'
import { errorMessage } from '../api/errors'
import type { DecideResponse, HabitStatus } from '../api/types'
import { dateLabel } from '../lib/format'

interface Props {
  result: DecideResponse | null
}

const STEPS: { key: string, label: string, done: (s: HabitStatus) => boolean }[] = [
  { key: 'saved', label: 'Reminder saved', done: () => true },
  { key: 'sent', label: 'WhatsApp sent', done: (s) => Boolean(s.enviado_en) },
  { key: 'next', label: 'Opened, or we call you', done: (s) => Boolean(s.abierto_en || s.llamado_en) },
]

export default function RemindPanel({ result }: Props) {
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<HabitStatus | null>(null)
  const [planned, setPlanned] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const poll = useRef<number | null>(null)

  useEffect(() => {
    setStatus(null)
    setError(null)
    return () => { if (poll.current) window.clearInterval(poll.current) }
  }, [result])

  if (!result) return null
  const days = result.numeros.plazo_dias
  const waiting = result.decision !== 'INVERTIR'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!result || pending) return
    setPending(true)
    setError(null)
    try {
      const saved = await api.remind({
        telefono: phone.trim(), consentimiento: consent, simbolo: result.simbolo,
        monto: result.numeros.monto, plazo_dias: days, perfil: result.numeros.perfil,
      })
      setPlanned(saved.vence)
      setStatus(saved)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function sendNow() {
    if (!status || pending) return
    setPending(true)
    setError(null)
    try {
      setStatus(await api.habitNow(status.token))
      if (poll.current) window.clearInterval(poll.current)
      const started = Date.now()
      poll.current = window.setInterval(async () => {
        try {
          const next = await api.habitStatus(status.token)
          setStatus(next)
          if (next.abierto_en || next.llamado_en || next.estado === 'error' || Date.now() - started > 10 * 60_000) {
            if (poll.current) window.clearInterval(poll.current)
          }
        } catch { /* keep the last known state */ }
      }, 4000)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="remind-panel" aria-labelledby="remind-heading">
      <h3 id="remind-heading"><BellRing size={18} aria-hidden="true" /> Make it a habit</h3>
      <p className="remind-intro">
        {waiting
          ? `We'll tell you on WhatsApp when the ${days}-day waiting period ends, with that day's answer.`
          : `In ${days} days we'll message you on WhatsApp to review this plan with fresh numbers.`}
        {' '}If you don't open it, we give you a short call.
      </p>
      {!status ? (
        <form className="remind-form" onSubmit={submit}>
          <label htmlFor="remind-phone">Your WhatsApp number</label>
          <input id="remind-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 555 010 0123"
            value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} />
          <label className="remind-consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>I agree to one WhatsApp message and, if I don't open it, one phone call about this reminder.</span>
          </label>
          <button type="submit" className="remind-button" disabled={pending || !consent || phone.trim().length < 8}>
            {pending ? 'Saving…' : `Remind me in ${days} days`}
          </button>
        </form>
      ) : (
        <div className="remind-status" aria-live="polite">
          <p>Reminder set for <strong>{dateLabel((planned ?? status.vence).slice(0, 10), true)}</strong>.</p>
          <ol className="remind-steps">
            {STEPS.map((step) => {
              const done = step.done(status)
              return <li key={step.key} className={done ? 'done' : ''}>
                {done ? <Check size={16} aria-hidden="true" /> : <span className="step-dot" aria-hidden="true" />}
                {step.key === 'next' && status.llamado_en ? 'Not opened yet, so we called you' :
                  step.key === 'next' && status.abierto_en ? 'You opened the reminder' : step.label}
              </li>
            })}
          </ol>
          {status.estado === 'error' && <p className="field-error" role="alert">We could not send it: {status.error}</p>}
          {status.demo && !status.enviado_en && (
            <button type="button" className="remind-button secondary" onClick={() => void sendNow()} disabled={pending}>
              {pending ? <><LoaderCircle size={16} aria-hidden="true" /> Sending…</> : `Demo: skip the ${days} days and send it now`}
            </button>
          )}
        </div>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  )
}
