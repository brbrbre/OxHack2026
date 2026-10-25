import { ArrowDownRight, ArrowUpRight, CalendarClock, Info, Lightbulb, LoaderCircle } from 'lucide-react'
import type { DecideResponse } from '../api/types'
import { useCurrency } from '../currency/CurrencyContext'
import { useI18n } from '../i18n/I18nContext'
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
  headingId?: string
}

export default function DecisionCard({ result, pending, error, onRetry, headingId = 'outlook-heading' }: Props) {
  const { money, currency } = useCurrency()
  const { t, percentage } = useI18n()
  const appearance = result ? appearances[result.decision] : null
  const numbers = result?.numeros
  // Keep the whole-dollar headline without rounding USD before FX conversion.
  const wholeDollars = currency === 'USD' && numbers && numbers.monto >= 1
  const budget = numbers ? wholeDollars ? Math.round(numbers.monto) : numbers.monto : 0
  const suggested = numbers ? Math.min(numbers.monto_sugerido, numbers.monto) : 0
  const uninvested = numbers ? Math.max(0, numbers.monto - suggested) : 0
  const partial = suggested > 0 && uninvested > 0
  const roundedNow = wholeDollars && suggested >= 1 ? Math.round(suggested) : suggested
  // Do not round a positive amount to zero or make a partial amount look like the full budget.
  const now = partial && roundedNow >= budget ? suggested : roundedNow
  const headline = numbers
    ? suggested <= 0 ? t('Keep your {amount} for now', { amount: money(budget) })
      : result?.decision !== 'INVERTIR' ? t('Suggested now: {amount}', { amount: money(now) })
      : !partial ? t('Invest the full {amount} now', { amount: money(budget) })
      : t('Invest {amount} now', { amount: money(now) })
    : ''
  return (
    <section className="panel outlook-panel"
      aria-labelledby={headingId} aria-busy={pending}>
      {result && <div className="panel-heading">
        <span className="model-badge">{result.modelo === 'baseline'
          ? t('Prediction: baseline (3-year historical average)') : t('Prediction: {model}', { model: result.modelo })}</span>
      </div>}
      <div aria-live="polite" aria-atomic="true">
        {pending ? (
          <div className="outlook-placeholder loading-outlook" role="status">
            <LoaderCircle size={24} aria-hidden="true" />
            <h2 id={headingId} tabIndex={-1}>{t('Checking…')}</h2>
            <p>{t('Estimating the amount and risk for your plan.')}</p>
          </div>
        ) : error ? (
          <div className="outlook-placeholder error-outlook">
            <h2 id={headingId} tabIndex={-1}>{t("We couldn't get your answer.")}</h2>
            <ErrorMessage message={error} onRetry={onRetry} />
          </div>
        ) : result && numbers && appearance ? (
          <>
            <div className="decision-heading">
              <h2 id={headingId} className="suggested-amount" tabIndex={-1}>{headline}</h2>
              <span className={'decision-badge ' + appearance.className}>{t(DECISION_LABELS[result.decision])}</span>
            </div>
            {result.decision === 'ESPERAR' && partial && <p className="decision-sizing-note">{t('A smaller starting amount; the rest stays uninvested.')}</p>}
            {suggested <= 0 && <p className="decision-sizing-note">{t('No investment is suggested now. Your full budget stays uninvested.')}</p>}
            <section className="decision-money-plan" aria-label={t('How your {amount} is split', { amount: money(numbers.monto) })}>
              <h3>{t('How your {amount} is split', { amount: money(numbers.monto) })}</h3>
              <dl className="decision-money-split">
                <div><dt>{t('Suggested investment now')}</dt><dd>{money(suggested)}</dd></div>
                <div><dt>{t('Keep uninvested for now')}</dt><dd>{money(uninvested)}</dd></div>
              </dl>
              <p>{t('These amounts come from your budget. They are not profits.')}</p>
            </section>
            <dl className="plan-summary">
              <div className="plan-summary-asset"><dt>{t('Asset')}</dt><dd className="asset-name-row">
                <AssetLogo symbol={result.simbolo} size="small" />
                <span className="asset-name-copy"><span>{result.nombre}</span><small>{result.simbolo}</small></span>
              </dd></div>
              <div><dt>{t('Budget')}</dt><dd>{money(result.numeros.monto)}</dd></div>
              <div><dt>{t('Investment period')}</dt><dd>{t('{days} days', { days: result.numeros.plazo_dias })}</dd></div>
              <div><dt>{t('Risk profile')}</dt><dd>{t(PROFILE_LABELS[result.numeros.perfil])}</dd></div>
            </dl>
            <div className="reasons">
              <h3>{t('Here is the thinking')}</h3>
              <p className="decision-estimate-basis">{partial
                ? t('The gain and loss estimates below use the full {amount} over {days} days, not just the suggested {suggested}.', {
                  amount: money(numbers.monto), days: numbers.plazo_dias, suggested: money(suggested),
                }) : t('The estimates below assume the full {amount} is invested for {days} days.', {
                  amount: money(numbers.monto), days: numbers.plazo_dias,
                })}</p>
              {currency !== 'USD' && <p className="field-hint currency-explanation-note">{t('Written explanations use USD; the amounts above use {currency}.', { currency })}</p>}
              <ul>{result.razones.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
            </div>
            {result.recomendaciones.length > 0 && (
              <div className="recommendations">
                <h3><Lightbulb size={16} aria-hidden="true" /> {t('What you could do next')}</h3>
                <ul>{result.recomendaciones.map((item, index) => <li key={index}>{item}</li>)}</ul>
              </div>
            )}
            <div className="range-section">
              <div className="range-heading"><h3>{t('Your potential range')}</h3>
                <span title={t('These model estimates are not guaranteed limits.')}><Info size={14} aria-label={t('Model estimates, not guaranteed limits')} /></span>
              </div>
              <div className="range-grid">
                <div className="range-value downside"><span><ArrowDownRight size={14} aria-hidden="true" /> {t('Worst case estimate')}</span>
                  <strong>{money(result.numeros.peor_caso, true)}</strong></div>
                <div className="range-value upside"><span><ArrowUpRight size={14} aria-hidden="true" /> {t('Best case estimate')}</span>
                  <strong>{money(result.numeros.mejor_caso, true)}</strong></div>
              </div>
              <p>{t('Estimated range on your full {amount} over {days} days.', { amount: money(result.numeros.monto), days: result.numeros.plazo_dias })}</p>
            </div>
            <div className="outlook-metrics">
              <div><span>{t('Expected return')}</span><strong>{percentage(result.numeros.rendimiento_esperado, true)}</strong></div>
              <div><span>{t('Chance of loss')}</span><strong>{percentage(result.numeros.prob_perdida)}</strong></div>
              <div className="typical-move"><span>{t('Typical move in {days} days:', { days: result.numeros.plazo_dias })}</span>
                <strong>±{percentage(result.numeros.volatilidad)}</strong></div>
            </div>
            {result.numeros.eventos.length > 0 && (
              <div className="events-list"><CalendarClock size={16} aria-hidden="true" />
                <div><strong>{t('On the calendar')}</strong>
                  {result.numeros.eventos.map((event, index) => <p key={index}>{event}</p>)}</div>
              </div>
            )}
          </>
        ) : (
          <div className="outlook-placeholder">
            <h2 id={headingId} tabIndex={-1}>{t('Ready to check your next plan?')}</h2>
            <p>{t('Adjust your choices, then select Get my answer to see an updated analysis.')}</p>
          </div>
        )}
      </div>
    </section>
  )
}
