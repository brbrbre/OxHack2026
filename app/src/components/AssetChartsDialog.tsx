import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { api } from '../api/client'
import { errorMessage, isAbortError } from '../api/errors'
import type { DecideResponse, PricesResponse } from '../api/types'
import { DEFAULT_NOTICE, USE_MOCKS } from '../config'
import { useCurrency } from '../currency/CurrencyContext'
import { useI18n } from '../i18n/I18nContext'
import { modelLabel } from '../lib/labels'
import { matchingInspectionAnalysis } from '../lib/assetChartAnalysis'
import type { AssetInspection } from '../lib/assetInspection'
import { buildInvestmentProjection } from '../lib/valueForecast'
import AssetLogo from './AssetLogo'
import ErrorMessage from './ErrorMessage'
import { RESPONSIBILITY_NOTICE } from './InformationNotice'
import '../asset-charts-dialog.css'

const ValueGrowthChart = lazy(() => import('./ValueGrowthChart'))
const PriceChart = lazy(() => import('./PriceChart'))

interface Props {
  selection: AssetInspection
  onClose: () => void
}
type Tab = 'investment' | 'history'

function ChartLoading({ estimating = false }: { estimating?: boolean }) {
  const { t } = useI18n()
  return <div className="asset-charts-state" role="status">
    <LoaderCircle size={22} aria-hidden="true" /><p>{t(estimating ? 'Estimating this amount…' : 'Loading the chart…')}</p>
  </div>
}

export default function AssetChartsDialog({ selection, onClose }: Props) {
  const { money, currency } = useCurrency()
  const { t, percentage } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const investmentTab = useRef<HTMLButtonElement>(null)
  const historyTab = useRef<HTMLButtonElement>(null)
  const historyCache = useRef(new Map<string, PricesResponse>())
  const id = 'asset-details-' + useId()
  const suppliedAnalysis = matchingInspectionAnalysis(selection, selection.analysis)
  const [tab, setTab] = useState<Tab>('investment')
  const [analysis, setAnalysis] = useState<DecideResponse | null>(suppliedAnalysis)
  const [analysisPending, setAnalysisPending] = useState(!suppliedAnalysis)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisAttempt, setAnalysisAttempt] = useState(0)
  const [prices, setPrices] = useState<PricesResponse | null>(null)
  const [pricesPending, setPricesPending] = useState(false)
  const [pricesError, setPricesError] = useState<string | null>(null)
  const [pricesAttempt, setPricesAttempt] = useState(0)
  const { symbol, amount, days, profile, basis, weight } = selection

  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    if (!element.open) element.showModal()
    document.body.style.overflow = 'hidden'
    close.current?.focus({ preventScroll: true })
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected && !previousFocus.closest('[hidden], [inert]') && previousFocus.getClientRects().length > 0) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setAnalysisError(null)
    if (suppliedAnalysis && analysisAttempt === 0) {
      setAnalysis(suppliedAnalysis)
      setAnalysisPending(false)
      return () => controller.abort()
    }
    setAnalysis(null)
    setAnalysisPending(true)
    api.decide({ simbolo: symbol, monto: amount, plazo_dias: days, perfil: profile }, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setAnalysis(response) })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) setAnalysisError(errorMessage(error))
      })
      .finally(() => { if (!controller.signal.aborted) setAnalysisPending(false) })
    return () => controller.abort()
  }, [symbol, amount, days, profile, suppliedAnalysis, analysisAttempt])

  useEffect(() => {
    if (tab !== 'history') return
    const cached = historyCache.current.get(symbol)
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
    api.getPrices(symbol, 365, controller.signal).then((response) => {
      if (controller.signal.aborted) return
      historyCache.current.set(symbol, response)
      setPrices(response)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && !isAbortError(error)) setPricesError(errorMessage(error))
    }).finally(() => { if (!controller.signal.aborted) setPricesPending(false) })
    return () => controller.abort()
  }, [tab, symbol, pricesAttempt])

  function retryPrices() {
    historyCache.current.delete(symbol)
    setPricesAttempt((attempt) => attempt + 1)
  }

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
    const nextTab = next === 'investment' ? investmentTab : historyTab
    nextTab.current?.focus()
  }

  const currentAnalysis = matchingInspectionAnalysis(selection, analysis)
  const projection = useMemo(() => currentAnalysis ? buildInvestmentProjection(currentAnalysis) : null, [currentAnalysis])
  const projectionError = analysisError ?? (!analysisPending && !projection
    ? t('The estimate did not match this investment. Please try again.') : null)
  const currentPrices = prices?.simbolo === symbol ? prices : null
  const amountLabel = basis === 'allocation' ? 'Allocated amount' : basis === 'comparison' ? 'Budget share' : 'Illustrative amount'
  const basisNote = basis === 'allocation' ? 'This estimate uses the allocated amount. It does not change your plan.'
    : basis === 'comparison' ? 'This is your comparison budget share, not a portfolio allocation.'
      : 'This asset is not allocated in your plan. This illustration uses your full budget; it does not change the plan.'

  return <dialog ref={dialog} className="asset-charts-dialog" aria-labelledby={id + '-title'}
    aria-describedby={id + '-description'} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={closeOnBackdrop}>
    <header className="asset-charts-header">
      <div>
        <h2 id={id + '-title'} className="asset-name-row"><AssetLogo symbol={symbol} /><span>{selection.name}</span></h2>
        <p className="asset-charts-symbol">{symbol}</p>
      </div>
      <button ref={close} type="button" className="asset-charts-close" aria-label={t('Close asset details')} onClick={onClose}>
        <X size={21} aria-hidden="true" />
      </button>
    </header>
    <div className="asset-charts-body">
      <p id={id + '-description'} className={'asset-charts-basis' + (basis === 'hypothetical' ? ' hypothetical' : '')}>{t(basisNote)}</p>
      <dl className="asset-charts-summary">
        <div><dt>{t(amountLabel)}</dt><dd>{money(amount)} <small>{currency}</small></dd></div>
        {basis === 'allocation' && weight !== undefined && <div><dt>{t('Of your plan')}</dt><dd>{percentage(weight)}</dd></div>}
        <div><dt>{t('Time horizon')}</dt><dd>{days === 1 ? t('1 day') : t('{days} days', { days })}</dd></div>
      </dl>
      <div className="asset-charts-tabs" role="tablist" aria-label={t('Asset chart')}>
        <button ref={investmentTab} type="button" role="tab" id={id + '-investment-tab'}
          aria-selected={tab === 'investment'} aria-controls={id + '-investment'} tabIndex={tab === 'investment' ? 0 : -1}
          onKeyDown={navigateTabs} onClick={() => setTab('investment')}>{t('Your investment')}</button>
        <button ref={historyTab} type="button" role="tab" id={id + '-history-tab'}
          aria-selected={tab === 'history'} aria-controls={id + '-history'} tabIndex={tab === 'history' ? 0 : -1}
          onKeyDown={navigateTabs} onClick={() => setTab('history')}>{t('Price history')}</button>
      </div>
      <div role="tabpanel" id={id + '-investment'} aria-labelledby={id + '-investment-tab'} hidden={tab !== 'investment'} tabIndex={0}>
        {tab === 'investment' && <>
          {analysisPending ? <ChartLoading estimating /> : projectionError
            ? <div className="asset-charts-error"><ErrorMessage message={projectionError} onRetry={() => setAnalysisAttempt((attempt) => attempt + 1)} /></div>
            : projection && <Suspense fallback={<ChartLoading />}>
              <ValueGrowthChart projection={projection} title={t('How this amount could change')}
                basis={t(amountLabel) + ': ' + money(amount)} idPrefix={id + '-growth'} compact headingLevel={3} />
            </Suspense>}
          {currentAnalysis && !projectionError && <p className="asset-charts-model model-badge">{currentAnalysis.modelo === 'baseline'
            ? t('Prediction: baseline (3-year historical average)') : t('Prediction: {model}', { model: modelLabel(currentAnalysis.modelo) })}</p>}
        </>}
      </div>
      <div role="tabpanel" id={id + '-history'} aria-labelledby={id + '-history-tab'} hidden={tab !== 'history'} tabIndex={0}>
        {tab === 'history' && <Suspense fallback={<ChartLoading />}>
          <PriceChart prices={currentPrices} symbol={symbol} name={selection.name} headingId={id + '-history-heading'}
            pending={pricesPending || (!currentPrices && !pricesError)} error={pricesError} onRetry={retryPrices}
            isDemo={USE_MOCKS} result={currentAnalysis} />
        </Suspense>}
      </div>
    </div>
    <footer className="asset-charts-footer"><p>{t(RESPONSIBILITY_NOTICE)}</p><p>{t(DEFAULT_NOTICE)}</p></footer>
  </dialog>
}
