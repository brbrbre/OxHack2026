import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { api } from '../api/client'
import { errorMessage, isAbortError } from '../api/errors'
import type { DecideResponse, PlanAllocation, PlanResponse, PricesResponse } from '../api/types'
import { USE_MOCKS } from '../config'
import { percentage } from '../lib/format'
import { useCurrency } from '../currency/CurrencyContext'
import { buildHoldingProjection } from '../lib/valueForecast'
import AssetLogo from './AssetLogo'
import ErrorMessage from './ErrorMessage'
import '../portfolio-asset-dialog.css'

const ValueGrowthChart = lazy(() => import('./ValueGrowthChart'))
const PriceChart = lazy(() => import('./PriceChart'))

interface Props {
  holding: PlanAllocation
  plan: PlanResponse
  onClose: () => void
}

type Tab = 'investment' | 'history'

function ChartLoading({ children = 'Loading the chart…' }: { children?: string }) {
  return <div className="holding-chart-state" role="status">
    <LoaderCircle size={22} aria-hidden="true" /><p>{children}</p>
  </div>
}

export default function PortfolioAssetDialog({ holding, plan, onClose }: Props) {
  const { money, currency } = useCurrency()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const investmentTabRef = useRef<HTMLButtonElement>(null)
  const historyTabRef = useRef<HTMLButtonElement>(null)
  const historyCache = useRef(new Map<string, PricesResponse>())
  const id = 'holding-' + useId()
  const [tab, setTab] = useState<Tab>('investment')
  const [analysis, setAnalysis] = useState<DecideResponse | null>(null)
  const [analysisPending, setAnalysisPending] = useState(true)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisAttempt, setAnalysisAttempt] = useState(0)
  const [prices, setPrices] = useState<PricesResponse | null>(null)
  const [pricesPending, setPricesPending] = useState(false)
  const [pricesError, setPricesError] = useState<string | null>(null)
  const [pricesAttempt, setPricesAttempt] = useState(0)
  const { plazo_dias: days, perfil: profile } = plan.numeros

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected && !previousFocus.closest('[hidden], [inert]') && previousFocus.getClientRects().length > 0) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setAnalysis(null)
    setAnalysisError(null)
    setAnalysisPending(true)
    api.decide({ simbolo: holding.simbolo, monto: holding.monto, plazo_dias: days, perfil: profile }, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setAnalysis(response) })
      .catch((error: unknown) => { if (!controller.signal.aborted && !isAbortError(error)) setAnalysisError(errorMessage(error)) })
      .finally(() => { if (!controller.signal.aborted) setAnalysisPending(false) })
    return () => controller.abort()
  }, [holding.simbolo, holding.monto, days, profile, analysisAttempt])

  useEffect(() => {
    if (tab !== 'history') return
    const key = holding.simbolo + ':' + pricesAttempt
    const cached = historyCache.current.get(key)
    if (cached) {
      setPrices(cached)
      setPricesError(null)
      setPricesPending(false)
      return
    }
    const controller = new AbortController()
    setPrices(null)
    setPricesError(null)
    setPricesPending(true)
    api.getPrices(holding.simbolo, 365, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        historyCache.current.set(key, response)
        setPrices(response)
      })
      .catch((error: unknown) => { if (!controller.signal.aborted && !isAbortError(error)) setPricesError(errorMessage(error)) })
      .finally(() => { if (!controller.signal.aborted) setPricesPending(false) })
    return () => controller.abort()
  }, [tab, holding.simbolo, pricesAttempt])

  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'investment' : event.key === 'End' ? 'history' : tab === 'investment' ? 'history' : 'investment'
    setTab(next)
    const nextTab = next === 'investment' ? investmentTabRef : historyTabRef
    nextTab.current?.focus()
  }

  const projection = analysis ? buildHoldingProjection(holding, plan, analysis) : null
  const projectionError = analysisError ?? (analysis && !projection ? 'The estimate did not match this allocation. Please try again.' : null)

  return <dialog ref={dialogRef} className="portfolio-asset-dialog" aria-labelledby={id + '-title'}
    aria-describedby={id + '-description'} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={closeOnBackdrop}>
    <header className="holding-dialog-header">
      <div>
        <p className="holding-eyebrow">Your allocation</p>
        <h2 id={id + '-title'} className="asset-name-row"><AssetLogo symbol={holding.simbolo} /><span>{holding.nombre}</span></h2>
        <p id={id + '-description'} className="holding-symbol">{holding.simbolo} · {holding.grupo}</p>
      </div>
      <button ref={closeRef} className="holding-close" type="button" aria-label="Close asset details" onClick={onClose}>
        <X size={21} aria-hidden="true" />
      </button>
    </header>

    <div className="holding-dialog-body">
      <dl className="holding-allocation-summary">
        <div><dt>Allocated amount</dt><dd>{money(holding.monto)} <small>{currency}</small></dd></div>
        <div><dt>Of your plan</dt><dd>{percentage(holding.peso)}</dd></div>
        <div><dt>Time horizon</dt><dd>{days} days</dd></div>
      </dl>
      <div className="holding-tabs" role="tablist" aria-label="Asset chart">
        <button ref={investmentTabRef} type="button" role="tab" id={id + '-investment-tab'}
          aria-selected={tab === 'investment'} aria-controls={id + '-investment'} tabIndex={tab === 'investment' ? 0 : -1}
          onKeyDown={navigateTabs} onClick={() => setTab('investment')}>Your investment</button>
        <button ref={historyTabRef} type="button" role="tab" id={id + '-history-tab'}
          aria-selected={tab === 'history'} aria-controls={id + '-history'} tabIndex={tab === 'history' ? 0 : -1}
          onKeyDown={navigateTabs} onClick={() => setTab('history')}>Price history</button>
      </div>

      <div role="tabpanel" id={id + '-investment'} aria-labelledby={id + '-investment-tab'} hidden={tab !== 'investment'} tabIndex={0}>
        {tab === 'investment' && <>
          {analysisPending ? <ChartLoading>Estimating this allocation…</ChartLoading> : projectionError
            ? <div className="holding-error"><ErrorMessage message={projectionError} onRetry={() => setAnalysisAttempt((attempt) => attempt + 1)} /></div>
            : projection && <Suspense fallback={<ChartLoading />}>
              <ValueGrowthChart projection={projection} title="How this allocation could change"
                basis={'Your ' + money(holding.monto) + ' allocation'} idPrefix={id + '-growth'} compact headingLevel={3} />
            </Suspense>}
          {analysis && !projectionError && <div className="holding-estimate-context">
            <span className="model-badge">{analysis.modelo === 'baseline'
              ? 'Prediction: baseline (3-year historical average)' : 'Prediction: ' + analysis.modelo}</span>
            <p>Estimated separately for this holding. The total chart uses the portfolio estimate.</p>
          </div>}
        </>}
      </div>
      <div role="tabpanel" className="holding-history" id={id + '-history'} aria-labelledby={id + '-history-tab'} hidden={tab !== 'history'} tabIndex={0}>
        {tab === 'history' && <Suspense fallback={<ChartLoading />}>
          <PriceChart prices={prices} symbol={holding.simbolo} name={holding.nombre} pending={pricesPending || (!prices && !pricesError)}
            error={pricesError} onRetry={() => setPricesAttempt((attempt) => attempt + 1)} isDemo={USE_MOCKS} result={null} />
        </Suspense>}
      </div>
    </div>
    <footer className="holding-dialog-footer"><p>{analysis?.aviso ?? plan.aviso}</p></footer>
  </dialog>
}
