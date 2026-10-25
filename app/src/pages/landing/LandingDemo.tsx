import { useId, useState } from 'react'
import { ArrowUpRight, Check, MoveHorizontal } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { mockPrices } from '../../mocks/prices'
import AssetLogo from '../../components/AssetLogo'
import './landing-demo.css'

// A deterministic illustration, never a live quote or a model forecast.
const history = mockPrices('SPY', 365)
const times = history.fechas.map((date) => Date.parse(date + 'T12:00:00Z'))
const firstTime = times[0]
const timeSpan = times[times.length - 1] - firstTime
const firstClose = history.cierres[0]
const lowest = Math.min(...history.cierres)
const highest = Math.max(...history.cierres)
const chart = { width: 460, height: 156, left: 9, right: 451, top: 15, bottom: 139 }
const xPosition = (index: number) => chart.left + ((times[index] - firstTime) / timeSpan) * (chart.right - chart.left)
const yPosition = (close: number) => chart.bottom - ((close - lowest) / (highest - lowest)) * (chart.bottom - chart.top)
const points = history.cierres.map((close, index) => xPosition(index) + ',' + yPosition(close)).join(' ')
const area = chart.left + ',' + chart.bottom + ' ' + points + ' ' + chart.right + ',' + chart.bottom

export default function LandingDemo() {
  const { t, locale, percentage, dateLabel } = useI18n()
  const money = (value: number) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'USD', maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
  const monthYear = (date: string) => new Intl.DateTimeFormat(locale, {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(date + 'T12:00:00Z'))
  const instanceId = useId().replaceAll(':', '')
  const sliderId = 'home-demo-date-' + instanceId
  const chartTitleId = 'home-demo-chart-title-' + instanceId
  const chartDescriptionId = 'home-demo-chart-description-' + instanceId
  const gradientId = 'home-demo-price-fill-' + instanceId
  const [selectedIndex, setSelectedIndex] = useState(history.fechas.length - 1)
  const selectedDate = dateLabel(history.fechas[selectedIndex], true)
  const selectedClose = history.cierres[selectedIndex]
  const change = selectedClose / firstClose - 1
  const progress = selectedIndex / (history.fechas.length - 1) * 100
  const readout = t('{date}, {price}, {change} from the first example close', {
    date: selectedDate, price: money(selectedClose), change: percentage(change, true),
  })

  return (
    <div className="landing-demo">
      <div className="landing-demo-panel">
        <div className="landing-demo-asset-row">
          <div className="landing-demo-asset">
            <AssetLogo symbol="SPY" />
            <div><strong>{t('S&P 500 (SPDR)')}</strong><span>{t('SPY · Example price history')}</span></div>
          </div>
          <span className="landing-demo-example-label">{t('Sample view')}</span>
        </div>

        <div className="landing-demo-price-row">
          <div><strong>{money(selectedClose)}</strong><span>{selectedDate}</span></div>
          <span className="landing-demo-change">
            <ArrowUpRight size={16} aria-hidden="true" style={change < 0 ? { transform: 'rotate(90deg)' } : undefined} />
            <strong>{percentage(change, true)}</strong><span>{t('from the first close')}</span>
          </span>
        </div>

        <svg className="landing-demo-chart" viewBox={'0 0 ' + chart.width + ' ' + chart.height}
          role="img" aria-labelledby={chartTitleId} aria-describedby={chartDescriptionId}>
          <title id={chartTitleId}>{t('Illustrative SPY price history')}</title>
          <desc id={chartDescriptionId}>{t('Synthetic prices from October 2025 to October 2026. Selected point: {point}. This is not live market data or a forecast.', { point: readout })}</desc>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity=".14" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient></defs>
          {[34, 83, 132].map((y) => <line key={y} x1={chart.left} x2={chart.right} y1={y} y2={y} className="landing-demo-grid" />)}
          <polygon points={area} fill={'url(#' + gradientId + ')'} />
          <polyline points={points} className="landing-demo-price-line" />
          <line x1={xPosition(selectedIndex)} x2={xPosition(selectedIndex)} y1={chart.top} y2={chart.bottom} className="landing-demo-marker-line" />
          <circle cx={xPosition(selectedIndex)} cy={yPosition(selectedClose)} r="7" className="landing-demo-marker-ring" />
          <circle cx={xPosition(selectedIndex)} cy={yPosition(selectedClose)} r="4" className="landing-demo-marker" />
        </svg>
        <div className="landing-demo-chart-endpoints" aria-hidden="true"><span>{monthYear('2025-10-24')}</span><span>{monthYear('2026-10-24')}</span></div>

        <div className="landing-demo-date-control">
          <label htmlFor={sliderId}><MoveHorizontal size={15} aria-hidden="true" />{t('Explore an example date')}</label>
          <input id={sliderId} type="range" min={0} max={history.fechas.length - 1} step={1} value={selectedIndex}
            aria-valuetext={readout} onChange={(event) => setSelectedIndex(Number(event.target.value))}
            style={{ backgroundImage: 'linear-gradient(to right, var(--accent) 0%, var(--accent) ' + progress + '%, var(--line) ' + progress + '%, var(--line) 100%)' }} />
        </div>

        <div className="landing-demo-answer">
          <div className="landing-demo-answer-heading"><span>{t('Illustrative plan · {amount} budget', { amount: money(1000) })}</span><span className="landing-demo-invest"><Check size={13} aria-hidden="true" />{t('Invest')}</span></div>
          <div className="landing-demo-allocation"><strong>{money(600)} <span>{t('invested')}</span></strong><strong>{money(400)} <span>{t('kept in cash')}</span></strong></div>
          <div className="landing-demo-allocation-bar" role="img" aria-label={t('Illustrative allocation: 60 percent invested, 40 percent cash.')}><span /><span /></div>
        </div>
        <p className="landing-demo-disclosure">{t('Illustrative example. Not live market data or a forecast.')}</p>
      </div>
      <div className="landing-demo-depth-mark" aria-hidden="true"><span /><span /><span /></div>
    </div>
  )
}
