import { ArrowUpRight, ChartNoAxesCombined, LoaderCircle } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PricesResponse } from '../api/types'
import { dateLabel, percentage, price } from '../lib/format'
import ErrorMessage from './ErrorMessage'

interface Props {
  prices: PricesResponse | null
  symbol: string
  name: string
  pending: boolean
  error: string | null
  onRetry: () => void
  isDemo: boolean
}

export default function PriceChart({ prices, symbol, name, pending, error, onRetry, isDemo }: Props) {
  const points = prices?.fechas.map((date, index) => ({ date, close: prices.cierres[index] })) ?? []
  const first = points[0]?.close ?? 0
  const last = points.at(-1)?.close ?? 0
  const change = first ? (last - first) / first : 0
  return (
    <section className="panel chart-panel" aria-labelledby="chart-heading" aria-busy={pending}>
      <div className="panel-heading">
        <div className="section-eyebrow"><span className="step-number">03</span> THE BIGGER PICTURE</div>
        <span className="time-badge">1 year</span>
      </div>
      <div className="chart-title-row">
        <div><h2 id="chart-heading">A year in perspective.</h2><p>{symbol} <span>·</span> {name}</p></div>
        {!pending && !error && points.length > 0 && <div className="chart-last-price">
          <strong>{price(last)}</strong>
          <span className={change < 0 ? 'negative-change' : 'positive-change'}>
            <ArrowUpRight size={13} aria-hidden="true" />{percentage(change, true)} <small>over period</small>
          </span>
        </div>}
      </div>
      {pending ? (
        <div className="chart-state" role="status"><LoaderCircle size={22} className="spin" aria-hidden="true" /><span>Loading price history…</span></div>
      ) : error ? (
        <div className="chart-state"><ErrorMessage message={error} onRetry={onRetry} /></div>
      ) : points.length < 2 ? (
        <div className="chart-state"><ChartNoAxesCombined size={28} strokeWidth={1.5} aria-hidden="true" />
          <p>There is not enough price history to draw a chart yet.</p></div>
      ) : (
        <div className="price-chart" role="img"
          aria-label={symbol + ' closing price history, ' + dateLabel(points[0].date, true) + ' to ' +
            dateLabel(points[points.length - 1].date, true) + '. Period change ' + percentage(change, true) + '.'}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 220 }}>
            <AreaChart data={points} margin={{ top: 16, right: 8, bottom: 0, left: -15 }}>
              <defs><linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3c9773" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#3c9773" stopOpacity={0.01} />
              </linearGradient></defs>
              <CartesianGrid stroke="#edf0ed" vertical={false} strokeDasharray="3 5" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={45}
                tickFormatter={(value: string) => dateLabel(value)} tick={{ fontSize: 11, fill: '#839087' }} dy={9} />
              <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} width={65} tickCount={4}
                tick={{ fontSize: 11, fill: '#839087' }}
                tickFormatter={(value: number) => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 2 }).format(value)} />
              <Tooltip labelFormatter={(value) => dateLabel(String(value), true)}
                formatter={(value) => [price(Number(value)), 'Close']}
                contentStyle={{ border: '1px solid #e5eae6', borderRadius: 12, fontSize: 12, boxShadow: '0 5px 20px #18352610' }}
                labelStyle={{ color: '#6e7b73', marginBottom: 5 }} />
              <Area type="monotone" dataKey="close" stroke="#338361" strokeWidth={2.1}
                fill="url(#price-fill)" dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="chart-footnote"><span className="chart-legend-dot" /> Daily closing price
        <span className="chart-currency-note">Asset quote currency{isDemo ? ' · Illustrative data' : ''}</span></div>
    </section>
  )
}
