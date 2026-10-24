import type { ForecastSummary, PriceChartPoint } from '../lib/forecast'
import { dateLabel, percentage } from '../lib/format'
import { useCurrency } from '../currency/CurrencyContext'
import { formatQuotePrice } from '../lib/quote'

interface ForecastProps {
  point: PriceChartPoint
  forecast: ForecastSummary
  symbol: string
  compact?: boolean
}

export function ForecastDetails({ point, forecast, symbol, compact = false }: ForecastProps) {
  const { money, currency } = useCurrency()
  const day = point.forecastDay ?? 0
  const atEnd = day === forecast.days
  const gain = point.estimatedGain ?? 0
  const returnLabel = percentage(point.expectedReturn ?? 0, true, 2)
  return <div className={'forecast-details' + (compact ? ' forecast-details-compact' : '')}>
    <div className="forecast-date"><time dateTime={point.date}>{dateLabel(point.date, true)}</time>
      <span>Day {day}{!compact && ' of ' + forecast.days}
        {compact && !atEnd && <span className="forecast-approximation" title="Approximate estimate"> · Approx.</span>}</span></div>
    <dl className="forecast-values">
      <div className="forecast-gain"><dt>{forecast.investmentAmount > 0
        ? 'Estimated ' + (gain < 0 ? 'loss' : 'gain') + ' (' + currency + ')' : 'Expected return'}</dt>
        <dd><strong>{forecast.investmentAmount > 0 ? money(gain, true) : returnLabel}</strong>
          {forecast.investmentAmount > 0 && <span className="forecast-return"><span className="sr-only">Expected return </span>{returnLabel}</span>}
        </dd></div>
      <div className="forecast-price"><dt>Expected price</dt><dd>{formatQuotePrice(symbol, point.expected ?? 0)}</dd></div>
    </dl>
    <p className="forecast-basis">{forecast.investmentAmount > 0
      ? 'On ' + money(forecast.investmentAmount) + (compact ? ' suggested.' : ' suggested investment.')
      : 'No investment suggested.'}</p>
  </div>
}

interface TooltipProps {
  active: boolean
  point?: PriceChartPoint
  forecast: ForecastSummary | null
  symbol: string
}

export default function ChartPointDetails({ active, point, forecast, symbol }: TooltipProps) {
  if (!active || !point) return null
  return <div className="chart-point-tooltip">
    {point.close !== null ? <>
      <time dateTime={point.date}>{dateLabel(point.date, true)}</time>
      <span>Historical close</span>
      <strong>{formatQuotePrice(symbol, point.close)}</strong>
    </> : forecast && <ForecastDetails point={point} forecast={forecast} symbol={symbol} compact />}
  </div>
}
