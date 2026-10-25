import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, ChevronRight, FlaskConical, Info } from 'lucide-react'
import { api } from './api/client'
import { assetTypesError, errorMessage, isAbortError } from './api/errors'
import type { AssetsResponse, DecideResponse, PlanResponse, PricesResponse, SummaryResponse } from './api/types'
import { DEFAULT_NOTICE, USE_MOCKS } from './config'
import { modeFromSearch, planFromSearch, reminderFromSearch } from './lib/planLink'
import InvestmentForm from './components/InvestmentForm'
import type { PlanDraft, PlannerMode } from './components/InvestmentForm'
import PlannerEntry from './components/PlannerEntry'
import type { Experience } from './components/PlannerEntry'
import GuidedPlanner from './components/GuidedPlanner'
import type { GuidedStep } from './components/GuidedPlanner'
import DecisionCard from './components/DecisionCard'
import PlanResult from './components/PlanResult'
import ErrorMessage from './components/ErrorMessage'
import SummaryBlock from './components/SummaryBlock'
import AskPanel from './components/AskPanel'
import RemindPanel from './components/RemindPanel'
import SelectedAssetResults from './components/SelectedAssetResults'
import { analyzeSelectedAssets, selectedSymbols, splitSelectedBudget } from './lib/selectedAssets'
import { useCurrency } from './currency/CurrencyContext'
import { useI18n } from './i18n/I18nContext'
import AppearanceControls from './components/AppearanceControls'
import AssetChartsDialog from './components/AssetChartsDialog'
import type { AssetInspection } from './lib/assetInspection'

const PriceChart = lazy(() => import('./components/PriceChart'))

const defaultPlan: PlanDraft = {
  simbolo: 'SPY', monto: '1000', plazo_dias: 30, perfil: 'moderado', tipos: ['ETFs', 'US stocks', 'Crypto'],
}

function currentSearch() {
  return typeof window === 'undefined' ? '' : window.location.search
}

interface AppProps { active?: boolean; onHome?: () => void }

export default function App({ active = true, onHome }: AppProps = {}) {
  const { t, locale } = useI18n()
  const { money, currency } = useCurrency()
  const [assets, setAssets] = useState<AssetsResponse | null>(null)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [assetsAttempt, setAssetsAttempt] = useState(0)
  const [draft, setDraft] = useState<PlanDraft>(() => planFromSearch(currentSearch(), defaultPlan))
  const [mode, setMode] = useState<PlannerMode>(() => modeFromSearch(currentSearch()))
  const [prices, setPrices] = useState<PricesResponse | null>(null)
  const [pricesPending, setPricesPending] = useState(true)
  const [pricesError, setPricesError] = useState<string | null>(null)
  const [pricesAttempt, setPricesAttempt] = useState(0)
  const [result, setResult] = useState<DecideResponse | null>(null)
  const [selectionResults, setSelectionResults] = useState<DecideResponse[]>([])
  const [inspecting, setInspecting] = useState(false)
  const [assetInspection, setAssetInspection] = useState<AssetInspection | null>(null)
  const wasShowingAssetDialog = useRef(false)
  const [portfolio, setPortfolio] = useState<PlanResponse | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [decideError, setDecideError] = useState<string | null>(null)
  const [typesError, setTypesError] = useState<string | null>(null)
  const [hasOpenedResults, setHasOpenedResults] = useState(false)
  const [experience, setExperience] = useState<Experience | null>(() => {
    const q = new URLSearchParams(currentSearch())
    return q.has('simbolo') || q.get('modo') === 'plan' ? 'quick' : null
  })
  const [guidedOpen, setGuidedOpen] = useState(false)
  const [guidedStep, setGuidedStep] = useState<GuidedStep>(0)
  const hasChosenExperience = useRef(experience !== null)
  const decisionController = useRef<AbortController | null>(null)
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [summaryPending, setSummaryPending] = useState(false)
  const summaryController = useRef<AbortController | null>(null)
  const showWorkspace = hasOpenedResults && !guidedOpen && experience !== null
  const symbols = selectedSymbols(draft)
  const multiple = mode === 'asset' && symbols.length > 1
  const priceSymbol = multiple && result ? result.simbolo : draft.simbolo

  useEffect(() => {
    const reminder = reminderFromSearch(currentSearch())
    if (reminder) api.habitOpen(reminder).catch(() => { /* the plan still opens; the call may still come */ })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setAssetsError(null)
    api.getAssets(controller.signal).then((response) => {
      if (controller.signal.aborted) return
      setAssets(response)
      const available = Object.values(response).flat()
      setDraft((current) => {
        const selected = current.simbolos?.filter((symbol) => available.some((asset) => asset.simbolo === symbol))
        return {
          ...current,
          simbolo: selected ? selected[0] ?? '' : available.some((asset) => asset.simbolo === current.simbolo) ? current.simbolo : available[0].simbolo,
          ...(selected ? { simbolos: selected } : {}),
          tipos: current.tipos.filter((group) => Object.hasOwn(response, group)),
        }
      })
    }).catch((error: unknown) => {
      if (!isAbortError(error)) {
        setAssetsError(errorMessage(error))
        setPricesPending(false)
      }
    })
    return () => controller.abort()
  }, [assetsAttempt])

  useEffect(() => {
    if (!active || !assets || mode !== 'asset' || !showWorkspace || !priceSymbol) return
    const controller = new AbortController()
    setPrices(null)
    setPricesPending(true)
    setPricesError(null)
    api.getPrices(priceSymbol, 365, controller.signal).then((response) => {
      if (!controller.signal.aborted) setPrices(response)
    }).catch((error: unknown) => {
      if (!isAbortError(error)) setPricesError(errorMessage(error))
    }).finally(() => {
      if (!controller.signal.aborted) setPricesPending(false)
    })
    return () => controller.abort()
  }, [assets, priceSymbol, pricesAttempt, mode, showWorkspace, active])

  useEffect(() => () => {
    decisionController.current?.abort()
    summaryController.current?.abort()
  }, [])

  useEffect(() => {
    if (assetInspection) { wasShowingAssetDialog.current = true; return }
    // The dialog restores focus to its opener; do not move it to an answer on close.
    if (wasShowingAssetDialog.current) { wasShowingAssetDialog.current = false; return }
    if (!active || !showWorkspace || (!deciding && !result && !portfolio && !decideError)) return
    const heading = document.getElementById(multiple && inspecting ? 'selected-asset-heading' : 'outlook-heading')
    heading?.focus({ preventScroll: true })
    const target = multiple && inspecting ? heading?.closest('section') : heading?.closest('.results-column') ?? heading?.closest('section')
    const top = target?.getBoundingClientRect().top ?? 0
    // The answer must be on screen: always on phones, and on laptops when the
    // person scrolled down to the button and the answer sits above the fold.
    if (window.matchMedia('(max-width: 760px)').matches || top < 0 || top > window.innerHeight / 2) {
      target?.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  }, [deciding, result, portfolio, decideError, showWorkspace, active, multiple, inspecting, assetInspection])

  useEffect(() => {
    if (!active) setAssetInspection(null)
  }, [active])

  useEffect(() => {
    if (active && !showWorkspace && decideError) document.getElementById('setup-error')?.focus()
  }, [showWorkspace, decideError, active])

  useEffect(() => {
    if (active && typesError && mode === 'plan') document.getElementById('asset-types')?.focus()
  }, [typesError, mode, active])

  const clearAnalysis = useCallback(() => {
    decisionController.current?.abort()
    summaryController.current?.abort()
    setSummary(null)
    setSummaryPending(false)
    setResult(null)
    setSelectionResults([])
    setInspecting(false)
    setAssetInspection(null)
    setPortfolio(null)
    setDecideError(null)
    setTypesError(null)
    setDeciding(false)
  }, [])

  const changePlan = useCallback((next: PlanDraft) => {
    clearAnalysis()
    setDraft(next)
  }, [clearAnalysis])

  const changeMode = useCallback((next: PlannerMode) => {
    if (next === mode) return
    clearAnalysis()
    setMode(next)
  }, [mode, clearAnalysis])

  function chooseExperience(next: Experience | null) {
    clearAnalysis()
    if (next && !hasChosenExperience.current) {
      if (next === 'guided') setMode('plan')
      hasChosenExperience.current = true
    }
    setExperience(next)
    setGuidedOpen(next === 'guided')
    if (next === 'guided') setGuidedStep(0)
  }

  function changeGuidedStep(next: GuidedStep) {
    clearAnalysis()
    setGuidedStep(next)
  }

  useEffect(() => {
    if (!active || showWorkspace) return
    const target = experience === null ? 'entry-heading' : guidedOpen ? null : 'planner'
    if (target) document.getElementById(target)?.focus({ preventScroll: true })
  }, [experience, guidedOpen, showWorkspace, active])

  function openHome(event: MouseEvent<HTMLAnchorElement>) {
    if (!onHome || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    setAssetInspection(null)
    onHome()
  }

  async function analyze() {
    if (!assets) return
    const amount = Number(draft.monto)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) {
      setDecideError(t('Enter an investment amount greater than zero and no more than {amount} {currency}.', { amount: money(1e9), currency }))
      return
    }
    if (mode === 'plan' && draft.tipos.length === 0) {
      setTypesError(t('Choose at least one asset type.'))
      return
    }
    if (mode === 'asset') {
      try { splitSelectedBudget(amount, symbols) }
      catch (error) { setDecideError(t((error as Error).message)); return }
    }
    decisionController.current?.abort()
    const controller = new AbortController()
    decisionController.current = controller
    summaryController.current?.abort()
    setSummary(null)
    setSummaryPending(false)
    setDeciding(true)
    setInspecting(false)
    setAssetInspection(null)
    setResult(null)
    setSelectionResults([])
    setPortfolio(null)
    setDecideError(null)
    setTypesError(null)
    try {
      const request = { monto: amount, plazo_dias: draft.plazo_dias, perfil: draft.perfil }
      if (mode === 'plan') {
        const body = { ...request, tipos: draft.tipos }
        const response = await api.plan(body, controller.signal)
        if (!controller.signal.aborted) {
          setPortfolio(response)
          setHasOpenedResults(true)
          setGuidedOpen(false)
          loadSummary('plan', body)
        }
      } else if (multiple) {
        const responses = await analyzeSelectedAssets(symbols, request, controller.signal)
        if (!controller.signal.aborted) {
          setSelectionResults(responses)
          setResult(responses[0])
          setHasOpenedResults(true)
          setGuidedOpen(false)
          const first = responses[0]
          loadSummary('decide', { ...request, monto: first.numeros.monto, simbolo: first.simbolo })
        }
      } else {
        const body = { ...request, simbolo: draft.simbolo }
        const response = await api.decide(body, controller.signal)
        if (!controller.signal.aborted) {
          setResult(response)
          setHasOpenedResults(true)
          setGuidedOpen(false)
          loadSummary('decide', body)
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && !isAbortError(error)) {
        const fieldError = mode === 'plan' ? assetTypesError(error) : null
        if (fieldError) setTypesError(fieldError)
        else setDecideError(errorMessage(error))
      }
    } finally {
      if (!controller.signal.aborted) setDeciding(false)
    }
  }

  // The summary arrives after the answer; if it fails, the answer stays and the block disappears.
  function loadSummary(kind: 'decide' | 'plan', body: Parameters<typeof api.summary>[1]) {
    const controller = new AbortController()
    summaryController.current = controller
    setSummaryPending(true)
    api.summary(kind, body, controller.signal).then((response) => {
      if (!controller.signal.aborted) setSummary(response)
    }).catch(() => {
      if (!controller.signal.aborted) setSummary(null)
    }).finally(() => {
      if (!controller.signal.aborted) setSummaryPending(false)
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void analyze()
  }

  function inspectSelection(next: DecideResponse) {
    setAssetInspection({ symbol: next.simbolo, name: next.nombre, amount: next.numeros.monto,
      days: next.numeros.plazo_dias, profile: next.numeros.perfil, basis: 'comparison', analysis: next })
    if (next.simbolo === result?.simbolo) return
    setInspecting(true)
    summaryController.current?.abort()
    setSummary(null)
    setResult(next)
    loadSummary('decide', { simbolo: next.simbolo, monto: next.numeros.monto,
      plazo_dias: next.numeros.plazo_dias, perfil: next.numeros.perfil })
  }

  const selectedAsset = assets && Object.values(assets).flat().find((asset) => asset.simbolo === priceSymbol)

  return (
    <div className="app-shell">
      <a className="skip-link" href="#planner">{t('Skip to investment planner')}</a>
      <header className="site-header">
        <a href={onHome ? '/' : '#top'} onClick={openHome} className="brand" aria-label={t('Horizon home')}>
          <span>horizon<span className="brand-period">.</span></span>
        </a>
        <nav aria-label={t('Main navigation')}>
          {onHome && <a href="/" onClick={openHome}>{t('Home')}</a>}
          <a href="#planner" className="nav-active">{t('Investment planner')}</a>
          <a href="#how-it-works">{t('How it works')} <ArrowUpRight size={13} aria-hidden="true" /></a>
        </nav>
        <AppearanceControls />
        <span className="event-tag"><span /> {t('Built for OxHack ’26')}</span>
      </header>

      <main className={'page-content' + (!showWorkspace ? ' page-content-setup' : '')} id="top">
        {showWorkspace && <section className="page-intro" aria-labelledby="page-title">
          <div>
            <h1 id="page-title">{t('Invest now, wait, or not yet?')}</h1>
            <p>{t("Choose investments and how long you'll hold them. Explore an answer for each one or let Horizon compare investment types.")}</p>
          </div>
        </section>}

        {USE_MOCKS && <div className="demo-banner" role="note">
          <div><FlaskConical size={16} aria-hidden="true" /><strong>{t('Demo mode')}</strong>
            <span>{t('Sample prices and decisions. No live analysis.')}</span></div>
        </div>}

        {assetsError && experience && <div className="assets-error"><ErrorMessage message={assetsError}
          onRetry={() => setAssetsAttempt((attempt) => attempt + 1)} /></div>}

        <div className={'workspace ' + (showWorkspace ? 'workspace-results' : 'workspace-setup')} id="planner" tabIndex={-1}>
          {experience === null ? <PlannerEntry onChoose={chooseExperience} />
            : guidedOpen ? <GuidedPlanner active={active} assets={assets} draft={draft} onChange={changePlan}
              mode={mode} onModeChange={changeMode} onSubmit={submit} pending={deciding}
              unavailable={Boolean(assetsError)} typesError={typesError} step={guidedStep} onStepChange={changeGuidedStep}
              onChooseDifferent={() => chooseExperience(null)} onUseQuick={() => chooseExperience('quick')} />
              : <div className="planner-form-column">
                <div className="planner-route-bar">
                  {!showWorkspace && <button type="button" onClick={() => chooseExperience(null)}>{t('Change how I fill this in')}</button>}
                  <button type="button" onClick={() => chooseExperience('guided')}>{t(showWorkspace ? 'Edit step by step' : 'Use guided setup')}</button>
                </div>
                <InvestmentForm assets={assets} draft={draft} onChange={changePlan}
                  onSubmit={submit} pending={deciding} isDemo={USE_MOCKS} unavailable={Boolean(assetsError)}
                  mode={mode} onModeChange={changeMode} typesError={typesError}
                  stage={showWorkspace ? 'workspace' : 'setup'} />
              </div>}
          {!showWorkspace && <>
            {decideError && <div className="setup-error" id="setup-error" tabIndex={-1}>
              <ErrorMessage message={decideError} onRetry={() => void analyze()} />
            </div>}
            <footer className="notice-bar setup-notice">
              <Info size={15} aria-hidden="true" /><p>{t(DEFAULT_NOTICE)}</p>
            </footer>
          </>}
          {showWorkspace && <div className="results-column">
            <div className="results-toolbar"><a href="#planner">{t('Edit your plan')} <ArrowDown size={14} aria-hidden="true" /></a></div>
            {locale !== 'en' && <p className="model-language-note" role="note">{t('Model explanations, summaries and spoken amounts are currently supplied in English.')}</p>}
            {mode === 'plan'
              ? <PlanResult result={portfolio} pending={deciding} error={decideError} onRetry={() => void analyze()}
                onInspect={setAssetInspection} />
              : multiple ? <>
                <SelectedAssetResults results={selectionResults} budget={Number(draft.monto)} selectedSymbol={result?.simbolo}
                  pending={deciding} error={decideError} onRetry={() => void analyze()} onSelect={inspectSelection} />
                {result && <DecisionCard result={result} pending={false} error={null} headingId="selected-asset-heading"
                  onRetry={() => void analyze()} isDemo={USE_MOCKS} />}
              </> : <DecisionCard result={result} pending={deciding} error={decideError}
                onRetry={() => void analyze()} isDemo={USE_MOCKS} />}
            {active && mode === 'asset' && (!multiple || result) && <Suspense fallback={<section className="chart-panel chart-state" role="status">{t('Loading the price chart…')}</section>}>
            <PriceChart prices={prices} symbol={priceSymbol} name={selectedAsset?.nombre ?? t('Price history')}
              pending={pricesPending} error={pricesError ?? (assetsError ? t('Choose an asset once the asset list is available.') : null)}
              onRetry={() => assetsError ? setAssetsAttempt((attempt) => attempt + 1) : setPricesAttempt((attempt) => attempt + 1)}
              isDemo={USE_MOCKS} result={result} />
            </Suspense>}
            {active && <SummaryBlock summary={summary} pending={summaryPending} />}
            <AskPanel result={mode === 'asset' ? result : null} plan={mode === 'plan' ? portfolio : null} />
            <RemindPanel result={mode === 'asset' ? result : null} plan={mode === 'plan' ? portfolio : null} tipos={draft.tipos} />
            <footer className="notice-bar">
              <Info size={15} aria-hidden="true" />
              <p>{t((mode === 'plan' ? portfolio?.aviso : result?.aviso) ?? DEFAULT_NOTICE)}</p>
            </footer>
          </div>}
        </div>

        <details className="how-it-works" id="how-it-works">
          <summary><BookOpen size={17} aria-hidden="true" /><span>{t('How it works')}</span>
            <span className="how-summary-right"><ChevronRight size={16} aria-hidden="true" /></span></summary>
          <div className="how-content">
            <div><span>01</span><h3>{t('Set your plan')}</h3><p>{t('Choose an asset or let us compare asset types. Enter your budget, holding period and risk profile.')}</p><ArrowRight className="how-step-arrow" size={48} strokeWidth={1} aria-hidden="true" /></div>
            <div><span>02</span><h3>{t('Read the answer')}</h3><p>{t('See how much to invest now and how much to keep in cash, alongside the estimated risk.')}</p><ArrowRight className="how-step-arrow" size={48} strokeWidth={1} aria-hidden="true" /></div>
            <div><span>03</span><h3>{t('Check the evidence')}</h3><p>{t('Read the reasons and upcoming events. For a single asset, compare the forecast with its price history. Estimates can be wrong.')}</p></div>
          </div>
        </details>

        <div className="page-signoff">
          <a href="#planner">{t('Back to your plan')} <ArrowDown size={12} aria-hidden="true" /></a></div>
      </main>
      {active && showWorkspace && assetInspection && <AssetChartsDialog
        key={[assetInspection.symbol, assetInspection.amount, assetInspection.days, assetInspection.profile, assetInspection.basis].join(':')}
        selection={assetInspection} onClose={() => setAssetInspection(null)} />}

    </div>
  )
}
