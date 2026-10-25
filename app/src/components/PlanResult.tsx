import { Check, Clock3, LoaderCircle, X } from 'lucide-react'
import type { PlanResponse } from '../api/types'
import { money, percentage } from '../lib/format'
import { DECISION_LABELS } from '../lib/labels'
import { assetIdentity } from '../lib/assetIdentity'
import AssetLogo from './AssetLogo'
import ErrorMessage from './ErrorMessage'

interface Props {
  result: PlanResponse | null
  pending: boolean
  error: string | null
  onRetry: () => void
}

function riskCopy(result: PlanResponse): string {
  const { monto, peor_caso, tolerancia } = result.numeros
  const change = new Intl.NumberFormat('en-GB', {
    style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero',
  }).format(peor_caso / monto)
  const estimate = peor_caso > 0
    ? "The model's lower estimate is " + money(peor_caso, true) + ' (' + change + ').'
    : 'In a bad scenario this plan could lose about ' + money(Math.round(Math.abs(peor_caso))) + ' (' + change + ').'
  return estimate + ' Your profile accepts up to ' + percentage(tolerancia) + '.'
}

export default function PlanResult({ result, pending, error, onRetry }: Props) {
  const cash = result ? Math.abs(result.efectivo) < 1e-8 ? 0 : result.efectivo : 0
  const cashWeight = result ? Math.max(0, cash / result.numeros.monto) : 0
  const assetCount = result?.cartera.length ?? 0
  const allocations = result?.cartera.map((asset) => ({
    ...asset, tone: assetIdentity(asset.simbolo).className,
  })) ?? []
  const allocationDescription = result ? allocations.map((asset) =>
    asset.nombre + ' (' + asset.simbolo + '): ' + percentage(asset.peso) + ', ' + money(asset.monto),
  ).concat('Cash: ' + percentage(cashWeight) + ', ' + money(cash)).join('; ') : ''
  const groups = result ? [
    { code: 'INVERTIR' as const, className: 'invest', id: 'plan-invest-heading', assets: result.invertir, Icon: Check },
    { code: 'ESPERAR' as const, className: 'wait', id: 'plan-wait-heading', assets: result.esperar, Icon: Clock3 },
    { code: 'NO_POR_AHORA' as const, className: 'not-now', id: 'plan-not-now-heading', assets: result.no_por_ahora, Icon: X },
  ] : []

  return (
    <section className="panel outlook-panel plan-result" aria-labelledby="outlook-heading" aria-busy={pending}>
      {pending ? (
        <div className="outlook-placeholder loading-outlook" role="status">
          <LoaderCircle size={24} aria-hidden="true" />
          <h2 id="outlook-heading" tabIndex={-1}>Checking…</h2>
          <p>Comparing the asset types you selected.</p>
        </div>
      ) : error ? (
        <div className="outlook-placeholder error-outlook">
          <h2 id="outlook-heading" tabIndex={-1}>We could not build your plan.</h2>
          <ErrorMessage message={error} onRetry={onRetry} />
        </div>
      ) : result ? (
        <>
          <div className="panel-heading">
            <span className="model-badge">{result.modelo === 'baseline'
              ? 'Prediction: baseline (3-year historical average)' : 'Prediction: ' + result.modelo}</span>
          </div>
          <div className="decision-heading">
            <h2 className="suggested-amount" id="outlook-heading" tabIndex={-1}>
              {result.numeros.invertido > 0
                ? 'Invest ' + money(result.numeros.invertido) + ' across ' + assetCount + (assetCount === 1 ? ' asset' : ' assets')
                : 'Keep your ' + money(result.numeros.monto) + ' for now'}
            </h2>
          </div>
          <p className="allocation-breakdown">
            <span>of your {money(result.numeros.monto)}</span>
            <span>keep {money(cash)} in cash</span>
          </p>

          <section className="portfolio-allocation" aria-labelledby="allocation-heading">
            <h3 id="allocation-heading">Your allocation</h3>
            <div className="allocation-bar" role="img" aria-label={allocationDescription}>
              {allocations.map((asset) => (
                <span key={asset.simbolo} className={'allocation-segment ' + asset.tone}
                  style={{ width: asset.peso * 100 + '%' }} aria-hidden="true"
                  title={asset.nombre + ': ' + percentage(asset.peso) + ', ' + money(asset.monto)} />
              ))}
              {cash > 0 && <span className="allocation-segment allocation-cash" aria-hidden="true"
                style={{ width: cashWeight * 100 + '%' }}
                title={'Cash: ' + percentage(cashWeight) + ', ' + money(cash)} />}
            </div>
            <ul className="allocation-legend">
              {allocations.map((asset) => (
                <li key={asset.simbolo}>
                  <span className={'allocation-key ' + asset.tone} aria-hidden="true" />
                  <AssetLogo symbol={asset.simbolo} size="small" />
                  <span className="allocation-label"><strong>{asset.nombre}</strong><small>{asset.simbolo}</small></span>
                  <span className="allocation-figures"><span>{percentage(asset.peso)}</span><strong>{money(asset.monto)}</strong></span>
                </li>
              ))}
              <li>
                <span className="allocation-key allocation-cash" aria-hidden="true" />
                <span className="allocation-label"><strong>Cash</strong></span>
                <span className="allocation-figures"><span>{percentage(cashWeight)}</span><strong>{money(cash)}</strong></span>
              </li>
            </ul>
            <div className="portfolio-table-wrap">
              <table className="portfolio-table">
                <caption>Suggested allocation</caption>
                <thead><tr><th scope="col">Asset</th><th scope="col">Amount</th><th scope="col">Weight</th></tr></thead>
                <tbody>
                  {allocations.map((asset) => <tr key={asset.simbolo}>
                    <td><span className="asset-name-row"><AssetLogo symbol={asset.simbolo} size="small" />
                      <span className="asset-name-copy"><span className="portfolio-asset-name">{asset.nombre}</span>
                        <span className="portfolio-asset-symbol">{asset.simbolo}</span></span>
                    </span></td>
                    <td>{money(asset.monto)}</td><td>{percentage(asset.peso)}</td>
                  </tr>)}
                  <tr><td><span className="portfolio-asset-name">Cash</span></td><td>{money(cash)}</td><td>{percentage(cashWeight)}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="plan-risk" aria-labelledby="plan-risk-heading">
            <h3 id="plan-risk-heading">Risk of this plan</h3>
            <p>{riskCopy(result)}</p>
          </section>

          <div className="plan-classifications">
            {groups.map((group) => <section className={'plan-classification ' + group.className} key={group.code} aria-labelledby={group.id}>
              <h3 id={group.id}><span className={'decision-badge ' + group.className}>
                <group.Icon size={15} strokeWidth={2} aria-hidden="true" />{DECISION_LABELS[group.code]}</span>
                <span className="classification-count">{group.assets.length} {group.assets.length === 1 ? 'asset' : 'assets'}
                  {group.code === 'INVERTIR' && group.assets.length !== assetCount ? ', ' + assetCount + ' in the plan' : ''}</span>
              </h3>
              {group.assets.length ? <ul className="plan-candidates">
                {group.assets.map((asset) => <li key={asset.simbolo}>
                  <div className="candidate-heading asset-name-row"><AssetLogo symbol={asset.simbolo} size="small" />
                    <span className="asset-name-copy"><strong>{asset.nombre}</strong><span className="candidate-symbol">{asset.simbolo}</span></span>
                  </div>
                  <p>{asset.razon}</p>
                  {asset.fuera_del_plan && <p className="candidate-note">Not in the plan: {asset.fuera_del_plan}</p>}
                </li>)}
              </ul> : <p className="empty-classification">No assets in this group.</p>}
            </section>)}
          </div>

          <section className="plan-summary-copy" aria-labelledby="plan-summary-heading">
            <h3 id="plan-summary-heading">Plan summary</h3>
            <p>{result.resumen}</p>
          </section>
        </>
      ) : (
        <div className="outlook-placeholder">
          <h2 id="outlook-heading" tabIndex={-1}>Ready to compare another plan?</h2>
          <p>Adjust your choices, then select Build my plan to compare your asset types again.</p>
        </div>
      )}
    </section>
  )
}
