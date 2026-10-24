import { ArrowDownRight, ArrowUpRight, CalendarClock, Info, Lightbulb, LoaderCircle } from 'lucide-react'
import type { DecideResponse } from '../api/types'
import { money, percentage } from '../lib/format'
import { DECISION_LABELS, PROFILE_LABELS } from '../lib/labels'
import AssetLogo from './AssetLogo'
import ErrorMessage from './ErrorMessage'

const appearances = {
  INVERTIR: { className: 'invest' },
  ESPERAR: { className: 'wait' },
  NO_POR_AHORA: { className: 'not-now' },
} as const

interface Props {
  result: DecideResponse | null
  pending: boolean
  error: string | null
  onRetry: () => void
  isDemo: boolean
}

export default function DecisionCard({ result, pending, error, onRetry }: Props) {
  const appearance = result ? appearances[result.decision] : null
  const numbers = result?.numeros
  const headline = numbers
    ? numbers.fraccion === 0 ? 'Keep your ' + money(numbers.monto) + ' for now'
      : numbers.fraccion === 1 ? 'Invest the full ' + money(numbers.monto_sugerido) + ' now'
      : 'Invest ' + money(numbers.monto_sugerido) + ' now'
    : ''
  return (
    <section className="panel outlook-panel"
      aria-labelledby="outlook-heading" aria-busy={pending}>
      {result && <div className="panel-heading">
        <span className="model-badge">{result.modelo === 'baseline'
          ? 'Prediction: baseline (3-year historical average)' : 'Prediction: ' + result.modelo}</span>
      </div>}
      <div aria-live="polite" aria-atomic="true">
        {pending ? (
          <div className="outlook-placeholder loading-outlook" role="status">
            <LoaderCircle size={24} aria-hidden="true" />
            <h2 id="outlook-heading" tabIndex={-1}>Checking…</h2>
            <p>Estimating the amount and risk for your plan.</p>
          </div>
        ) : error ? (
          <div className="outlook-placeholder error-outlook">
            <h2 id="outlook-heading" tabIndex={-1}>We couldn't get your answer.</h2>
            <ErrorMessage message={error} onRetry={onRetry} />
          </div>
        ) : result && numbers && appearance ? (
          <>
            <div className="decision-heading">
              <h2 id="outlook-heading" className="suggested-amount" tabIndex={-1}>{headline}</h2>
              <span className={'decision-badge ' + appearance.className}>{DECISION_LABELS[result.decision]}</span>
            </div>
            {numbers.fraccion > 0 && numbers.fraccion < 1 && <p className="allocation-breakdown">
              <span>of your {money(numbers.monto)}</span>
              <span>keep {money(numbers.monto - numbers.monto_sugerido)} for later</span>
            </p>}
            <dl className="plan-summary">
              <div className="plan-summary-asset"><dt>Asset</dt><dd className="asset-name-row">
                <AssetLogo symbol={result.simbolo} size="small" />
                <span className="asset-name-copy"><span>{result.nombre}</span><small>{result.simbolo}</small></span>
              </dd></div>
              <div><dt>Budget</dt><dd>{money(result.numeros.monto)}</dd></div>
              <div><dt>Horizon</dt><dd>{result.numeros.plazo_dias} days</dd></div>
              <div><dt>Risk profile</dt><dd>{PROFILE_LABELS[result.numeros.perfil]}</dd></div>
            </dl>
            <div className="reasons">
              <h3>Here is the thinking</h3>
              <ul>{result.razones.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
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
              <p>Estimated range on your full {money(result.numeros.monto)} over {result.numeros.plazo_dias} days.</p>
            </div>
            <div className="outlook-metrics">
              <div><span>Expected return</span><strong>{percentage(result.numeros.rendimiento_esperado, true)}</strong></div>
              <div><span>Chance of loss</span><strong>{percentage(result.numeros.prob_perdida)}</strong></div>
              <div className="typical-move"><span>Typical move in {result.numeros.plazo_dias} days:</span>
                <strong>±{percentage(result.numeros.volatilidad)}</strong></div>
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
            <h2 id="outlook-heading" tabIndex={-1}>Ready to check your next plan?</h2>
            <p>Adjust your choices, then select Get my answer to see an updated analysis.</p>
          </div>
        )}
      </div>
    </section>
  )
}
