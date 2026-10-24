import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DecideResponse } from '../api/types'
import { buildPriceSeries } from '../lib/forecast'
import { decisionFixtures } from '../mocks/decisions'
import ChartPointDetails, { ForecastDetails } from './ChartPointDetails'

function example(result: DecideResponse = decisionFixtures.invest) {
  return buildPriceSeries({ simbolo: result.simbolo, fechas: ['2026-10-22', '2026-10-23'], cierres: [98, 100] }, result.simbolo, result)
}

describe('explorable forecast details', () => {
  it('shows the selected calendar date, return and gain on the suggested investment', () => {
    const { points, historyLength, forecast } = example()
    const html = renderToStaticMarkup(createElement(ForecastDetails, {
      point: points[historyLength - 1 + 15], forecast: forecast!, symbol: 'SPY',
    }))
    expect(html).toContain('7 Nov 2026')
    expect(html).toContain('Day 15 of 30')
    expect(html).toContain('+1%')
    expect(html).toContain('Estimated gain (USD)')
    expect(html).toContain('+$10')
    expect(html).toContain('On $1,000 suggested investment.')
    expect(html).not.toContain('Illustrative price range')
    expect(html).not.toContain('Approximation between')
    expect(html).not.toContain('90% price range')
  })

  it('uses the partial amount rather than the full budget for hypothetical gains', () => {
    const { points, historyLength, forecast } = example(decisionFixtures.waitRisk)
    const html = renderToStaticMarkup(createElement(ForecastDetails, {
      point: points[historyLength - 1 + 15], forecast: forecast!, symbol: 'ETHUSDT',
    }))
    expect(html).toContain('+$2.73')
    expect(html).toContain('On $455 suggested investment.')
    expect(html).not.toContain('+$6')
  })

  it('keeps small daily returns visible alongside their monetary estimate', () => {
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.plazo_dias = 90
    const { points, historyLength, forecast } = example(result)
    const html = renderToStaticMarkup(createElement(ForecastDetails, {
      point: points[historyLength], forecast: forecast!, symbol: 'SPY',
    }))
    expect(html).toContain('+0.02%')
    expect(html).toContain('+$0.22')
  })

  it('describes negative returns as a loss without adding range or method paragraphs to the summary', () => {
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.rendimiento_esperado = -0.018
    const { points, forecast } = example(result)
    const html = renderToStaticMarkup(createElement(ForecastDetails, {
      point: points.at(-1)!, forecast: forecast!, symbol: 'SPY',
    }))
    expect(html).toContain('Estimated loss (USD)')
    expect(html).toContain('-$18')
    expect(html).toContain('-1.8%')
    expect(html).not.toContain('90% price range')
    expect(html).not.toContain('$95.50 to $108.50')
    expect(html).not.toContain('Approximation between')
  })

  it('keeps an intermediate tooltip concise while identifying the estimate as approximate', () => {
    const { points, historyLength, forecast } = example()
    const html = renderToStaticMarkup(createElement(ChartPointDetails, {
      active: true, point: points[historyLength - 1 + 15], forecast, symbol: 'SPY',
    }))
    expect(html).toContain('7 Nov 2026')
    expect(html).toContain('Day 15')
    expect(html).not.toContain(' of 30')
    expect(html).toContain('+$10')
    expect(html).toContain('+1%')
    expect(html).toContain('$101.00')
    expect(html).toContain('On $1,000 suggested.')
    expect(html).toContain('Approximate estimate')
    expect(html).not.toContain('Illustrative price range')
    expect(html).not.toContain('90% price range')
    expect(html).not.toContain('straight-line')
    expect(html).not.toContain('Approximation between')
  })

  it('does not label the exact terminal API estimate as an intermediate approximation', () => {
    const { points, forecast } = example()
    const html = renderToStaticMarkup(createElement(ChartPointDetails, {
      active: true, point: points.at(-1), forecast, symbol: 'SPY',
    }))
    expect(html).toContain('22 Nov 2026')
    expect(html).toContain('Day 30')
    expect(html).toContain('+$20')
    expect(html).toContain('+2%')
    expect(html).not.toContain('Approximate estimate')
    expect(html).not.toContain('price range')
  })

  it('keeps a non-investment decision from displaying a misleading monetary gain', () => {
    const { points, forecast } = example(decisionFixtures.notNow)
    const html = renderToStaticMarkup(createElement(ForecastDetails, {
      point: points.at(-1)!, forecast: forecast!, symbol: 'NVDA',
    }))
    expect(html).toContain('No investment suggested')
    expect(html).toContain('-1.8%')
    expect(html).not.toContain('Estimated gain')
    expect(html).not.toContain('Estimated loss')
  })

  it('shows historical prices as history, without implying past hypothetical plan profits', () => {
    const { points, forecast } = example()
    const html = renderToStaticMarkup(createElement(ChartPointDetails, {
      active: true, point: points[0], forecast, symbol: 'SPY',
    }))
    expect(html).toContain('22 Oct 2026')
    expect(html).toContain('Historical close')
    expect(html).toContain('$98.00')
    expect(html).not.toContain('Expected return')
    expect(html).not.toContain('Estimated gain')
  })

  it('renders no tooltip when there is no active, valid point', () => {
    const { points, forecast } = example()
    expect(renderToStaticMarkup(createElement(ChartPointDetails, {
      active: false, point: points[0], forecast, symbol: 'SPY',
    }))).toBe('')
    expect(renderToStaticMarkup(createElement(ChartPointDetails, {
      active: true, forecast, symbol: 'SPY',
    }))).toBe('')
  })
})
