import { ArrowDownRight, ArrowUpRight, CalendarClock, Check, Clock3, Compass, Info, Lightbulb, LoaderCircle, ShieldAlert } from 'lucide-react'
import type { DecideResponse } from '../api/types'
import { money, percentage } from '../lib/format'
import { DECISION_LABELS, PROFILE_LABELS } from '../lib/labels'
import ErrorMessage from './ErrorMessage'

const appearances = {
  INVERTIR: { className: 'invest', Icon: ArrowUpRight, subtitle: 'Your outlook suggests an opportunity.' },
  ESPERAR: { className: 'wait', Icon: Clock3, subtitle: 'A little patience could bring more clarity.' },
  NO_POR_AHORA: { className: 'not-now', Icon: ShieldAlert, subtitle: 'It may be worth exploring another approach.' },
} as const

interface Props {
  result: DecideResponse | null
  pending: boolean
  error: string | null
  onRetry: () => void
  isDemo: boolean
}

export default function DecisionCard({ result, pending, error, onRetry, isDemo }: Props) {
  const appearance = result ? appearances[result.decision] : null
  return (
    <section className={'panel outlook-panel ' + (appearance?.className ?? '')}
      aria-labelledby="outlook-heading" aria-busy={pending}>
      <div className="panel-heading">
        <div className="section-eyebrow"><span className="step-number">02</span> YOUR OUTLOOK</div>
        {result && <span className="model-badge">{isDemo ? 'Sample' : 'Model'} · {result.modelo}</span>}
      </div>
      <div aria-live="polite" aria-atomic="true">
        {pending ? (
          <div className="outlook-placeholder loading-outlook" role="status">
            <div className="placeholder-icon"><LoaderCircle size={29} className="spin" aria-hidden="true" /></div>
            <h2 id="outlook-heading">Putting things in perspective.</h2>
            <p>Bringing your plan and its potential risks together.</p>
            <div className="loading-bars" aria-hidden="true"><span /><span /><span /></div>
          </div>
        ) : error ? (
          <div className="outlook-placeholder error-outlook">
            <h2 id="outlook-heading">We could not build your outlook.</h2>
            <ErrorMessage message={error} onRetry={onRetry} />
          </div>
        ) : result && appearance ? (
          <>
            <div className="decision-heading">
              <div className="decision-symbol"><appearance.Icon size={29} strokeWidth={1.7} aria-hidden="true" /></div>
              <div><h2 id="outlook-heading" className="decision-title">{DECISION_LABELS[result.decision]}</h2>
                <p className="decision-subtitle">{appearance.subtitle}</p>
              </div>
            </div>
            <div className="plan-summary">
              <strong>{result.simbolo}</strong><span className="summary-divider" />
              <span>{money(result.numeros.monto)}</span><span className="summary-divider" />
              <span>{result.numeros.plazo_dias} days</span><span className="summary-divider" />
              <span>{PROFILE_LABELS[result.numeros.perfil]}</span>
            </div>
            <div className="reasons">
              <h3>Here is the thinking</h3>
              <ul>{result.razones.map((reason, index) => <li key={index}>
                <span className="reason-check"><Check size={12} strokeWidth={2.5} aria-hidden="true" /></span>
                <span>{reason}</span>
              </li>)}</ul>
            </div>
            {result.recomendaciones.length > 0 && (
              <div className="recommendations">
                <h3><Lightbulb size={16} aria-hidden="true" /> What you could do next</h3>
                <ul>{result.recomendaciones.map((item, index) => <li key={index}>{item}</li>)}</ul>
              </div>
            )}
            <div className="range-section">
              <div className="range-heading"><h3>Your potential range</h3>
                <span title="These model estimates are not guaranteed limits."><Info size={14} aria-label="Model estimates, not guaranteed limits" /></span>
              </div>
              <div className="range-grid">
                <div className="range-value downside"><span><ArrowDownRight size={14} aria-hidden="true" /> Worst case estimate</span>
                  <strong>{money(result.numeros.peor_caso, true)}</strong></div>
                <div className="range-value upside"><span><ArrowUpRight size={14} aria-hidden="true" /> Best case estimate</span>
                  <strong>{money(result.numeros.mejor_caso, true)}</strong></div>
              </div>
              <div className="range-track" aria-hidden="true"><span /></div>
              <p>Estimated change on {money(result.numeros.monto)} over {result.numeros.plazo_dias} days.</p>
            </div>
            <div className="outlook-metrics">
              <div><span>Expected return</span><strong>{percentage(result.numeros.rendimiento_esperado, true)}</strong></div>
              <div><span>Chance of loss</span><strong>{percentage(result.numeros.prob_perdida)}</strong></div>
              <div><span>Volatility</span><strong>{percentage(result.numeros.volatilidad)}</strong></div>
            </div>
            {result.numeros.eventos.length > 0 && (
              <div className="events-list"><CalendarClock size={16} aria-hidden="true" />
                <div><strong>On the calendar</strong>
                  {result.numeros.eventos.map((event, index) => <p key={index}>{event}</p>)}</div>
              </div>
            )}
          </>
        ) : (
          <div className="outlook-placeholder">
            <div className="placeholder-icon"><Compass size={32} strokeWidth={1.3} aria-hidden="true" /></div>
            <span className="placeholder-eyebrow">A LITTLE CONTEXT GOES A LONG WAY</span>
            <h2 id="outlook-heading">An informed next move<br />starts with your plan.</h2>
            <p>Choose an asset, set your horizon, and explore<br className="desktop-break" /> the potential upside and the risks alongside it.</p>
            <div className="placeholder-chips"><span><Check size={12} aria-hidden="true" /> Clear reasoning</span>
              <span><Check size={12} aria-hidden="true" /> Risk in perspective</span></div>
          </div>
        )}
      </div>
    </section>
  )
}
