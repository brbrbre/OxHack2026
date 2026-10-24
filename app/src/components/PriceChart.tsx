import { useId, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, ChevronDown, LoaderCircle } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DecideResponse, PricesResponse } from '../api/types'
import { dateLabel, percentage } from '../lib/format'
import { buildPriceSeries } from '../lib/forecast'
import { formatQuotePrice, formatQuoteTick, quoteForSymbol } from '../lib/quote'
import AssetLogo from './AssetLogo'
import ChartPointDetails, { ForecastDetails } from './ChartPointDetails'
import ErrorMessage from './ErrorMessage'

interface Props {
  prices: PricesResponse | null
  symbol: string
  name: string
  pending: boolean
  error: string | null
  onRetry: () => void
  isDemo: boolean
  result?: DecideResponse | null
}

export default function PriceChart({ prices, symbol, name, pending, error, onRetry, isDemo, result = null }: Props) {
  const { points, historyLength, forecast } = useMemo(() => buildPriceSeries(prices, symbol, result), [prices, symbol, result])
  const [selection, setSelection] = useState<{ result: DecideResponse | null; day: number } | null>(null)
  const selectedDay = forecast ? selection?.result === result ? selection.day : forecast.days : 0
  const selectedPoint = forecast ? points[historyLength - 1 + selectedDay] : undefined
  const chartId = useId()
  const sliderId = 'forecast-day-' + chartId
  const methodId = 'forecast-method-' + chartId
  const gradientId = 'price-fill-' + chartId
  function selectChartPoint(state: { activeTooltipIndex: number | string | null | undefined }) {
    if (state.activeTooltipIndex == null) return
    const point = points[Number(state.activeTooltipIndex)]
    const day = point?.forecastDay
    if (day !== undefined) {
      setSelection((previous) => previous?.result === result && previous.day === day
        ? previous : { result, day })
    }
  }
  const first = points[0]?.close ?? 0
  const lastPoint = points[historyLength - 1]
  const last = lastPoint?.close ?? 0
  const change = first ? (last - first) / first : 0
  const ChangeArrow = change < 0 ? ArrowDownRight : ArrowUpRight
  const quote = quoteForSymbol(symbol)
  return (
    <section className="chart-panel" aria-labelledby="chart-heading" aria-busy={pending}>
      <div className="chart-title-row">
        <div><h2 id="chart-heading" className="asset-name-row"><AssetLogo symbol={symbol} /><span>{name}</span></h2>
          <dl className="chart-meta">
            <div><dt>Symbol</dt><dd>{symbol}</dd></div>
            <div><dt>Period</dt><dd>{forecast ? 'Past year + forecast' : 'Past year'}</dd></div>
          </dl>
        </div>
        {!pending && !error && historyLength > 0 && <div className="chart-last-price">
          <strong>{formatQuotePrice(symbol, last)}</strong>
          <span className={change < 0 ? 'negative-change' : 'positive-change'}>
            <ChangeArrow size={13} aria-hidden="true" />{percentage(change, true)} <small>over period</small>
          </span>
        </div>}
      </div>
      {pending ? (
        <div className="chart-state" role="status"><LoaderCircle size={22} aria-hidden="true" /><span>Loading price history…</span></div>
      ) : error ? (
        <div className="chart-state"><ErrorMessage message={error} onRetry={onRetry} /></div>
      ) : historyLength < 2 ? (
        <div className="chart-state"><ChartNoAxesCombined size={28} strokeWidth={1.5} aria-hidden="true" />
          <p>There is not enough price history to draw a chart yet.</p></div>
      ) : (
        <div className="price-chart" role="group"
          aria-label={symbol + ' closing price history, ' + dateLabel(points[0].date, true) + ' to ' +
            dateLabel(lastPoint.date, true) + '. Latest close ' + formatQuotePrice(symbol, last) +
            '. ' + quote.note + ' Period change ' + percentage(change, true) + '.' +
            (forecast ? ' 90% range in ' + forecast.days + ' days, on ' + dateLabel(forecast.endDate, true) +
              ': ' + formatQuotePrice(symbol, forecast.low) + ' to ' + formatQuotePrice(symbol, forecast.high) +
              '. Expected close ' + formatQuotePrice(symbol, forecast.expected) + '.' : '')}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 220 }}>
            <ComposedChart data={points} margin={{ top: 16, right: 8, bottom: 0, left: -15 }}
              accessibilityLayer onMouseMove={selectChartPoint} onClick={selectChartPoint}
              onTouchStart={selectChartPoint} onTouchMove={selectChartPoint}>
              <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0.01} />
              </linearGradient></defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5" />
              <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']}
                axisLine={false} tickLine={false} minTickGap={45}
                tickFormatter={(value: number) => dateLabel(new Date(value).toISOString().slice(0, 10))}
                tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} dy={9} />
              <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} width={80} tickCount={4}
                tick={{ fontSize: 12, fill: 'var(--ink-muted)' }}
                tickFormatter={(value: number) => formatQuoteTick(symbol, value)} />
              <Tooltip isAnimationActive={false} cursor={{ stroke: 'var(--ink-muted)', strokeDasharray: '3 4' }}
                content={({ active, label }) => <ChartPointDetails active={active}
                  point={points.find((point) => point.timestamp === Number(label))} forecast={forecast} symbol={symbol} />} />
              {forecast && <Area className="forecast-band" type="linear" dataKey="range" name="90% range"
                stroke="var(--forecast-boundary)" strokeWidth={1.5} fill="var(--forecast-fill)" fillOpacity={1}
                dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />}
              <Area type="monotone" dataKey="close" name="Historical close" stroke="var(--chart-line)" strokeWidth={2.1}
                fill={'url(#' + gradientId + ')'} dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
              {forecast && <ReferenceLine x={lastPoint.timestamp} stroke="var(--ink-muted)" strokeDasharray="3 4" />}
              {forecast && <Line className="forecast-expected" type="linear" dataKey="expected" name="Expected close"
                stroke="var(--forecast-line)" strokeWidth={2} strokeDasharray="5 5" dot={false}
                connectNulls={false} isAnimationActive={false} />}
              {selectedPoint && <ReferenceDot x={selectedPoint.timestamp} y={selectedPoint.expected!}
                r={4} fill="var(--forecast-line)" stroke="var(--surface)" strokeWidth={2} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {forecast && !pending && !error && <>
        <div className="forecast-caption">
          <span><i className="forecast-range-key" aria-hidden="true" /><strong>90% range in {forecast.days} days</strong></span>
          <span><i className="forecast-line-key" aria-hidden="true" />Expected price</span>
        </div>
        {selectedPoint && <div className="forecast-explorer">
          <label htmlFor={sliderId}>Explore your forecast</label>
          <p className="forecast-explore-hint">Hover, tap or choose a day.</p>
          <ForecastDetails point={selectedPoint} forecast={forecast} symbol={symbol} />
          <input id={sliderId} type="range" min={0} max={forecast.days} step={1} value={selectedDay}
            aria-describedby={methodId}
            aria-valuetext={'Day ' + selectedDay + ' of ' + forecast.days + ', ' + dateLabel(selectedPoint.date, true) +
              ', expected return ' + percentage(selectedPoint.expectedReturn ?? 0, true, 2)}
            onChange={(event) => setSelection({ result, day: Number(event.target.value) })} />
          <div className="forecast-slider-ends"><span>Last close</span><span>{forecast.days} days</span></div>
          <p id={methodId} className="forecast-method">Intermediate dates are approximate.</p>
          <details className="forecast-more"><summary>About this estimate <ChevronDown size={14} aria-hidden="true" /></summary>
            {selectedPoint.range && <p>{selectedDay === forecast.days ? '90% price range' : 'Illustrative price range'}: {' '}
              {formatQuotePrice(symbol, selectedPoint.range[0])} to {formatQuotePrice(symbol, selectedPoint.range[1])}.</p>}
            <p>Final estimate: {dateLabel(forecast.endDate, true)}, {forecast.days} calendar days after
              the last close on {dateLabel(forecast.startDate, true)}.</p>
            <p>Between dates, we use a straight-line approximation of the final estimate,
              not daily model predictions. Cash returns and exchange-rate changes are excluded.</p>
          </details>
        </div>}
      </>}
      <div className="chart-footnote"><span className="chart-legend-dot" /> Daily closing price
        <span className="chart-currency-note">{quote.note}{isDemo ? ' Illustrative data.' : ''}</span></div>
    </section>
  )
}
