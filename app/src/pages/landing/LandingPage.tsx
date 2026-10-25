import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronDown, Clock3, HelpCircle, Menu, MonitorSmartphone, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { DEFAULT_NOTICE } from '../../config'
import { useI18n } from '../../i18n/I18nContext'
import AppearanceControls from '../../components/AppearanceControls'
import AssetLogo from '../../components/AssetLogo'
import LandingDemo from './LandingDemo'
import './landing.css'

interface Props { onStart: () => void }

function ProcessArrow() {
  return <svg className="landing-process-arrow" viewBox="0 0 100 100" preserveAspectRatio="none"
    fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <path className="process-chevron-desktop" d="M16 6 L84 50 L16 94"
      vectorEffect="non-scaling-stroke" />
    <path className="process-chevron-mobile" d="M6 16 L50 84 L94 16"
      vectorEffect="non-scaling-stroke" />
  </svg>
}

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
  { question: 'What can I explore with Horizon?', answer: 'Explore ETFs, US stocks, Mexican stocks, UK stocks, indices, currencies and crypto: compare one or more investments, or let Horizon compare asset types for a suggested plan. Budgets support USD, MXN, GBP and EUR using fixed, dated reference rates for the demo.' },
  { question: 'Do I need to know about investing?', answer: 'You can choose a guide that explains budget, time and risk one question at a time. If you already know what you want to explore, the quick form puts all the options together. You can switch between them while keeping your answers.' },
  { question: 'Can I use Horizon on my phone?', answer: 'Yes. Horizon is a responsive web app: open the website in your phone’s browser and use the same planner. It also works on a computer. There is no separate native app or App Store download at this stage.' },
  { question: 'Are the results guaranteed?', answer: 'No. Horizon shows model estimates, including possible losses. A forecast is an estimate, not a guarantee or a limit on what could happen. The result explains its reasoning and identifies the prediction model used.' },
  { question: 'Do I need an account or payment?', answer: 'No account or payment is required to explore this prototype. Horizon does not place trades or move your money. It is an educational tool, not financial advice.' },
] as const

export default function LandingPage({ onStart }: Props) {
  const { t, locale } = useI18n()
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
    <a className="skip-link" href="#home-main">{t('Skip to Horizon introduction')}</a>
    <header className="landing-header" ref={header}>
      <div className="landing-header-inner">
        <a className="landing-brand" href="#home-top" aria-label={t('Horizon home')} onClick={() => setMenuOpen(false)}>
          <span>horizon<span>.</span></span>
        </a>
        <button className="landing-menu-button" type="button" ref={menuButton} aria-expanded={menuOpen}
          aria-controls="home-navigation" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}<span>{t(menuOpen ? 'Close menu' : 'Menu')}</span>
        </button>
        <nav className={'landing-nav' + (menuOpen ? ' is-open' : '')} id="home-navigation" aria-label={t('Horizon navigation')}>
          <a href="#home-features" onClick={() => setMenuOpen(false)}>{t('Why Horizon')}</a>
          <a href="#home-how-it-works" onClick={() => setMenuOpen(false)}>{t('How it works')}</a>
          <a href="#home-mobile" onClick={() => setMenuOpen(false)}>{t('On your phone')}</a>
          <a href="#home-faq" onClick={() => setMenuOpen(false)}>{t('FAQ')}</a>
          <StartLink onStart={start} className="landing-button landing-nav-cta">{t('Explore your plan')}<ArrowUpRight size={16} aria-hidden="true" /></StartLink>
        </nav>
        <div className="landing-appearance"><AppearanceControls /></div>
      </div>
    </header>

    <main id="home-main">
      <section className="landing-hero landing-container" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span />{t('A little perspective. A better starting point.')}</p>
          <h1 id="landing-title" tabIndex={-1}>{t('A clearer view.')}<br /><span>{t('Before you invest.')}</span></h1>
          <p className="landing-hero-description">{t('Turn “what if?” into a plan you can understand. Explore investments, see the possible risks, and discover the thinking behind each answer.')}</p>
          <div className="landing-hero-actions">
            <StartLink onStart={start} className="landing-button">{t('Explore your plan')}<ArrowRight size={18} aria-hidden="true" /></StartLink>
            <a className="landing-text-link" href="#home-how-it-works">{t('See how it works')}<ArrowDown size={16} aria-hidden="true" /></a>
          </div>
          <p className="landing-hero-note"><CheckCheck size={16} aria-hidden="true" />{t('No account or payment required.')}</p>
        </div>
        <div className="landing-hero-visual"><LandingDemo /></div>
      </section>

      <section className="landing-assets landing-container" aria-label={t('Examples from the investment catalogue')}>
        <div className="landing-assets-intro"><p className="landing-eyebrow">{t('Different assets. One place to explore.')}</p><p>{t('From funds and company shares to currencies and crypto.')}</p></div>
        <ul>{examples.map(({ symbol, name }) => <li key={symbol}><AssetLogo symbol={symbol} /><span>{t(name)}</span></li>)}</ul>
        <p className="landing-assets-caption">{t('Examples from Horizon’s catalogue. Brand marks identify investments.')}</p>
      </section>

      <section className="landing-outcomes landing-container landing-section" id="home-features" aria-labelledby="home-outcomes-title">
        <div className="landing-section-heading"><p className="landing-eyebrow">{t('The answer is only the beginning')}</p><h2 id="home-outcomes-title">{t('More than a yes or no.')}<br />{t('A reason you can follow.')}</h2><p>{t('Every plan starts with your budget, time and comfort with risk. Horizon helps you understand what the model suggests—and why.')}</p></div>
        <div className="landing-outcome-list">{outcomes.map(({ label, tone, Icon, title, copy }, index) => <article className={'landing-outcome landing-outcome-' + tone} key={tone}>
          <span className="landing-outcome-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div className="landing-outcome-title"><span className="landing-outcome-label"><Icon size={16} aria-hidden="true" />{t(label)}</span><h3>{t(title)}</h3></div>
          <p>{t(copy)}</p>
        </article>)}</div>
        <p className="landing-context-note"><ShieldCheck size={17} aria-hidden="true" /><span>{t('Keep the uncertainty in view. Possible losses and the prediction model stay visible alongside the result.')}</span></p>
      </section>

      <section className="landing-process landing-section" id="home-how-it-works" aria-labelledby="home-process-title">
        <div className="landing-container">
          <div className="landing-process-heading"><p className="landing-eyebrow">{t('From a question to perspective')}</p><h2 id="home-process-title">{t('Your next step,')}<br />{t('in three simple ones.')}</h2><p>{t('You bring the question. Horizon brings structure, estimates and explanations.')}</p></div>
          <ol className="landing-process-list">
            <li><span className="landing-process-number">01</span><div><h3>{t('Make it your plan.')}</h3><p>{t('Choose one or more investments to compare, or let Horizon compare asset types for a suggested plan, then set your budget, time horizon and comfort with risk.')}</p></div><ProcessArrow /></li>
            <li><span className="landing-process-number">02</span><div><h3>{t('See the possibilities.')}</h3><p>{t('Read the suggested amount, cash to keep and estimated risk. For an individual asset, explore price history and a possible future range.')}</p></div><ProcessArrow /></li>
            <li><span className="landing-process-number">03</span><div><h3>{t('Understand the “why”.')}</h3><p>{t('Read the reasons, recommendations and relevant events. Adjust your choices and run the plan again to explore another scenario.')}</p></div></li>
          </ol>
        </div>
      </section>

      <section className="landing-ways landing-container landing-section" aria-labelledby="home-ways-title">
        <div className="landing-ways-copy"><p className="landing-eyebrow">{t('At your own pace')}</p><h2 id="home-ways-title">{t('New to this?')}<br />{t('Already have a plan?')}<br /><span>{t('You’re in the right place.')}</span></h2><p>{t('Choose the way you want to begin. The same planner meets you on either path, and keeps your answers if you switch.')}</p><StartLink onStart={start} className="landing-text-link">{t('Find your starting point')}<ArrowRight size={17} aria-hidden="true" /></StartLink></div>
        <div className="landing-ways-options">
          <article><BookOpen size={25} strokeWidth={1.6} aria-hidden="true" /><div><span className="landing-small-label">{t('One question at a time')}</span><h3>{t('Guide me step by step')}</h3><p>{t('Plain-language questions about your budget, time and risk, followed by a chance to review your choices.')}</p></div></article>
          <article><SlidersHorizontal size={25} strokeWidth={1.6} aria-hidden="true" /><div><span className="landing-small-label">{t('All fields together')}</span><h3>{t('I’ll fill it in')}</h3><p>{t('A complete form for when you know what you want to explore and would like to get straight to it.')}</p></div></article>
        </div>
      </section>

      <section className="landing-mobile-section" id="home-mobile" aria-labelledby="home-mobile-title">
        <div className="landing-container landing-mobile-layout">
          <div className="landing-mobile-copy"><p className="landing-eyebrow"><MonitorSmartphone size={17} aria-hidden="true" />{t('Same Horizon. Your screen.')}</p><h2 id="home-mobile-title">{t('A little more clarity.')}<br />{t('Wherever you are.')}</h2><p>{t('Start a plan on your computer or explore it from your phone. Horizon adapts to your screen, with the same choices, explanations and price charts.')}</p><ul><li><Check size={18} aria-hidden="true" />{t('Made for desktop and mobile browsers')}</li><li><Check size={18} aria-hidden="true" />{t('Tap-friendly choices and readable results')}</li><li><Check size={18} aria-hidden="true" />{t('Open the website. No installation needed.')}</li></ul><StartLink onStart={start} className="landing-button landing-button-light">{t('Try the web app')}<ArrowUpRight size={18} aria-hidden="true" /></StartLink></div>
          <figure className="landing-phone-figure">
            <div className="landing-phone" aria-hidden="true">
              <div className="landing-phone-speaker" />
              <div className="landing-phone-screen">
                <div className="landing-phone-brand"><strong>horizon.</strong><Menu size={17} /></div>
                <span className="landing-phone-step">{t('YOUR STARTING POINT')}</span><strong className="landing-phone-title">{t('Your plan')}</strong><p>{t('Let’s make it yours.')}</p>
                <span className="landing-phone-label">{t('How much would you invest?')}</span><div className="landing-phone-amount"><span>$</span><strong>{new Intl.NumberFormat(locale).format(1000)}</strong><small>USD</small></div>
                <span className="landing-phone-label">{t('Your time horizon')}</span><div className="landing-phone-days"><span>{t('{days}d', { days: 7 })}</span><strong>{t('{days}d', { days: 30 })}</strong><span>{t('{days}d', { days: 90 })}</span><span>{t('{days}d', { days: 180 })}</span></div>
                <span className="landing-phone-label">{t('Your comfort with risk')}</span><div className="landing-phone-risk"><SlidersHorizontal size={17} /><span>{t('Moderate')}</span><span className="landing-phone-radio" /></div>
                <div className="landing-phone-submit">{t('See my plan')}<ArrowRight size={15} /></div><span className="landing-phone-footnote">{t('No account or payment required.')}</span>
              </div>
            </div>
            <figcaption>{t('Illustrative mobile view · Responsive web app')}</figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-faq landing-container landing-section" id="home-faq" aria-labelledby="home-faq-title">
        <div className="landing-faq-heading"><p className="landing-eyebrow"><HelpCircle size={16} aria-hidden="true" />{t('A few things worth knowing')}</p><h2 id="home-faq-title">{t('Good questions.')}<br />{t('Clear answers.')}</h2><p>{t('Understand what Horizon does before you try it.')}</p></div>
        <div className="landing-faq-list">{questions.map(({ question, answer }) => <details key={question}><summary><span>{t(question)}</span><ChevronDown size={19} aria-hidden="true" /></summary><p>{t(answer)}</p></details>)}</div>
      </section>

      <section className="landing-final-cta landing-container" aria-labelledby="home-final-title"><div><p className="landing-eyebrow">{t('Start with a little perspective')}</p><h2 id="home-final-title">{t('Make your next')}<br />{t('“what if?” a clearer one.')}</h2></div><div><StartLink onStart={start} className="landing-button">{t('Explore your plan')}<ArrowRight size={19} aria-hidden="true" /></StartLink><p>{t('No account. No payment. Your own pace.')}</p></div></section>
    </main>

    <footer className="landing-footer landing-container"><div className="landing-footer-top"><a className="landing-brand" href="#home-top" aria-label={t('Horizon home')}><span>horizon<span>.</span></span></a><span>{t('Built for OxHack ’26')}</span><a href="https://github.com/brbrbre/OxHack2026">{t('Explore the project')}<ArrowUpRight size={14} aria-hidden="true" /></a></div><p>{t(DEFAULT_NOTICE)}</p></footer>
  </div>
}
