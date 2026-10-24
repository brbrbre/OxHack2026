import { useId, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ValueProjection, ValueProjectionPoint } from '../lib/valueForecast'
import { percentage } from '../lib/format'
import { useCurrency } from '../currency/CurrencyContext'
import { currencyName, fromUsd } from '../currency/currency'
import type { CurrencyCode } from '../currency/currency'
import '../value-growth.css'

interface Props {
  projection: ValueProjection
  title: string
  basis: string
  idPrefix: string
  compact?: boolean
  headingLevel?: 3 | 4
}

export function ValuePointDetails({ point, days }: { point: ValueProjectionPoint; days: number }) {
  const { money } = useCurrency()
  return <div className="value-point-tooltip">
    <span>Day {point.day} of {days}</span>
    <p>Estimated value</p><strong>{money(point.value)}</strong>
    <span className={point.gain < 0 ? 'value-change negative' : point.gain === 0 ? 'value-change neutral' : 'value-change'}>
      {money(point.gain, true)} <span>({percentage(point.return, true, 2)})</span>
    </span>
    {point.day > 0 && point.day < days && <small>Approximate path</small>}
  </div>
}

function valueTick(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2,
  }).format(fromUsd(value, currency)).replace('US$', '$')
}

export default function ValueGrowthChart({ projection, title, basis, idPrefix, compact = false, headingLevel = 4 }: Props) {
  const { money, currency } = useCurrency()
  const [selection, setSelection] = useState<{ projection: ValueProjection; day: number } | null>(null)
  const uniqueId = useId()
  const headingId = idPrefix + '-title-' + uniqueId
  const sliderId = idPrefix + '-day-' + uniqueId
  const methodId = idPrefix + '-method-' + uniqueId
  const day = selection?.projection === projection ? selection.day : projection.days
  const point = projection.points[day]
  const hasLower = projection.points.some((item) => item.lower !== null && item.lower !== item.value)
  const hasUpper = projection.points.at(-1)?.upper !== null
  const Heading = headingLevel === 3 ? 'h3' : 'h4'
  const chartPoints = useMemo(() => projection.points.map((item) => ({ ...item,
    range: item.lower !== null && item.upper !== null ? [item.lower, item.upper] : null,
  })), [projection])
  const valueDomain = useMemo((): [number, number] => {
    const values = projection.points.flatMap((item) => [item.value, item.lower, item.upper])
      .filter((value): value is number => value !== null)
    const low = Math.min(...values)
    const high = Math.max(...values)
    const padding = Math.max((high - low) * 0.12, projection.amount * 0.025, 0.01)
    return [low - padding, high + padding]
  }, [projection])
  function selectPoint(state: { activeTooltipIndex: string | number | null | undefined }) {
    if (state.activeTooltipIndex == null) return
    const selected = projection.points[Number(state.activeTooltipIndex)]
    if (!selected) return
    setSelection((current) => current?.projection === projection && current.day === selected.day
      ? current : { projection, day: selected.day })
  }
  if (!point) return null
  return <section className={'value-growth' + (compact ? ' value-growth-compact' : '')} aria-labelledby={headingId}>
    <div className="value-growth-heading"><Heading id={headingId}>{title}</Heading><span>{currency}</span></div>
    <div className="value-growth-summary">
      <div><span>Estimated value</span><strong>{money(point.value)}</strong>
        <span className={point.gain < 0 ? 'value-change negative' : point.gain === 0 ? 'value-change neutral' : 'value-change'}>
          {money(point.gain, true)} <span>({percentage(point.return, true, 2)})</span>
        </span>
      </div>
      <span className="value-growth-day">Day <strong>{point.day}</strong> of {projection.days}</span>
    </div>
    <p className="value-growth-basis">{basis}</p>
    <div className="value-growth-plot" role="group" aria-label={title + '. Initial value ' + money(projection.amount) +
      '. Expected value ' + money(projection.points.at(-1)!.value) + ' after ' + projection.days + ' days. Values in ' +
      (currency === 'USD' ? 'US dollars' : currencyName(currency)) + '.'}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: compact ? 165 : 210 }}>
        <ComposedChart data={chartPoints} margin={{ top: 10, right: 10, bottom: 0, left: -13 }} accessibilityLayer
          onMouseMove={selectPoint} onClick={selectPoint} onTouchStart={selectPoint} onTouchMove={selectPoint}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
          <XAxis dataKey="day" type="number" domain={[0, projection.days]} axisLine={false} tickLine={false}
            ticks={[0, Math.round(projection.days / 3), Math.round(projection.days * 2 / 3), projection.days]}
            tickFormatter={(value: number) => 'Day ' + value} tick={{ fontSize: 12, fill: 'var(--ink-2)' }} minTickGap={22} />
          <YAxis domain={valueDomain} width={80} tickCount={3} axisLine={false} tickLine={false}
            tickFormatter={(value: number) => valueTick(value, currency)} tick={{ fontSize: 12, fill: 'var(--ink-2)' }} />
          <Tooltip isAnimationActive={false} cursor={{ stroke: 'var(--ink-2)', strokeDasharray: '3 4' }}
            content={({ active, label }) => active && projection.points[Number(label)]
              ? <ValuePointDetails point={projection.points[Number(label)]} days={projection.days} /> : null} />
          <ReferenceLine y={projection.amount} stroke="var(--line)" strokeDasharray="3 4" />
          {hasUpper && <Area dataKey="range" type="linear" name="Estimated range" stroke="var(--forecast-boundary)"
            strokeWidth={1} fill="var(--accent-soft)" fillOpacity={1} dot={false} activeDot={false} isAnimationActive={false} />}
          {hasLower && !hasUpper && <Line dataKey="lower" type="linear" name="Lower scenario"
            stroke="var(--decision-wait)" strokeDasharray="4 4" strokeWidth={1.6} dot={false} activeDot={false} isAnimationActive={false} />}
          <Line dataKey="value" type="linear" name="Expected value" stroke="var(--accent)" strokeWidth={2.3}
            dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
          <ReferenceDot x={point.day} y={point.value} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div className="value-growth-legend"><span><i />Expected value</span>
      {hasLower && <span className={hasUpper ? 'value-range-key' : 'value-lower-key'}><i />{hasUpper ? 'Estimated range' : 'Lower scenario'}</span>}
    </div>
    <label className="sr-only" htmlFor={sliderId}>{title}: choose a day</label>
    <input id={sliderId} type="range" min={0} max={projection.days} step={1} value={point.day} aria-describedby={methodId}
      aria-valuetext={'Day ' + point.day + ' of ' + projection.days + ', estimated value ' + money(point.value) +
        ', change ' + money(point.gain, true)}
      onChange={(event) => setSelection({ projection, day: Number(event.target.value) })} />
    <p id={methodId} className="value-growth-method">Approximate daily path from the final estimate. {projection.cash > 0 ? 'Cash is included and stays unchanged.' : 'Not daily model predictions.'}</p>
    <details className="forecast-more value-growth-more"><summary>About this chart</summary>
      <p>Values between day 0 and day {projection.days} follow a straight-line approximation of the API’s final estimate.</p>
      <p>The model can be wrong. Cash returns, fees and exchange-rate changes are excluded.</p>
      {point.lower !== null && <p>{point.upper !== null ? 'Estimated value range' : 'Lower scenario'} at day {point.day}: {' '}
        {money(point.lower)}{point.upper !== null ? ' to ' + money(point.upper) : ''}.
        {point.day < projection.days ? ' Intermediate ranges are illustrative.' : ''}</p>}
    </details>
  </section>
}
