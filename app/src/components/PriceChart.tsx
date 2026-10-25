import { useId } from 'react'
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, LoaderCircle } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DecideResponse, PricesResponse } from '../api/types'
import { useI18n } from '../i18n/I18nContext'
import { buildPriceSeries } from '../lib/forecast'
import { formatQuotePrice, formatQuoteTick, quoteForSymbol } from '../lib/quote'
import AssetLogo from './AssetLogo'
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
  headingId?: string
}

export default function PriceChart({ prices, symbol, name, pending, error, onRetry, isDemo, result = null, headingId = 'chart-heading' }: Props) {
  const fillId = 'price-fill-' + useId().replace(/:/g, '')
  const { locale, t, dateLabel, percentage } = useI18n()
  const { points, historyLength, forecast } = buildPriceSeries(prices, symbol, result)
  const first = points[0]?.close ?? 0
  const lastPoint = points[historyLength - 1]
  const last = lastPoint?.close ?? 0
  const change = first ? (last - first) / first : 0
  const ChangeArrow = change < 0 ? ArrowDownRight : ArrowUpRight
  const quote = quoteForSymbol(symbol)
  const [quoteCurrency, baseCurrency] = quote.unit.split(' per ')
  const quoteUnit = baseCurrency ? t('{quote} per {base}', { quote: quoteCurrency, base: baseCurrency }) : quote.unit
  const quoteNote = quote.currency === 'FX' && quote.unit
    ? t('Exchange rate: {unit}.', { unit: quoteUnit }) : t(quote.note)
  const price = (value: number) => formatQuotePrice(symbol, value, locale)
  return (
    <section className="chart-panel" aria-labelledby={headingId} aria-busy={pending}>
      <div className="chart-title-row">
        <div><h2 id={headingId} className="asset-name-row"><AssetLogo symbol={symbol} /><span>{name}</span></h2>
          <dl className="chart-meta">
            <div><dt>{t('Symbol')}</dt><dd>{symbol}</dd></div>
            <div><dt>{t('Period')}</dt><dd>{t(forecast ? 'Past year + forecast' : 'Past year')}</dd></div>
          </dl>
        </div>
        {!pending && !error && historyLength > 0 && <div className="chart-last-price">
          <strong>{price(last)}</strong>
          <span className={change < 0 ? 'negative-change' : 'positive-change'}>
            <ChangeArrow size={13} aria-hidden="true" />{percentage(change, true)} <small>{t('over period')}</small>
          </span>
        </div>}
      </div>
      {pending ? (
        <div className="chart-state" role="status"><LoaderCircle size={22} aria-hidden="true" /><span>{t('Loading price history…')}</span></div>
      ) : error ? (
        <div className="chart-state"><ErrorMessage message={error} onRetry={onRetry} /></div>
      ) : historyLength < 2 ? (
        <div className="chart-state"><ChartNoAxesCombined size={28} strokeWidth={1.5} aria-hidden="true" />
          <p>{t('There is not enough price history to draw a chart yet.')}</p></div>
      ) : (
        <div className="price-chart" role="img"
          aria-label={t('{symbol} closing price history, {start} to {end}. Latest close {price}.', {
            symbol, start: dateLabel(points[0].date, true), end: dateLabel(lastPoint.date, true), price: price(last),
          }) + ' ' + quoteNote + ' ' + t('Period change {change}.', { change: percentage(change, true) }) +
            (forecast ? ' ' + t('90% range in {days} days, on {date}: {low} to {high}. Expected close {expected}.', {
              days: forecast.days, date: dateLabel(forecast.endDate, true), low: price(forecast.low),
              high: price(forecast.high), expected: price(forecast.expected),
            }) : '')}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 220 }}>
            <ComposedChart data={points} margin={{ top: 16, right: 8, bottom: 0, left: -15 }}>
              <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={(value: number) => formatQuoteTick(symbol, value, locale)} />
              <Tooltip isAnimationActive={false} labelFormatter={(value) => Number.isFinite(Number(value))
                ? dateLabel(new Date(Number(value)).toISOString().slice(0, 10), true) : ''}
                formatter={(value, label) => [Array.isArray(value)
                  ? t('{low} to {high}', { low: price(Number(value[0])), high: price(Number(value[1])) })
                  : price(Number(value)), label]}
                contentStyle={{ border: '1px solid var(--line)', borderRadius: 12, fontSize: 12,
                  background: 'var(--surface)', color: 'var(--ink)' }}
                itemStyle={{ color: 'var(--ink)' }}
                labelStyle={{ color: 'var(--ink-muted)', marginBottom: 5 }} />
              {forecast && <Area className="forecast-band" type="linear" dataKey="range" name={t('90% range')}
                stroke="var(--forecast-boundary)" strokeWidth={1.5} fill="var(--forecast-fill)" fillOpacity={1}
                dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />}
              <Area type="monotone" dataKey="close" name={t('Historical close')} stroke="var(--chart-line)" strokeWidth={2.1}
                fill={'url(#' + fillId + ')'} dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
              {forecast && <ReferenceLine x={lastPoint.timestamp} stroke="var(--ink-muted)" strokeDasharray="3 4" />}
              {forecast && <Line className="forecast-expected" type="linear" dataKey="expected" name={t('Expected close')}
                stroke="var(--forecast-line)" strokeWidth={2} strokeDasharray="5 5" dot={false}
                connectNulls={false} isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {forecast && !pending && !error && <>
        <div className="forecast-caption">
          <span><i className="forecast-range-key" aria-hidden="true" /><strong>{t('90% range in {days} days', { days: forecast.days })}</strong></span>
          <span><i className="forecast-line-key" aria-hidden="true" />{t('Expected price')}</span>
        </div>
        <p className="forecast-note">{t('Estimates for {date}, {days} calendar days after the last close on {start}.', {
          date: dateLabel(forecast.endDate, true), days: forecast.days, start: dateLabel(forecast.startDate, true),
        })}</p>
      </>}
      <div className="chart-footnote"><span className="chart-legend-dot" /> {t('Daily closing price')}
        <span className="chart-currency-note">{quoteNote}{isDemo ? ' ' + t('Illustrative data.') : ''}</span></div>
    </section>
  )
}
