import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BellRing, Check, ChevronDown, LoaderCircle, X } from 'lucide-react'
import { api } from '../api/client'
import { errorMessage } from '../api/errors'
import type { DecideResponse, HabitStatus } from '../api/types'
import { dateLabel } from '../lib/format'
import { habitSettled, habitSteps } from '../lib/habitSteps'

interface Props {
  result: DecideResponse | null
}

export default function RemindPanel({ result }: Props) {
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<HabitStatus | null>(null)
  const [planned, setPlanned] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const poll = useRef<number | null>(null)
  const request = useRef<AbortController | null>(null)

  function stopPolling() {
    if (poll.current !== null) window.clearInterval(poll.current)
    poll.current = null
  }

  useEffect(() => {
    setStatus(null)
    setPlanned(null)
    setPending(false)
    setError(null)
    return () => {
      request.current?.abort()
      stopPolling()
    }
  }, [result])

  if (!result) return null
  const days = result.numeros.plazo_dias
  const waiting = result.decision !== 'INVERTIR'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!result || pending) return
    const current = new AbortController()
    request.current?.abort()
    request.current = current
    stopPolling()
    setPending(true)
    setError(null)
    try {
      const saved = await api.remind({
        telefono: phone.trim(), consentimiento: consent, simbolo: result.simbolo,
        monto: result.numeros.monto, plazo_dias: days, perfil: result.numeros.perfil,
      }, current.signal)
      if (current.signal.aborted) return
      setPlanned(saved.vence)
      setStatus(saved)
    } catch (err) {
      if (!current.signal.aborted) setError(errorMessage(err))
    } finally {
      if (!current.signal.aborted) setPending(false)
    }
  }

  async function sendNow() {
    if (!status || pending) return
    const current = new AbortController()
    request.current?.abort()
    request.current = current
    stopPolling()
    setPending(true)
    setError(null)
    try {
      const saved = await api.habitNow(status.token, current.signal)
      if (current.signal.aborted) return
      setStatus(saved)
      if (habitSettled(saved)) return
      const started = Date.now()
      let reading = false
      poll.current = window.setInterval(async () => {
        if (current.signal.aborted || Date.now() - started >= 10 * 60_000) {
          stopPolling()
          return
        }
        if (reading) return
        reading = true
        try {
          const next = await api.habitStatus(status.token, current.signal)
          if (current.signal.aborted) return
          setStatus(next)
          if (habitSettled(next) || Date.now() - started >= 10 * 60_000) {
            stopPolling()
          }
        } catch {
          if (current.signal.aborted || Date.now() - started >= 10 * 60_000) stopPolling()
          // Keep the last known state when a status request fails.
        } finally {
          reading = false
        }
      }, 4000)
    } catch (err) {
      if (!current.signal.aborted) setError(errorMessage(err))
    } finally {
      if (!current.signal.aborted) setPending(false)
    }
  }

  return (
    <details className="remind-panel optional-panel" aria-labelledby="remind-heading">
      <summary className="optional-panel-summary">
        <h3 id="remind-heading"><BellRing size={18} aria-hidden="true" /> Make it a habit</h3>
        <ChevronDown className="optional-panel-chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="optional-panel-body">
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
            {habitSteps(status).map((step) => <li key={step.key} className={step.state === 'waiting' ? '' : step.state}>
              {step.state === 'done' ? <Check size={16} aria-hidden="true" />
                : step.state === 'missed' ? <X size={16} aria-hidden="true" /> : <span className="step-dot" aria-hidden="true" />}
              {step.label}
            </li>)}
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
      </div>
    </details>
  )
}
