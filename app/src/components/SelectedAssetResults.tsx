import { LoaderCircle } from 'lucide-react'
import type { DecideResponse } from '../api/types'
import { useCurrency } from '../currency/CurrencyContext'
import { useI18n } from '../i18n/I18nContext'
import { DECISION_LABELS } from '../lib/labels'
import AssetLogo from './AssetLogo'
import ErrorMessage from './ErrorMessage'
import '../selected-asset-results.css'

interface Props {
  results: DecideResponse[]
  budget: number
  selectedSymbol?: string
  pending: boolean
  error: string | null
  onRetry: () => void
  onSelect: (result: DecideResponse) => void
}

const tones = { INVERTIR: 'invest', ESPERAR: 'wait', NO_POR_AHORA: 'not-now' } as const

export default function SelectedAssetResults({ results, budget, selectedSymbol, pending, error, onRetry, onSelect }: Props) {
  const { money } = useCurrency()
  const { t } = useI18n()
  return <section className="panel outlook-panel selected-asset-results" aria-labelledby="outlook-heading" aria-busy={pending}>
    <h2 id="outlook-heading" tabIndex={-1}>{t('Your selected investments')}</h2>
    {pending ? <p className="selected-results-loading" role="status"><LoaderCircle size={20} aria-hidden="true" />{t('Checking each asset with its share of your budget…')}</p>
      : error ? <ErrorMessage message={error} onRetry={onRetry} />
      : results.length ? <>
        <p className="selected-results-intro">{t('Your {budget} budget is split equally for comparison. Each answer is calculated separately; this is not an optimized portfolio or a combined risk estimate.', { budget: money(budget) })}</p>
        <ul className="selected-results-list" aria-label={t('Answers for your selected assets')}>
          {results.map((result) => <li key={result.simbolo}>
            <button type="button" className={'selected-result ' + tones[result.decision]}
              aria-pressed={result.simbolo === selectedSymbol} aria-controls="selected-asset-heading"
              aria-haspopup="dialog" title={t('View charts for {asset}', { asset: result.nombre })}
              onClick={() => onSelect(result)}>
              <AssetLogo symbol={result.simbolo} size="small" />
              <span className="selected-result-name"><strong>{result.nombre}</strong><small>{result.simbolo}</small></span>
              <span className="selected-result-share"><small>{t('Budget share')}</small><strong>{money(result.numeros.monto)}</strong></span>
              <span className={'decision-badge ' + tones[result.decision]}>{t(DECISION_LABELS[result.decision])}</span>
            </button>
          </li>)}
        </ul>
        <p className="field-hint">{t('Select an asset to view its charts. Your separate answer stays below.')}</p>
      </> : <p className="selected-results-intro">{t('Choose your investments and select Get my answer to compare them.')}</p>}
  </section>
}
