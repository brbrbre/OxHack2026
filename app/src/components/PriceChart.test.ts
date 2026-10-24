import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { decisionFixtures } from '../mocks/decisions'
import PriceChart from './PriceChart'

const props = {
  symbol: 'SPY', name: 'S&P 500 (SPDR)',
  prices: { simbolo: 'SPY', fechas: ['2026-10-22', '2026-10-23'], cierres: [98, 100] },
  pending: false, error: null, onRetry: () => {}, isDemo: false,
}

describe('forecast presentation', () => {
  it('labels the terminal range and expected price with its calendar date and quote currency', () => {
    const html = renderToStaticMarkup(createElement(PriceChart, { ...props, result: decisionFixtures.invest }))
    expect(html).toContain('90% range in 30 days')
    expect(html).toContain('22 Nov 2026')
    expect(html).toContain('$95.50 to $108.50')
    expect(html).toContain('Expected close $102.00')
    expect(html).toContain('Past year + forecast')
    expect(html).not.toContain('NaN')
  })

  it('shows historical prices without a forecast before analysis', () => {
    const html = renderToStaticMarkup(createElement(PriceChart, props))
    expect(html).toContain('Latest close $100.00')
    expect(html).not.toContain('90% range in')
    expect(html).not.toContain('Expected close')
  })

  it('removes the cone when an analysis belongs to another selected asset', () => {
    const html = renderToStaticMarkup(createElement(PriceChart, { ...props, result: decisionFixtures.wait }))
    expect(html).not.toContain('90% range in')
    expect(html).not.toContain('Expected close')
  })
})
