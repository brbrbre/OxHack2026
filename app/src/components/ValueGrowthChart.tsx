import { useId, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ValueProjection } from '../lib/valueForecast'
import { useCurrency } from '../currency/CurrencyContext'
import { fromUsd } from '../currency/currency'
import { useI18n } from '../i18n/I18nContext'
import '../value-growth.css'

interface Props {
  projection: ValueProjection
  title: string
  basis: string
  idPrefix: string
  compact?: boolean
  headingLevel?: 3 | 4
}

export default function ValueGrowthChart({ projection, title, basis, idPrefix, compact = false, headingLevel = 3 }: Props) {
  const { money, currency } = useCurrency()
  const { t, locale, percentage } = useI18n()
  const [selection, setSelection] = useState<{ projection: ValueProjection; day: number } | null>(null)
  const instanceId = useId()
  const headingId = idPrefix + '-title-' + instanceId
  const sliderId = idPrefix + '-day-' + instanceId
  const methodId = idPrefix + '-method-' + instanceId
  const day = selection?.projection === projection ? selection.day : projection.days
  const point = projection.points[day]
  const Heading = headingLevel === 4 ? 'h4' : 'h3'
  const chartPoints = useMemo(() => projection.points.map((item) => ({
    ...item, range: [item.lower, item.upper],
  })), [projection])
  const domain = useMemo((): [number, number] => {
    const values = projection.points.flatMap((item) => [item.value, item.lower, item.upper])
    const low = Math.min(...values)
    const high = Math.max(...values)
    const padding = Math.max((high - low) * 0.12, projection.amount * 0.025, 0.01)
    return [low - padding, high + padding]
  }, [projection])
  const ticks = [...new Set([0, Math.round(projection.days / 2), projection.days])]

  function selectPoint(state: { activeTooltipIndex?: string | number | null }) {
    if (state.activeTooltipIndex == null) return
    const selected = projection.points[Number(state.activeTooltipIndex)]
    if (!selected) return
    setSelection((current) => current?.projection === projection && current.day === selected.day
      ? current : { projection, day: selected.day })
  }

  function moneyTick(value: number) {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale, {
      style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2,
    }).format(fromUsd(value, currency)).replace('US$', '$')
  }

  if (!point) return null
  return <section className={'value-growth' + (compact ? ' value-growth-compact' : '')} aria-labelledby={headingId}>
    <div className="value-growth-heading"><Heading id={headingId}>{title}</Heading><span>{currency}</span></div>
    <p className="value-growth-basis">{basis}</p>
    <div className="value-growth-summary">
      <div><span>{t('Estimated value')}</span><strong>{money(point.value)}</strong>
        <span className={'value-change' + (point.gain < 0 ? ' negative' : point.gain === 0 ? ' neutral' : '')}>
          {money(point.gain, true)} <span>({percentage(point.return, true)})</span>
        </span>
      </div>
      <span className="value-growth-day">{t('Day {day} of {days}', { day: point.day, days: projection.days })}</span>
    </div>
    <div className="value-growth-plot" role="group" aria-label={t('Initial value {amount}. Expected value {expected} after {days} days. Values in {currency}.', {
      amount: money(projection.amount), expected: money(projection.points.at(-1)!.value), days: projection.days, currency,
    })}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: compact ? 180 : 220 }}>
        <ComposedChart data={chartPoints} margin={{ top: 14, right: 12, bottom: 0, left: -10 }} accessibilityLayer
          onMouseMove={selectPoint} onClick={selectPoint} onTouchStart={selectPoint} onTouchMove={selectPoint}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
          <XAxis dataKey="day" type="number" domain={[0, projection.days]} ticks={ticks}
            axisLine={false} tickLine={false} minTickGap={24}
            tickFormatter={(value: number) => t('Day {day}', { day: value })} tick={{ fontSize: 12, fill: 'var(--ink-2)' }} />
          <YAxis domain={domain} width={82} tickCount={4} axisLine={false} tickLine={false}
            tickFormatter={moneyTick} tick={{ fontSize: 12, fill: 'var(--ink-2)' }} />
          <Tooltip isAnimationActive={false} content={() => null}
            cursor={{ stroke: 'var(--ink-2)', strokeDasharray: '3 4' }} />
          <ReferenceLine y={projection.amount} stroke="var(--line)" strokeDasharray="3 4" />
          <Area dataKey="range" type="linear" name={t('Estimated range')} stroke="var(--forecast-boundary)"
            strokeWidth={1} fill="var(--forecast-fill)" fillOpacity={1} dot={false} activeDot={false} isAnimationActive={false} />
          <Line dataKey="value" type="linear" name={t('Expected value')} stroke="var(--accent)" strokeWidth={2.3}
            dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
          <ReferenceDot x={point.day} y={point.value} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div className="value-growth-legend"><span><i aria-hidden="true" />{t('Expected value')}</span>
      <span className="value-range-key"><i aria-hidden="true" />{t('Estimated range')}</span></div>
    <label className="value-growth-slider-label" htmlFor={sliderId}>{t('Explore a day')}</label>
    <input id={sliderId} type="range" min={0} max={projection.days} step={1} value={point.day} aria-describedby={methodId}
      aria-valuetext={t('Day {day} of {days}, estimated value {value}, change {change}', {
        day: point.day, days: projection.days, value: money(point.value), change: money(point.gain, true),
      })} onChange={(event) => setSelection({ projection, day: Number(event.target.value) })} />
    <p id={methodId} className="value-growth-method">{t('Illustrative straight-line path to the final estimate, not daily model predictions.')}</p>
    <details className="value-growth-more"><summary>{t('About this chart')}</summary>
      <p>{t('Values between day 0 and day {days} follow a straight-line approximation of the final estimate.', { days: projection.days })}</p>
      <p>{t('The model can be wrong. Fees and exchange-rate changes are excluded.')}</p>
      <p>{t('Estimated value range at day {day}: {low} to {high}.', {
        day: point.day, low: money(point.lower), high: money(point.upper),
      })}{point.day < projection.days ? ' ' + t('Intermediate ranges are illustrative.') : ''}</p>
    </details>
  </section>
}
