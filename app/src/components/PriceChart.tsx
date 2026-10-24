import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, LoaderCircle } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DecideResponse, PricesResponse } from '../api/types'
import { dateLabel, percentage } from '../lib/format'
import { buildPriceSeries } from '../lib/forecast'
import { formatQuotePrice, formatQuoteTick, quoteForSymbol } from '../lib/quote'
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
  const { points, historyLength, forecast } = buildPriceSeries(prices, symbol, result)
  const first = points[0]?.close ?? 0
  const lastPoint = points[historyLength - 1]
  const last = lastPoint?.close ?? 0
  const change = first ? (last - first) / first : 0
  const ChangeArrow = change < 0 ? ArrowDownRight : ArrowUpRight
  const quote = quoteForSymbol(symbol)
  return (
    <section className="chart-panel" aria-labelledby="chart-heading" aria-busy={pending}>
      <div className="chart-title-row">
        <div><h2 id="chart-heading">{name}</h2>
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
        <div className="price-chart" role="img"
          aria-label={symbol + ' closing price history, ' + dateLabel(points[0].date, true) + ' to ' +
            dateLabel(lastPoint.date, true) + '. Latest close ' + formatQuotePrice(symbol, last) +
            '. ' + quote.note + ' Period change ' + percentage(change, true) + '.' +
            (forecast ? ' 90% range in ' + forecast.days + ' days, on ' + dateLabel(forecast.endDate, true) +
              ': ' + formatQuotePrice(symbol, forecast.low) + ' to ' + formatQuotePrice(symbol, forecast.high) +
              '. Expected close ' + formatQuotePrice(symbol, forecast.expected) + '.' : '')}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 220 }}>
            <ComposedChart data={points} margin={{ top: 16, right: 8, bottom: 0, left: -15 }}>
              <defs><linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
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
              <Tooltip isAnimationActive={false} labelFormatter={(value) => Number.isFinite(Number(value))
                ? dateLabel(new Date(Number(value)).toISOString().slice(0, 10), true) : ''}
                formatter={(value, label) => [Array.isArray(value)
                  ? value.map((end) => formatQuotePrice(symbol, Number(end))).join(' to ')
                  : formatQuotePrice(symbol, Number(value)), label]}
                contentStyle={{ border: '1px solid var(--line)', borderRadius: 12, fontSize: 12,
                  background: 'var(--surface)', color: 'var(--ink)' }}
                itemStyle={{ color: 'var(--ink)' }}
                labelStyle={{ color: 'var(--ink-muted)', marginBottom: 5 }} />
              {forecast && <Area className="forecast-band" type="linear" dataKey="range" name="90% range"
                stroke="var(--forecast-boundary)" strokeWidth={1.5} fill="var(--forecast-fill)" fillOpacity={1}
                dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />}
              <Area type="monotone" dataKey="close" name="Historical close" stroke="var(--chart-line)" strokeWidth={2.1}
                fill="url(#price-fill)" dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
              {forecast && <ReferenceLine x={lastPoint.timestamp} stroke="var(--ink-muted)" strokeDasharray="3 4" />}
              {forecast && <Line className="forecast-expected" type="linear" dataKey="expected" name="Expected close"
                stroke="var(--forecast-line)" strokeWidth={2} strokeDasharray="5 5" dot={false}
                connectNulls={false} isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {forecast && !pending && !error && <>
        <div className="forecast-caption">
          <span><i className="forecast-range-key" aria-hidden="true" /><strong>90% range in {forecast.days} days</strong></span>
          <span><i className="forecast-line-key" aria-hidden="true" />Expected price</span>
        </div>
        <p className="forecast-note">Estimates for {dateLabel(forecast.endDate, true)}, {forecast.days} calendar days after
          the last close on {dateLabel(forecast.startDate, true)}.</p>
      </>}
      <div className="chart-footnote"><span className="chart-legend-dot" /> Daily closing price
        <span className="chart-currency-note">{quote.note}{isDemo ? ' Illustrative data.' : ''}</span></div>
    </section>
  )
}
