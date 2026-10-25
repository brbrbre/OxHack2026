import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BellRing, Check, ChevronDown, LoaderCircle, X } from 'lucide-react'
import { api } from '../api/client'
import { errorMessage } from '../api/errors'
import type { DecideResponse, HabitStatus, PlanResponse } from '../api/types'
import { useI18n } from '../i18n/I18nContext'
import { localizeKnownError } from '../i18n/errors'
import { habitSettled, habitSteps } from '../lib/habitSteps'

interface Props {
  result: DecideResponse | null
  /** A "Help me choose" plan: the reminder re-runs the plan with the same asset types. */
  plan?: PlanResponse | null
  tipos?: string[]
}

export default function RemindPanel({ result, plan = null, tipos = [] }: Props) {
  const { t, dateLabel } = useI18n()
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
  }, [result, plan])

  const numbers = result?.numeros ?? plan?.numeros
  if (!numbers) return null
  const days = numbers.plazo_dias

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!numbers || pending) return
    const current = new AbortController()
    request.current?.abort()
    request.current = current
    stopPolling()
    setPending(true)
    setError(null)
    try {
      const target = result ? { simbolo: result.simbolo } : { tipos }
      const saved = await api.remind({
        telefono: phone.trim(), consentimiento: consent, ...target,
        monto: numbers.monto, plazo_dias: days, perfil: numbers.perfil,
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
        <h3 id="remind-heading"><BellRing size={18} aria-hidden="true" /> {t('Make it a habit')}</h3>
        <ChevronDown className="optional-panel-chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="optional-panel-body">
      <p className="remind-intro">
        {t("In {days} days we'll message you on WhatsApp to review this plan with fresh numbers.", { days })}
        {' '}{t("If you don't open it, we give you a short call.")}
      </p>
      {!status ? (
        <form className="remind-form" onSubmit={submit}>
          <label htmlFor="remind-phone">{t('Your WhatsApp number')}</label>
          <input id="remind-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 555 010 0123"
            value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} />
          <label className="remind-consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>{t("I agree to one WhatsApp message and, if I don't open it, one phone call about this reminder.")}</span>
          </label>
          <button type="submit" className="remind-button" disabled={pending || !consent || phone.trim().length < 8}>
            {pending ? t('Saving…') : t('Remind me in {days} days', { days })}
          </button>
        </form>
      ) : (
        <div className="remind-status" aria-live="polite">
          <p>{t('Reminder set for')} <strong>{dateLabel((planned ?? status.vence).slice(0, 10), true)}</strong>.</p>
          <ol className="remind-steps">
            {habitSteps(status).map((step) => <li key={step.key} className={step.state === 'waiting' ? '' : step.state}>
              {step.state === 'done' ? <Check size={16} aria-hidden="true" />
                : step.state === 'missed' ? <X size={16} aria-hidden="true" /> : <span className="step-dot" aria-hidden="true" />}
              {t(step.label)}
            </li>)}
          </ol>
          {status.estado === 'error' && <p className="field-error" role="alert">{t('We could not send it:')} {status.error}</p>}
          {status.demo && !status.enviado_en && (
            <button type="button" className="remind-button secondary" onClick={() => void sendNow()} disabled={pending}>
              {pending ? <><LoaderCircle size={16} aria-hidden="true" /> {t('Sending…')}</> : t('Demo: skip the {days} days and send it now', { days })}
            </button>
          )}
        </div>
      )}
      {error && <p className="field-error" role="alert">{localizeKnownError(error, t)}</p>}
      </div>
    </details>
  )
}
