import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronDown, Clock3, HelpCircle, Menu, MonitorSmartphone, ShieldCheck, SlidersHorizontal, Sunrise, X } from 'lucide-react'
import { DEFAULT_NOTICE } from '../../config'
import AssetLogo from '../../components/AssetLogo'
import LandingDemo from './LandingDemo'
import './landing.css'

interface Props { onStart: () => void }

function StartLink({ onStart, children, className = '' }: Props & { children: ReactNode; className?: string }) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onStart()
  }
  return <a href="?view=planner" className={className} onClick={open}>{children}</a>
}

const examples = [
  { symbol: 'SPY', name: 'S&P 500' }, { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'NVDA', name: 'NVIDIA' }, { symbol: 'GLD', name: 'Gold' },
  { symbol: 'HSBA.L', name: 'HSBC' }, { symbol: 'BTCUSDT', name: 'Bitcoin' },
] as const

const outcomes = [
  { label: 'Invest', tone: 'invest', Icon: Check, title: 'An amount to consider.', copy: 'See a suggested investment amount, what stays in cash, and the reasons behind the answer.' },
  { label: 'Wait', tone: 'wait', Icon: Clock3, title: 'A reason to pause.', copy: 'Understand when risk or an upcoming event could make waiting worth considering.' },
  { label: 'Not now', tone: 'not-now', Icon: X, title: 'Clarity is an answer, too.', copy: 'Find out why an investment may not fit your time horizon or comfort with risk.' },
] as const

const questions = [
  { question: 'What can I explore with Horizon?', answer: 'Explore an individual investment or compare asset types to build a suggested plan. The catalogue includes ETFs, US stocks, Mexican stocks, UK stocks, indices, currencies and crypto. You can adjust your budget, time horizon and risk profile and run the analysis again.' },
  { question: 'Do I need to know about investing?', answer: 'You can choose a guide that explains budget, time and risk one question at a time. If you already know what you want to explore, the quick form puts all the options together. You can switch between them while keeping your answers.' },
  { question: 'Can I use Horizon on my phone?', answer: 'Yes. Horizon is a responsive web app: open the website in your phone’s browser and use the same planner. It also works on a computer. There is no separate native app or App Store download at this stage.' },
  { question: 'Are the results guaranteed?', answer: 'No. Horizon shows model estimates, including possible losses. A forecast is an estimate, not a guarantee or a limit on what could happen. The result explains its reasoning and identifies the prediction model used.' },
  { question: 'Do I need an account or payment?', answer: 'No account or payment is required to explore this prototype. Horizon does not place trades or move your money. It is an educational tool, not financial advice.' },
] as const

export default function LandingPage({ onStart }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const header = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButton.current?.focus()
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('keydown', escape)
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('keydown', escape)
      document.removeEventListener('pointerdown', outside)
    }
  }, [menuOpen])

  function start() {
    setMenuOpen(false)
    onStart()
  }

  return <div className="landing-page" id="home-top">
    <a className="skip-link" href="#home-main">Skip to Horizon introduction</a>
    <header className="landing-header" ref={header}>
      <div className="landing-header-inner">
        <a className="landing-brand" href="#home-top" aria-label="Horizon home" onClick={() => setMenuOpen(false)}>
          <span className="landing-brand-mark"><Sunrise size={24} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>horizon<span>.</span></span>
        </a>
        <button className="landing-menu-button" type="button" ref={menuButton} aria-expanded={menuOpen}
          aria-controls="home-navigation" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}<span>{menuOpen ? 'Close menu' : 'Menu'}</span>
        </button>
        <nav className={'landing-nav' + (menuOpen ? ' is-open' : '')} id="home-navigation" aria-label="Horizon navigation">
          <a href="#home-features" onClick={() => setMenuOpen(false)}>Why Horizon</a>
          <a href="#home-how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#home-mobile" onClick={() => setMenuOpen(false)}>On your phone</a>
          <a href="#home-faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          <StartLink onStart={start} className="landing-button landing-nav-cta">Explore your plan<ArrowUpRight size={16} aria-hidden="true" /></StartLink>
        </nav>
      </div>
    </header>

    <main id="home-main">
      <section className="landing-hero landing-container" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span /> A little perspective. A better starting point.</p>
          <h1 id="landing-title" tabIndex={-1}>A clearer view.<br /><span>Before you invest.</span></h1>
          <p className="landing-hero-description">Turn “what if?” into a plan you can understand. Explore investments, see the possible risks, and discover the thinking behind each answer.</p>
          <div className="landing-hero-actions">
            <StartLink onStart={start} className="landing-button">Explore your plan<ArrowRight size={18} aria-hidden="true" /></StartLink>
            <a className="landing-text-link" href="#home-how-it-works">See how it works<ArrowDown size={16} aria-hidden="true" /></a>
          </div>
          <p className="landing-hero-note"><CheckCheck size={16} aria-hidden="true" />No account or payment required.</p>
        </div>
        <div className="landing-hero-visual"><LandingDemo /></div>
      </section>

      <section className="landing-assets landing-container" aria-label="Examples from the investment catalogue">
        <div className="landing-assets-intro"><p className="landing-eyebrow">Different assets. One place to explore.</p><p>From funds and company shares to currencies and crypto.</p></div>
        <ul>{examples.map(({ symbol, name }) => <li key={symbol}><AssetLogo symbol={symbol} /><span>{name}</span></li>)}</ul>
        <p className="landing-assets-caption">Examples from Horizon’s catalogue. Brand marks identify investments.</p>
      </section>

      <section className="landing-outcomes landing-container landing-section" id="home-features" aria-labelledby="home-outcomes-title">
        <div className="landing-section-heading"><p className="landing-eyebrow">The answer is only the beginning</p><h2 id="home-outcomes-title">More than a yes or no.<br />A reason you can follow.</h2><p>Every plan starts with your budget, time and comfort with risk. Horizon helps you understand what the model suggests—and why.</p></div>
        <div className="landing-outcome-grid">{outcomes.map(({ label, tone, Icon, title, copy }) => <article className={'landing-outcome landing-outcome-' + tone} key={tone}>
          <span className="landing-outcome-label"><Icon size={16} aria-hidden="true" />{label}</span>
          <h3>{title}</h3><p>{copy}</p>
        </article>)}</div>
        <p className="landing-context-note"><ShieldCheck size={17} aria-hidden="true" /><span>Keep the uncertainty in view. Possible losses and the prediction model stay visible alongside the result.</span></p>
      </section>

      <section className="landing-process landing-section" id="home-how-it-works" aria-labelledby="home-process-title">
        <div className="landing-container">
          <div className="landing-process-heading"><p className="landing-eyebrow">From a question to perspective</p><h2 id="home-process-title">Your next step,<br />in three simple ones.</h2><p>You bring the question. Horizon brings structure, estimates and explanations.</p></div>
          <ol className="landing-process-list">
            <li><span className="landing-process-number">01</span><div><h3>Make it your plan.</h3><p>Pick an investment, or let Horizon compare asset types. Set your budget, how long you would invest and how you feel about risk.</p></div></li>
            <li><span className="landing-process-number">02</span><div><h3>See the possibilities.</h3><p>Read the suggested amount, cash to keep and estimated risk. For an individual asset, explore price history and a possible future range.</p></div></li>
            <li><span className="landing-process-number">03</span><div><h3>Understand the “why”.</h3><p>Read the reasons, recommendations and relevant events. Adjust your choices and run the plan again to explore another scenario.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="landing-ways landing-container landing-section" aria-labelledby="home-ways-title">
        <div className="landing-ways-copy"><p className="landing-eyebrow">At your own pace</p><h2 id="home-ways-title">New to this?<br />Already have a plan?<br /><span>You’re in the right place.</span></h2><p>Choose the way you want to begin. The same planner meets you on either path, and keeps your answers if you switch.</p><StartLink onStart={start} className="landing-text-link">Find your starting point<ArrowRight size={17} aria-hidden="true" /></StartLink></div>
        <div className="landing-ways-options">
          <article><BookOpen size={25} strokeWidth={1.6} aria-hidden="true" /><div><span className="landing-small-label">One question at a time</span><h3>Guide me step by step</h3><p>Plain-language questions about your budget, time and risk, followed by a chance to review your choices.</p></div></article>
          <article><SlidersHorizontal size={25} strokeWidth={1.6} aria-hidden="true" /><div><span className="landing-small-label">All fields together</span><h3>I’ll fill it in</h3><p>A complete form for when you know what you want to explore and would like to get straight to it.</p></div></article>
        </div>
      </section>

      <section className="landing-mobile-section" id="home-mobile" aria-labelledby="home-mobile-title">
        <div className="landing-container landing-mobile-layout">
          <div className="landing-mobile-copy"><p className="landing-eyebrow"><MonitorSmartphone size={17} aria-hidden="true" /> Same Horizon. Your screen.</p><h2 id="home-mobile-title">A little more clarity.<br />Wherever you are.</h2><p>Start a plan on your computer or explore it from your phone. Horizon adapts to your screen, with the same choices, explanations and price charts.</p><ul><li><Check size={18} aria-hidden="true" />Made for desktop and mobile browsers</li><li><Check size={18} aria-hidden="true" />Tap-friendly choices and readable results</li><li><Check size={18} aria-hidden="true" />Open the website. No installation needed.</li></ul><StartLink onStart={start} className="landing-button landing-button-light">Try the web app<ArrowUpRight size={18} aria-hidden="true" /></StartLink></div>
          <figure className="landing-phone-figure">
            <div className="landing-phone" aria-hidden="true">
              <div className="landing-phone-speaker" />
              <div className="landing-phone-screen">
                <div className="landing-phone-brand"><Sunrise size={18} /><strong>horizon.</strong><Menu size={17} /></div>
                <span className="landing-phone-step">YOUR STARTING POINT</span><strong className="landing-phone-title">Your plan</strong><p>Let’s make it yours.</p>
                <span className="landing-phone-label">How much would you invest?</span><div className="landing-phone-amount"><span>$</span><strong>1,000</strong><small>USD</small></div>
                <span className="landing-phone-label">Your time horizon</span><div className="landing-phone-days"><span>7d</span><strong>30d</strong><span>90d</span><span>180d</span></div>
                <span className="landing-phone-label">Your comfort with risk</span><div className="landing-phone-risk"><SlidersHorizontal size={17} /><span>Moderate</span><span className="landing-phone-radio" /></div>
                <div className="landing-phone-submit">See my plan<ArrowRight size={15} /></div><span className="landing-phone-footnote">No account or payment required.</span>
              </div>
            </div>
            <figcaption>Illustrative mobile view · Responsive web app</figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-faq landing-container landing-section" id="home-faq" aria-labelledby="home-faq-title">
        <div className="landing-faq-heading"><p className="landing-eyebrow"><HelpCircle size={16} aria-hidden="true" />A few things worth knowing</p><h2 id="home-faq-title">Good questions.<br />Clear answers.</h2><p>Understand what Horizon does before you try it.</p></div>
        <div className="landing-faq-list">{questions.map(({ question, answer }) => <details key={question}><summary><span>{question}</span><ChevronDown size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="landing-final-cta landing-container" aria-labelledby="home-final-title"><div><p className="landing-eyebrow">Start with a little perspective</p><h2 id="home-final-title">Make your next<br />“what if?” a clearer one.</h2></div><div><StartLink onStart={start} className="landing-button">Explore your plan<ArrowRight size={19} aria-hidden="true" /></StartLink><p>No account. No payment. Your own pace.</p></div></section>
    </main>

    <footer className="landing-footer landing-container"><div className="landing-footer-top"><a className="landing-brand" href="#home-top" aria-label="Horizon home"><span>horizon<span>.</span></span></a><span>Built for OxHack ’26</span><a href="https://github.com/brbrbre/OxHack2026">Explore the project<ArrowUpRight size={14} aria-hidden="true" /></a></div><p>{DEFAULT_NOTICE}</p></footer>
  </div>
}
