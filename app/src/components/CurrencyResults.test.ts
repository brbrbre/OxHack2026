import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CurrencyProvider } from '../currency/CurrencyContext'
import { formatMoney } from '../currency/currency'
import type { CurrencyCode } from '../currency/currency'
import { buildPriceSeries } from '../lib/forecast'
import { buildPlanProjection } from '../lib/valueForecast'
import { decisionFixtures } from '../mocks/decisions'
import { planFixtures } from '../mocks/plan'
import { ForecastDetails } from './ChartPointDetails'
import DecisionCard from './DecisionCard'
import PlanResult from './PlanResult'
import ValueGrowthChart, { ValuePointDetails } from './ValueGrowthChart'

function inCurrency(child: ReactElement, currency: CurrencyCode) {
  return renderToStaticMarkup(createElement(CurrencyProvider, { initialCurrency: currency, children: child }))
}

function escaped(value: string) {
  return renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
}

describe('currency presentation of API results', () => {
  it.each(['MXN', 'GBP', 'EUR'] as const)('converts structured decision amounts to %s while keeping API prose verbatim', (currency) => {
    const result = structuredClone(decisionFixtures.waitRisk)
    const before = structuredClone(result)
    const html = inCurrency(createElement(DecisionCard, {
      result, pending: false, error: null, onRetry: () => {}, isDemo: false,
    }), currency)
    expect(html).toContain('Invest ' + formatMoney(455, currency) + ' now')
    expect(html).toContain('of your ' + formatMoney(1000, currency))
    expect(html).toContain('keep ' + formatMoney(545, currency) + ' for later')
    expect(html).toContain(formatMoney(-220, currency, true))
    for (const copy of [...result.razones, ...result.recomendaciones]) expect(html).toContain(escaped(copy))
    expect(html).toContain('Written explanations use USD; the amounts above use ' + currency)
    expect(result).toEqual(before)
  })

  it('converts cash, holding buttons and risk amounts without altering allocation weights or API summary', () => {
    const result = structuredClone(planFixtures.sample)
    const before = structuredClone(result)
    const html = inCurrency(createElement(PlanResult, {
      result, pending: false, error: null, onRetry: () => {}, active: false,
    }), 'GBP')
    expect(html).toContain('Invest ' + formatMoney(4500, 'GBP') + ' across 5 assets')
    expect(html).toContain('keep ' + formatMoney(500, 'GBP') + ' in cash')
    expect(html).toContain(formatMoney(900, 'GBP') + ' allocated')
    expect(html).toContain('style="width:18%"')
    expect(html).toContain('could lose about ' + formatMoney(Math.abs(result.numeros.peor_caso), 'GBP'))
    expect(html).toContain('<p>' + escaped(result.resumen) + '</p>')
    expect(html).toContain('Written explanations and the plan summary use USD')
    expect(result).toEqual(before)
  })

  it('formats chart summaries, accessible day selection and tooltips in the selected currency without changing projected USD values', () => {
    const projection = buildPlanProjection(planFixtures.sample)
    const before = structuredClone(projection)
    const endpoint = projection.points.at(-1)!
    const html = inCurrency(createElement(ValueGrowthChart, {
      projection, title: 'Total plan value', basis: 'Example plan', idPrefix: 'currency-chart',
    }), 'EUR')
    expect(html).toContain('Total plan value</h4><span>EUR</span>')
    expect(html).toContain('Initial value ' + formatMoney(projection.amount, 'EUR'))
    expect(html).toContain('estimated value ' + formatMoney(endpoint.value, 'EUR') + ', change ' + formatMoney(endpoint.gain, 'EUR', true))
    const tooltip = inCurrency(createElement(ValuePointDetails, { point: endpoint, days: projection.days }), 'EUR')
    expect(tooltip).toContain(formatMoney(endpoint.value, 'EUR'))
    expect(tooltip).toContain(formatMoney(endpoint.gain, 'EUR', true))
    expect(projection).toEqual(before)
  })

  it('changes forecast investment gains while keeping the asset quote in its native currency', () => {
    const result = structuredClone(decisionFixtures.invest)
    result.simbolo = 'WALMEX.MX'
    const { points, forecast } = buildPriceSeries({
      simbolo: result.simbolo, fechas: ['2026-10-22', '2026-10-23'], cierres: [98, 100],
    }, result.simbolo, result)
    const html = inCurrency(createElement(ForecastDetails, {
      point: points.at(-1)!, forecast: forecast!, symbol: result.simbolo,
    }), 'GBP')
    expect(html).toContain('Estimated gain (GBP)')
    expect(html).toContain(formatMoney(20, 'GBP', true))
    expect(html).toContain('On ' + formatMoney(1000, 'GBP') + ' suggested investment.')
    expect(html).toContain('MX$102.00')
    expect(html).not.toContain('£102.00')
  })
})
