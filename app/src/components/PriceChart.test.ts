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
  it('retains the supplied asset title and explicit symbol alongside its decorative logo', () => {
    const html = renderToStaticMarkup(createElement(PriceChart, props))
    const heading = html.split('<h2 id="chart-heading"')[1].split('</h2>')[0]
    expect(heading).toContain('S&amp;P 500 (SPDR)')
    expect(heading).toContain('aria-hidden="true"')
    expect(html).toContain('<dt>Symbol</dt><dd>SPY</dd>')
  })

  it('labels the terminal range and expected price with its calendar date and quote currency', () => {
    const html = renderToStaticMarkup(createElement(PriceChart, { ...props, result: decisionFixtures.invest }))
    expect(html).toContain('90% range in 30 days')
    expect(html).toContain('22 Nov 2026')
    expect(html).toContain('$95.50 to $108.50')
    expect(html).toContain('Expected close $102.00')
    expect(html).toContain('Past year + forecast')
    expect(html).toContain('Explore your forecast')
    expect(html).toContain('type="range"')
    expect(html).toContain('max="30"')
    expect(html).toContain('aria-valuetext="Day 30 of 30, 22 Nov 2026, expected return +2%"')
    expect(html).toContain('Estimated gain (USD)')
    expect(html).toContain('+$20')
    expect(html).toContain('not daily model predictions')
    expect(html).not.toContain('NaN')
  })

  it('shows historical prices without a forecast before analysis', () => {
    const html = renderToStaticMarkup(createElement(PriceChart, props))
    expect(html).toContain('Latest close $100.00')
    expect(html).not.toContain('90% range in')
    expect(html).not.toContain('Expected close')
    expect(html).not.toContain('Explore your forecast')
  })

  it('keeps the short approximation notice visible and puts ranges and method in a closed disclosure', () => {
    const html = renderToStaticMarkup(createElement(PriceChart, { ...props, result: decisionFixtures.invest }))
    const explorer = html.split('<div class="forecast-explorer">')[1]
    const visibleSummary = explorer.split('<details')[0]
    const disclosure = explorer.split('<details class="forecast-more">')[1]?.split('</details>')[0]
    expect(visibleSummary).toContain('Intermediate dates are approximate.')
    expect(visibleSummary).toContain('On $1,000 suggested investment.')
    expect(visibleSummary).not.toContain('price range')
    expect(visibleSummary).not.toContain('straight-line')
    expect(disclosure).toContain('About this estimate')
    expect(disclosure).toContain('90% price range')
    expect(disclosure).toContain('$95.50 to $108.50')
    expect(disclosure).toContain('straight-line approximation')
    expect(disclosure).toContain('Cash returns and exchange-rate changes are excluded.')
    expect(html).not.toMatch(/<details[^>]*\bopen(?:[=>\s])/)
  })

  it('removes the cone when an analysis belongs to another selected asset', () => {
    const html = renderToStaticMarkup(createElement(PriceChart, { ...props, result: decisionFixtures.wait }))
    expect(html).not.toContain('90% range in')
    expect(html).not.toContain('Expected close')
    expect(html).not.toContain('Explore your forecast')
  })

  it.each([{ pending: true, error: null }, { pending: false, error: 'Unable to load prices.' }])(
    'hides the forecast controls when prices are unavailable (%o)', (state) => {
      const html = renderToStaticMarkup(createElement(PriceChart, { ...props, ...state, result: decisionFixtures.invest }))
      expect(html).not.toContain('Explore your forecast')
      expect(html).not.toContain('Estimated gain (USD)')
    },
  )
})
