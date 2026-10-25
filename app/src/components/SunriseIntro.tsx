import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/I18nContext'

export function shouldShowIntro(search: string): boolean {
  const query = new URLSearchParams(search)
  return !query.has('simbolo') && !query.has('recordatorio')
}

export default function SunriseIntro({ onComplete }: { onComplete: () => void }) {
  const { t } = useI18n()
  const skip = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { onComplete(); return }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    skip.current?.focus({ preventScroll: true })
    const timer = window.setTimeout(onComplete, 2300)
    return () => { window.clearTimeout(timer); document.body.style.overflow = previousOverflow }
  }, [onComplete])
  return <div className="sunrise-intro" role="dialog" aria-modal="true" aria-label={t('Welcome to Horizon')}>
    <button ref={skip} className="intro-skip" type="button" onClick={onComplete}>{t('Skip introduction')} <span aria-hidden="true">↗</span></button>
    <div className="intro-composition">
      <svg className="intro-scene" viewBox="0 0 280 150" aria-hidden="true">
        <defs><clipPath id="dawn-sky"><path d="M0 0h280v106H0z" /></clipPath>
          <linearGradient id="dawn-light" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#E7B75D" /><stop offset="1" stopColor="#CF8147" /></linearGradient></defs>
        <g clipPath="url(#dawn-sky)"><circle className="intro-sun" cx="140" cy="90" r="34" fill="url(#dawn-light)" /></g>
        <path className="intro-horizon" d="M18 107h244" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path className="intro-reflection" d="M119 122h42m-31 9h20" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <p className="intro-wordmark">horizon<span>.</span></p>
      <p className="intro-line">{t('A new perspective begins.')}</p>
    </div>
  </div>
}
