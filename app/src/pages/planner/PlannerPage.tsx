import './planner.css'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { ArrowDown, ArrowUpRight, BookOpen, ChevronRight, FlaskConical, Info, Sunrise } from 'lucide-react'
import { api } from '../../api/client'
import { assetTypesError, errorMessage, isAbortError } from '../../api/errors'
import type { AssetsResponse, DecideResponse, PlanResponse, PricesResponse, SummaryResponse } from '../../api/types'
import { DEFAULT_NOTICE, USE_MOCKS } from '../../config'
import InvestmentForm from '../../components/InvestmentForm'
import type { PlanDraft, PlannerMode } from '../../components/InvestmentForm'
import PlannerEntry from '../../components/PlannerEntry'
import type { Experience } from '../../components/PlannerEntry'
import GuidedPlanner from '../../components/GuidedPlanner'
import type { GuidedStep } from '../../components/GuidedPlanner'
import DecisionCard from '../../components/DecisionCard'
import PlanResult from '../../components/PlanResult'
import ErrorMessage from '../../components/ErrorMessage'
import SummaryBlock from '../../components/SummaryBlock'
import AskPanel from '../../components/AskPanel'
import RemindPanel from '../../components/RemindPanel'
import { CurrencyProvider, useCurrency } from '../../currency/CurrencyContext'
import { hasPlanLink, planFromSearch } from '../../lib/planLink'

const PriceChart = lazy(() => import('../../components/PriceChart'))

const initialPlan: PlanDraft = {
  simbolo: 'SPY', monto: '1000', plazo_dias: 30, perfil: 'moderado', tipos: ['ETFs', 'US stocks', 'Crypto'],
}

type PlannerPageProps = { active?: boolean; onHome?: () => void }

export default function PlannerPage(props: PlannerPageProps = {}) {
  return <CurrencyProvider><PlannerContent {...props} /></CurrencyProvider>
}

function PlannerContent({ active = true, onHome }: PlannerPageProps) {
  const { money, currency } = useCurrency()
  const [assets, setAssets] = useState<AssetsResponse | null>(null)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [assetsAttempt, setAssetsAttempt] = useState(0)
  const [draft, setDraft] = useState<PlanDraft>(() => planFromSearch(
    typeof window === 'undefined' ? '' : window.location.search, initialPlan))
  const [mode, setMode] = useState<PlannerMode>('asset')
  const [prices, setPrices] = useState<PricesResponse | null>(null)
  const [pricesPending, setPricesPending] = useState(true)
  const [pricesError, setPricesError] = useState<string | null>(null)
  const [pricesAttempt, setPricesAttempt] = useState(0)
  const [result, setResult] = useState<DecideResponse | null>(null)
  const [portfolio, setPortfolio] = useState<PlanResponse | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [decideError, setDecideError] = useState<string | null>(null)
  const [typesError, setTypesError] = useState<string | null>(null)
  const [hasOpenedResults, setHasOpenedResults] = useState(false)
  const [experience, setExperience] = useState<Experience | null>(() =>
    typeof window !== 'undefined' && hasPlanLink(window.location.search) ? 'quick' : null)
  const [guidedOpen, setGuidedOpen] = useState(false)
  const [guidedStep, setGuidedStep] = useState<GuidedStep>(0)
  const hasChosenExperience = useRef(experience !== null)
  const decisionController = useRef<AbortController | null>(null)
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [summaryPending, setSummaryPending] = useState(false)
  const summaryController = useRef<AbortController | null>(null)
  const showWorkspace = hasOpenedResults && !guidedOpen && experience !== null

  useEffect(() => {
    const controller = new AbortController()
    setAssetsError(null)
    api.getAssets(controller.signal).then((response) => {
      if (controller.signal.aborted) return
      setAssets(response)
      const available = Object.values(response).flat()
      setDraft((current) => ({
        ...current,
        simbolo: available.some((asset) => asset.simbolo === current.simbolo) ? current.simbolo : available[0].simbolo,
        tipos: current.tipos.filter((group) => Object.hasOwn(response, group)),
      }))
    }).catch((error: unknown) => {
      if (!isAbortError(error)) {
        setAssetsError(errorMessage(error))
        setPricesPending(false)
      }
    })
    return () => controller.abort()
  }, [assetsAttempt])

  useEffect(() => {
    if (!assets || mode !== 'asset' || !showWorkspace) return
    const controller = new AbortController()
    setPrices(null)
    setPricesPending(true)
    setPricesError(null)
    api.getPrices(draft.simbolo, 365, controller.signal).then((response) => {
      if (!controller.signal.aborted) setPrices(response)
    }).catch((error: unknown) => {
      if (!isAbortError(error)) setPricesError(errorMessage(error))
    }).finally(() => {
      if (!controller.signal.aborted) setPricesPending(false)
    })
    return () => controller.abort()
  }, [assets, draft.simbolo, pricesAttempt, mode, showWorkspace])

  useEffect(() => () => {
    decisionController.current?.abort()
    summaryController.current?.abort()
  }, [])

  useEffect(() => {
    if (!active || !showWorkspace || (!deciding && !result && !portfolio && !decideError)) return
    const heading = document.getElementById('outlook-heading')
    heading?.focus({ preventScroll: true })
    const section = heading?.closest('section')
    const top = section?.getBoundingClientRect().top ?? 0
    if (window.matchMedia('(max-width: 760px)').matches || top < 0 || top > window.innerHeight / 2) {
      section?.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  }, [deciding, result, portfolio, decideError, showWorkspace, active])

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
    onHome()
  }

  async function analyze() {
    if (!assets) return
    const amount = Number(draft.monto)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) {
      setDecideError('Enter an investment amount greater than zero and no more than ' + money(1e9) + ' ' + currency + '.')
      return
    }
    if (mode === 'plan' && draft.tipos.length === 0) {
      setTypesError('Choose at least one asset type.')
      return
    }
    decisionController.current?.abort()
    const controller = new AbortController()
    decisionController.current = controller
    summaryController.current?.abort()
    setSummary(null)
    setSummaryPending(false)
    setDeciding(true)
    setResult(null)
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

  const selectedAsset = assets && Object.values(assets).flat().find((asset) => asset.simbolo === draft.simbolo)

  return (
    <div className="app-shell">
      <a className="skip-link" href="#planner">Skip to investment planner</a>
      <header className="site-header">
        <a href={onHome ? '/' : '#top'} onClick={openHome} className="brand" aria-label="Horizon home">
          <span className="brand-mark"><Sunrise size={24} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>horizon<span className="brand-period">.</span></span>
        </a>
        <nav aria-label="Main navigation">
          {onHome && <a href="/" onClick={openHome}>Home</a>}
          <a href="#planner" className="nav-active">Investment planner</a>
          <a href="#how-it-works">How it works <ArrowUpRight size={13} aria-hidden="true" /></a>
        </nav>
        <span className="event-tag"><span /> Built for OxHack ’26</span>
      </header>

      <main className={'page-content' + (!showWorkspace ? ' page-content-setup' : '')} id="top">
        {showWorkspace && <section className="page-intro" aria-labelledby="page-title">
          <div>
            <h1 id="page-title">Invest now, wait, or not yet?</h1>
            <p>Pick an asset and how long you'll hold it. We size the investment to the loss you can accept.</p>
          </div>
        </section>}

        {USE_MOCKS && <div className="demo-banner" role="note">
          <div><FlaskConical size={16} aria-hidden="true" /><strong>Demo mode</strong>
            <span>Sample prices and decisions. No live analysis.</span></div>
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
                  {!showWorkspace && <button type="button" onClick={() => chooseExperience(null)}>Change how I fill this in</button>}
                  <button type="button" onClick={() => chooseExperience('guided')}>{showWorkspace ? 'Edit step by step' : 'Use guided setup'}</button>
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
              <Info size={15} aria-hidden="true" /><p>{DEFAULT_NOTICE}</p>
            </footer>
          </>}
          {showWorkspace && <div className="results-column">
            <div className="results-toolbar"><a href="#planner">Edit your plan <ArrowDown size={14} aria-hidden="true" /></a></div>
            {mode === 'plan'
              ? <PlanResult result={portfolio} pending={deciding} error={decideError} onRetry={() => void analyze()} active={active} />
              : <DecisionCard result={result} pending={deciding} error={decideError}
                onRetry={() => void analyze()} isDemo={USE_MOCKS} />}
            {active && <SummaryBlock summary={summary} pending={summaryPending} />}
            <AskPanel result={mode === 'asset' ? result : null} plan={mode === 'plan' ? portfolio : null} />
            {mode === 'asset' && <RemindPanel result={result} />}
            <footer className="notice-bar">
              <Info size={15} aria-hidden="true" />
              <p>{(mode === 'plan' ? portfolio?.aviso : result?.aviso) ?? DEFAULT_NOTICE}</p>
            </footer>
            {active && mode === 'asset' && <Suspense fallback={<section className="chart-panel chart-state" role="status">Loading the price chart…</section>}>
            <PriceChart prices={prices} symbol={draft.simbolo} name={selectedAsset?.nombre ?? 'Price history'}
              pending={pricesPending} error={pricesError ?? (assetsError ? 'Choose an asset once the asset list is available.' : null)}
              onRetry={() => assetsError ? setAssetsAttempt((attempt) => attempt + 1) : setPricesAttempt((attempt) => attempt + 1)}
              isDemo={USE_MOCKS} result={result} />
            </Suspense>}
          </div>}
        </div>

        <details className="how-it-works" id="how-it-works">
          <summary><BookOpen size={17} aria-hidden="true" /><span>How it works</span>
            <span className="how-summary-right"><ChevronRight size={16} aria-hidden="true" /></span></summary>
          <div className="how-content">
            <div><span>01</span><h3>Set your plan</h3><p>Choose an asset or let us compare asset types. Enter your budget, holding period and risk profile.</p></div>
            <div><span>02</span><h3>Read the answer</h3><p>See how much to invest now and how much to keep in cash, alongside the estimated risk.</p></div>
            <div><span>03</span><h3>Check the evidence</h3><p>Read the reasons and upcoming events. For a single asset, compare the forecast with its price history. Estimates can be wrong.</p></div>
          </div>
        </details>

        <div className="page-signoff">
          <a href="#planner">Back to your plan <ArrowDown size={12} aria-hidden="true" /></a></div>
      </main>

    </div>
  )
}
