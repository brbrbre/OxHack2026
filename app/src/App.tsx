import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDown, ArrowUpRight, BookOpen, ChevronRight, FlaskConical, Info, Leaf, Sunrise } from 'lucide-react'
import { api } from './api/client'
import { errorMessage, isAbortError } from './api/errors'
import type { AssetsResponse, DecideResponse, PricesResponse } from './api/types'
import { DEFAULT_NOTICE, USE_MOCKS } from './config'
import InvestmentForm from './components/InvestmentForm'
import type { PlanDraft } from './components/InvestmentForm'
import DecisionCard from './components/DecisionCard'
import ErrorMessage from './components/ErrorMessage'

const PriceChart = lazy(() => import('./components/PriceChart'))

const initialPlan: PlanDraft = { simbolo: 'SPY', monto: '1000', plazo_dias: 30, perfil: 'moderado' }

export default function App() {
  const [assets, setAssets] = useState<AssetsResponse | null>(null)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [assetsAttempt, setAssetsAttempt] = useState(0)
  const [draft, setDraft] = useState<PlanDraft>(initialPlan)
  const [prices, setPrices] = useState<PricesResponse | null>(null)
  const [pricesPending, setPricesPending] = useState(true)
  const [pricesError, setPricesError] = useState<string | null>(null)
  const [pricesAttempt, setPricesAttempt] = useState(0)
  const [result, setResult] = useState<DecideResponse | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [decideError, setDecideError] = useState<string | null>(null)
  const decisionController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setAssetsError(null)
    api.getAssets(controller.signal).then((response) => {
      if (controller.signal.aborted) return
      setAssets(response)
      const available = Object.values(response).flat()
      setDraft((current) => available.some((asset) => asset.simbolo === current.simbolo)
        ? current : { ...current, simbolo: available[0].simbolo })
    }).catch((error: unknown) => {
      if (!isAbortError(error)) {
        setAssetsError(errorMessage(error))
        setPricesPending(false)
      }
    })
    return () => controller.abort()
  }, [assetsAttempt])

  useEffect(() => {
    if (!assets) return
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
  }, [assets, draft.simbolo, pricesAttempt])

  useEffect(() => () => decisionController.current?.abort(), [])

  const changePlan = useCallback((next: PlanDraft) => {
    decisionController.current?.abort()
    setDraft(next)
    setResult(null)
    setDecideError(null)
    setDeciding(false)
  }, [])

  async function analyze() {
    if (!assets) return
    const amount = Number(draft.monto)
    if (!Number.isFinite(amount) || amount <= 0) {
      setDecideError('Enter an investment amount greater than zero.')
      return
    }
    decisionController.current?.abort()
    const controller = new AbortController()
    decisionController.current = controller
    setDeciding(true)
    setResult(null)
    setDecideError(null)
    if (window.matchMedia('(max-width: 760px)').matches) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
      document.getElementById('outlook-heading')?.closest('section')?.scrollIntoView({ behavior, block: 'start' })
    }
    try {
      const response = await api.decide({
        simbolo: draft.simbolo,
        monto: amount,
        plazo_dias: draft.plazo_dias,
        perfil: draft.perfil,
      }, controller.signal)
      if (!controller.signal.aborted) setResult(response)
    } catch (error) {
      if (!isAbortError(error)) setDecideError(errorMessage(error))
    } finally {
      if (!controller.signal.aborted) setDeciding(false)
    }
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
        <a href="#top" className="brand" aria-label="Horizon home">
          <span className="brand-mark"><Sunrise size={24} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>horizon<span className="brand-period">.</span></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#planner" className="nav-active">Investment planner</a>
          <a href="#how-it-works">How it works <ArrowUpRight size={13} aria-hidden="true" /></a>
        </nav>
        <span className="event-tag"><span /> Built for OxHack ’26</span>
      </header>

      <main className="page-content" id="top">
        <section className="page-intro" aria-labelledby="page-title">
          <div><div className="intro-eyebrow"><span /> MORE PERSPECTIVE. BETTER QUESTIONS.</div>
            <h1 id="page-title">Your next move,<br className="mobile-break" /> in perspective.</h1>
            <p>Explore the possibilities. Understand the risks. Find a little clarity.</p>
          </div>
          <div className="intro-note"><span className="intro-note-icon"><Leaf size={19} strokeWidth={1.6} aria-hidden="true" /></span>
            <p>Investing starts with<br /><strong>understanding.</strong></p></div>
        </section>

        {USE_MOCKS && <div className="demo-banner" role="note">
          <div><FlaskConical size={16} aria-hidden="true" /><strong>You are exploring a demo</strong>
            <span>Sample prices and decisions. No live analysis.</span></div>
          <span className="demo-badge"><span /> DEMO DATA</span>
        </div>}

        {assetsError && <div className="assets-error"><ErrorMessage message={assetsError}
          onRetry={() => setAssetsAttempt((attempt) => attempt + 1)} /></div>}

        <div className="workspace" id="planner">
          <InvestmentForm assets={assets} draft={draft} onChange={changePlan}
            onSubmit={submit} pending={deciding} isDemo={USE_MOCKS} unavailable={Boolean(assetsError)} />
          <div className="results-column">
            <DecisionCard result={result} pending={deciding} error={decideError}
              onRetry={() => void analyze()} isDemo={USE_MOCKS} />
            <Suspense fallback={<section className="panel chart-state" role="status">Loading the price chart…</section>}>
            <PriceChart prices={prices} symbol={draft.simbolo} name={selectedAsset?.nombre ?? 'Price history'}
              pending={pricesPending} error={pricesError ?? (assetsError ? 'Choose an asset once the asset list is available.' : null)}
              onRetry={() => assetsError ? setAssetsAttempt((attempt) => attempt + 1) : setPricesAttempt((attempt) => attempt + 1)}
              isDemo={USE_MOCKS} />
            </Suspense>
          </div>
        </div>

        <details className="how-it-works" id="how-it-works">
          <summary><BookOpen size={17} aria-hidden="true" /><span>A little context, before you decide</span>
            <span className="how-summary-right">How it works <ChevronRight size={16} aria-hidden="true" /></span></summary>
          <div className="how-content">
            <div><span>01</span><h3>Make it your plan</h3><p>Choose an asset, an amount, a time horizon and your comfort with risk.</p></div>
            <div><span>02</span><h3>Look at both sides</h3><p>Explore the expected return alongside the chance of loss and the estimated range.</p></div>
            <div><span>03</span><h3>Understand the reasoning</h3><p>Read the reasons and any upcoming events. Model estimates are uncertain and can be wrong.</p></div>
          </div>
        </details>

        <div className="page-signoff"><span>Built with curiosity. Designed for clarity.</span>
          <a href="#planner">Back to your plan <ArrowDown size={12} aria-hidden="true" /></a></div>
      </main>

      <footer className="notice-bar">
        <Info size={15} aria-hidden="true" />
        <p>{result?.aviso ?? DEFAULT_NOTICE}</p>
        <span className="notice-prototype">EDUCATIONAL PROTOTYPE</span>
      </footer>
    </div>
  )
}
