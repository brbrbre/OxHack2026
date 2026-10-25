import { ChartNoAxesCombined, Check, ChevronDown, Clock3, LoaderCircle, X } from 'lucide-react'
import type { PlanResponse } from '../api/types'
import { useCurrency } from '../currency/CurrencyContext'
import type { CurrencyCode } from '../currency/currency'
import { useI18n } from '../i18n/I18nContext'
import { DECISION_LABELS } from '../lib/labels'
import { assetIdentity } from '../lib/assetIdentity'
import type { AssetInspection } from '../lib/assetInspection'
import { inspectPlanAsset } from '../lib/assetInspection'
import AssetLogo from './AssetLogo'
import ErrorMessage from './ErrorMessage'

interface Props {
  result: PlanResponse | null
  pending: boolean
  error: string | null
  onRetry: () => void
  onInspect?: (selection: AssetInspection) => void
}

function riskCopy(result: PlanResponse, money: (value: number, signed?: boolean) => string, currency: CurrencyCode,
  { locale, t, percentage }: ReturnType<typeof useI18n>): string {
  const { monto, peor_caso, tolerancia } = result.numeros
  const change = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale, {
    style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero',
  }).format(peor_caso / monto)
  const estimate = peor_caso > 0
    ? t("The model's lower estimate is {amount} ({change}).", { amount: money(peor_caso, true), change })
    : t('In a bad scenario this plan could lose about {amount} ({change}).', { amount: money(currency === 'USD'
      ? Math.round(Math.abs(peor_caso)) : Math.abs(peor_caso)), change })
  return estimate + ' ' + t('Your profile accepts up to {limit}.', { limit: percentage(tolerancia) })
}

export default function PlanResult({ result, pending, error, onRetry, onInspect }: Props) {
  const { money, currency } = useCurrency()
  const i18n = useI18n()
  const { t, percentage } = i18n
  const cash = result ? Math.abs(result.efectivo) < 1e-8 ? 0 : result.efectivo : 0
  const cashWeight = result ? Math.max(0, cash / result.numeros.monto) : 0
  const assetCount = result?.cartera.length ?? 0
  const allocations = result?.cartera.map((asset) => ({
    ...asset, tone: assetIdentity(asset.simbolo).className,
  })) ?? []
  const allocationDescription = result ? allocations.map((asset) =>
    asset.nombre + ' (' + asset.simbolo + '): ' + percentage(asset.peso) + ', ' + money(asset.monto),
  ).concat(t('Cash') + ': ' + percentage(cashWeight) + ', ' + money(cash)).join('; ') : ''
  const groups = result ? [
    { code: 'INVERTIR' as const, className: 'invest', id: 'plan-invest-heading', assets: result.invertir, Icon: Check },
    { code: 'ESPERAR' as const, className: 'wait', id: 'plan-wait-heading', assets: result.esperar, Icon: Clock3 },
    { code: 'NO_POR_AHORA' as const, className: 'not-now', id: 'plan-not-now-heading', assets: result.no_por_ahora, Icon: X },
  ] : []

  function inspect(asset: { simbolo: string; nombre: string }) {
    if (!result || !onInspect) return
    onInspect(inspectPlanAsset(result, asset))
  }

  function assetName(asset: { simbolo: string; nombre: string }, variant: 'legend' | 'table' | 'candidate') {
    const copy = variant === 'table' ? <>
      <span className="portfolio-asset-name">{asset.nombre}</span>
      <span className="portfolio-asset-symbol">{asset.simbolo}</span>
    </> : <><strong>{asset.nombre}</strong>{variant === 'legend'
      ? <small>{asset.simbolo}</small> : <span className="candidate-symbol">{asset.simbolo}</span>}</>
    return onInspect ? <button type="button" className="asset-inspection-link" aria-haspopup="dialog"
      aria-label={t('View charts for {asset}', { asset: asset.nombre })} onClick={() => inspect(asset)}>
      <span>{copy}</span><ChartNoAxesCombined size={16} aria-hidden="true" />
    </button> : copy
  }

  return (
    <section className="panel outlook-panel plan-result" aria-labelledby="outlook-heading" aria-busy={pending}>
      {pending ? (
        <div className="outlook-placeholder loading-outlook" role="status">
          <LoaderCircle size={24} aria-hidden="true" />
          <h2 id="outlook-heading" tabIndex={-1}>{t('Checking…')}</h2>
          <p>{t('Comparing the asset types you selected.')}</p>
        </div>
      ) : error ? (
        <div className="outlook-placeholder error-outlook">
          <h2 id="outlook-heading" tabIndex={-1}>{t('We could not build your plan.')}</h2>
          <ErrorMessage message={error} onRetry={onRetry} />
        </div>
      ) : result ? (
        <>
          <div className="panel-heading">
            <span className="model-badge">{result.modelo === 'baseline'
              ? t('Prediction: baseline (3-year historical average)') : t('Prediction: {model}', { model: result.modelo })}</span>
          </div>
          <div className="decision-heading">
            <h2 className="suggested-amount" id="outlook-heading" tabIndex={-1}>
              {result.numeros.invertido > 0
                ? t(assetCount === 1 ? 'Invest {amount} across {count} asset' : 'Invest {amount} across {count} assets', { amount: money(result.numeros.invertido), count: assetCount })
                : t('Keep your {amount} for now', { amount: money(result.numeros.monto) })}
            </h2>
          </div>
          <p className="allocation-breakdown">
            <span>{t('of your {amount}', { amount: money(result.numeros.monto) })}</span>
            <span>{t('keep {amount} in cash', { amount: money(cash) })}</span>
          </p>

          <section className="portfolio-allocation" aria-labelledby="allocation-heading">
            <h3 id="allocation-heading">{t('Your allocation')}</h3>
            {onInspect && <p className="field-hint asset-inspection-hint">{t('Select an asset name to explore its growth and price history.')}</p>}
            <div className="allocation-bar" role="img" aria-label={allocationDescription}>
              {allocations.map((asset) => (
                <span key={asset.simbolo} className={'allocation-segment ' + asset.tone}
                  style={{ width: asset.peso * 100 + '%' }} aria-hidden="true"
                  title={asset.nombre + ': ' + percentage(asset.peso) + ', ' + money(asset.monto)} />
              ))}
              {cash > 0 && <span className="allocation-segment allocation-cash" aria-hidden="true"
                style={{ width: cashWeight * 100 + '%' }}
                title={t('Cash') + ': ' + percentage(cashWeight) + ', ' + money(cash)} />}
            </div>
            <ul className="allocation-legend">
              {allocations.map((asset) => (
                <li key={asset.simbolo}>
                  <span className={'allocation-key ' + asset.tone} aria-hidden="true" />
                  <AssetLogo symbol={asset.simbolo} size="small" />
                  <span className="allocation-label">{assetName(asset, 'legend')}</span>
                  <span className="allocation-figures"><span>{percentage(asset.peso)}</span><strong>{money(asset.monto)}</strong></span>
                </li>
              ))}
              <li>
                <span className="allocation-key allocation-cash" aria-hidden="true" />
                <span className="allocation-label"><strong>{t('Cash')}</strong></span>
                <span className="allocation-figures"><span>{percentage(cashWeight)}</span><strong>{money(cash)}</strong></span>
              </li>
            </ul>
            <details className="allocation-details">
              <summary>{t('View allocation table')}</summary>
              <div className="portfolio-table-wrap">
              <table className="portfolio-table">
                <caption>{t('Suggested allocation')}</caption>
                <thead><tr><th scope="col">{t('Asset')}</th><th scope="col">{t('Amount')}</th><th scope="col">{t('Weight')}</th></tr></thead>
                <tbody>
                  {allocations.map((asset) => <tr key={asset.simbolo}>
                    <td><span className="asset-name-row"><AssetLogo symbol={asset.simbolo} size="small" />
                      <span className="asset-name-copy">{assetName(asset, 'table')}</span>
                    </span></td>
                    <td>{money(asset.monto)}</td><td>{percentage(asset.peso)}</td>
                  </tr>)}
                  <tr><td><span className="portfolio-asset-name">{t('Cash')}</span></td><td>{money(cash)}</td><td>{percentage(cashWeight)}</td></tr>
                </tbody>
              </table>
              </div>
            </details>
          </section>

          <section className="plan-risk" aria-labelledby="plan-risk-heading">
            <h3 id="plan-risk-heading">{t('Risk of this plan')}</h3>
            <p>{riskCopy(result, money, currency, i18n)}</p>
          </section>

          <div className="plan-classifications">
            {currency !== 'USD' && <p className="field-hint currency-explanation-note">{t('Written explanations and the plan summary use USD; your allocation uses {currency}.', { currency })}</p>}
            {groups.map((group) => <details className={'plan-classification ' + group.className} key={group.code}
              open={group.code === 'INVERTIR'} aria-labelledby={group.id}>
              <summary className="classification-summary">
              <h3 id={group.id}><span className={'decision-badge ' + group.className}>
                <group.Icon size={15} strokeWidth={2} aria-hidden="true" />{t(DECISION_LABELS[group.code])}</span>
                <span className="classification-count">{t(group.assets.length === 1 ? '{count} asset' : '{count} assets', { count: group.assets.length })}
                  {group.code === 'INVERTIR' && group.assets.length !== assetCount ? t(', {count} in the plan', { count: assetCount }) : ''}</span>
              </h3>
                <ChevronDown size={16} className="classification-chevron" aria-hidden="true" />
              </summary>
              {group.assets.length ? <ul className="plan-candidates">
                {group.assets.map((asset) => <li key={asset.simbolo}>
                  <div className="candidate-heading asset-name-row"><AssetLogo symbol={asset.simbolo} size="small" />
                    <span className="asset-name-copy">{assetName(asset, 'candidate')}</span>
                  </div>
                  <p>{asset.razon}</p>
                  {asset.fuera_del_plan && <p className="candidate-note">{t('Not in the plan:')} {asset.fuera_del_plan}</p>}
                </li>)}
              </ul> : <p className="empty-classification">{t('No assets in this group.')}</p>}
            </details>)}
          </div>

          <section className="plan-summary-copy" aria-labelledby="plan-summary-heading">
            <h3 id="plan-summary-heading">{t('Plan summary')}</h3>
            <p>{result.resumen}</p>
          </section>
        </>
      ) : (
        <div className="outlook-placeholder">
          <h2 id="outlook-heading" tabIndex={-1}>{t('Ready to compare another plan?')}</h2>
          <p>{t('Adjust your choices, then select Build my plan to compare your asset types again.')}</p>
        </div>
      )}
    </section>
  )
}
