import { useEffect, useId, useRef } from 'react'
import type { CSSProperties } from 'react'
import { DEFAULT_HORIZON_DAYS, HORIZON_RANGE, isNewHorizon } from '../config'
import { useI18n } from '../i18n/I18nContext'
import '../horizon-slider.css'

interface Props {
  value: number
  onChange: (days: number) => void
}

type Translate = (source: string, values?: Record<string, string | number>) => string
export function horizonLabel(days: number, t: Translate): string {
  return days === 1 ? t('1 day') : t('{days} days', { days })
}

export default function HorizonSlider({ value, onChange }: Props) {
  const { t } = useI18n()
  const instanceId = 'horizon-' + useId()
  const input = useRef<HTMLInputElement>(null)
  const focusAfterChoosing = useRef(false)
  const saved = value > HORIZON_RANGE.max
  const label = horizonLabel(value, t)
  const progress = (value - HORIZON_RANGE.min) / (HORIZON_RANGE.max - HORIZON_RANGE.min) * 100

  useEffect(() => {
    if (saved || !focusAfterChoosing.current) return
    focusAfterChoosing.current = false
    input.current?.focus({ preventScroll: true })
  }, [saved, value])

  // A range input would silently clamp saved 90/180/365-day plans to 60.
  // Keep their exact duration until the person explicitly chooses a new one.
  if (saved) return <div className="horizon-slider horizon-saved">
    <div className="horizon-slider-readout"><span>{t('Saved duration')}</span><strong>{label}</strong></div>
    <input type="hidden" name="horizon" value={value} />
    <p className="horizon-slider-hint">{t('This plan keeps its original {days}-day duration.', { days: value })}</p>
    <button type="button" className="horizon-change-saved" onClick={() => {
      focusAfterChoosing.current = true
      onChange(DEFAULT_HORIZON_DAYS)
    }}>{t('Choose a duration from 1 to 60 days')}</button>
  </div>

  return <div className="horizon-slider">
    <div className="horizon-slider-readout"><output htmlFor={instanceId} aria-live="off">{label}</output></div>
    <input ref={input} id={instanceId} className="horizon-slider-range" name="horizon" type="range"
      min={HORIZON_RANGE.min} max={HORIZON_RANGE.max} step={HORIZON_RANGE.step} value={value}
      aria-label={t('Investment period')} aria-valuetext={label} aria-describedby={instanceId + '-hint'}
      style={{ '--horizon-progress': progress + '%' } as CSSProperties}
      onChange={(event) => {
        const days = Number(event.target.value)
        if (isNewHorizon(days)) onChange(days)
      }} />
    <div className="horizon-slider-endpoints" aria-hidden="true"><span>{horizonLabel(HORIZON_RANGE.min, t)}</span>
      <span>{horizonLabel(HORIZON_RANGE.max, t)}</span></div>
    <p className="horizon-slider-hint" id={instanceId + '-hint'}>{t('Drag to choose any duration from 1 to 60 days.')}</p>
  </div>
}
