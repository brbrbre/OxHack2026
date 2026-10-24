import { useId, useState } from 'react'
import { ArrowUpRight, Check, MoveHorizontal } from 'lucide-react'
import { money, percentage, dateLabel } from '../../lib/format'
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
  const readout = selectedDate + ', ' + money(selectedClose) + ', ' + percentage(change, true) + ' from the first example close'

  return (
    <div className="landing-demo">
      <div className="landing-demo-panel">
        <div className="landing-demo-asset-row">
          <div className="landing-demo-asset">
            <AssetLogo symbol="SPY" />
            <div><strong>S&amp;P 500 (SPDR)</strong><span>SPY · Example price history</span></div>
          </div>
          <span className="landing-demo-example-label">Sample view</span>
        </div>

        <div className="landing-demo-price-row">
          <div><strong>{money(selectedClose)}</strong><span>{selectedDate}</span></div>
          <span className="landing-demo-change">
            <ArrowUpRight size={16} aria-hidden="true" style={change < 0 ? { transform: 'rotate(90deg)' } : undefined} />
            <strong>{percentage(change, true)}</strong><span>from the first close</span>
          </span>
        </div>

        <svg className="landing-demo-chart" viewBox={'0 0 ' + chart.width + ' ' + chart.height}
          role="img" aria-labelledby={chartTitleId} aria-describedby={chartDescriptionId}>
          <title id={chartTitleId}>Illustrative SPY price history</title>
          <desc id={chartDescriptionId}>Synthetic prices from October 2025 to October 2026. Selected point: {readout}. This is not live market data or a forecast.</desc>
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
        <div className="landing-demo-chart-endpoints" aria-hidden="true"><span>Oct 2025</span><span>Oct 2026</span></div>

        <div className="landing-demo-date-control">
          <label htmlFor={sliderId}><MoveHorizontal size={15} aria-hidden="true" />Explore an example date</label>
          <input id={sliderId} type="range" min={0} max={history.fechas.length - 1} step={1} value={selectedIndex}
            aria-valuetext={readout} onChange={(event) => setSelectedIndex(Number(event.target.value))}
            style={{ backgroundImage: 'linear-gradient(to right, var(--accent) 0%, var(--accent) ' + progress + '%, var(--line) ' + progress + '%, var(--line) 100%)' }} />
        </div>

        <div className="landing-demo-answer">
          <div className="landing-demo-answer-heading"><span>Illustrative plan · $1,000 budget</span><span className="landing-demo-invest"><Check size={13} aria-hidden="true" />Invest</span></div>
          <div className="landing-demo-allocation"><strong>$600 <span>invested</span></strong><strong>$400 <span>kept in cash</span></strong></div>
          <div className="landing-demo-allocation-bar" role="img" aria-label="Illustrative allocation: 60 percent invested, 40 percent cash."><span /><span /></div>
        </div>
        <p className="landing-demo-disclosure">Illustrative example. Not live market data or a forecast.</p>
      </div>
      <div className="landing-demo-depth-mark" aria-hidden="true"><span /><span /><span /></div>
    </div>
  )
}
