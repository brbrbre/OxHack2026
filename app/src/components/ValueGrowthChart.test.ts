import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ValueProjection } from '../lib/valueForecast'
import { buildHoldingProjection, buildPlanProjection } from '../lib/valueForecast'
import { planFixtures } from '../mocks/plan'
import { decisionFixtures } from '../mocks/decisions'
import ValueGrowthChart, { ValuePointDetails } from './ValueGrowthChart'

function planProjection(days = 90) {
  const plan = structuredClone(planFixtures.sample)
  plan.numeros = { ...plan.numeros, monto: 5000, invertido: 4000, plazo_dias: days,
    rendimiento_esperado: 0.04, peor_caso: -250 }
  plan.efectivo = 1000
  return buildPlanProjection(plan)
}

function render(projection: ValueProjection) {
  const before = structuredClone(projection)
  const html = renderToStaticMarkup(createElement(ValueGrowthChart, {
    projection, title: 'Total plan value', basis: 'Your $5,000 budget · $1,000 kept in cash', idPrefix: 'test-plan',
  }))
  expect(projection).toEqual(before)
  return html
}

describe('portfolio value chart presentation', () => {
  it('shows the complete plan value and gain with cash already included', () => {
    const html = render(planProjection())
    expect(html).toContain('Total plan value')
    expect(html).toContain('Initial value $5,000. Expected value $5,200 after 90 days. Values in US dollars.')
    expect(html).toContain('Estimated value</span><strong>$5,200</strong>')
    expect(html).toContain('+$200')
    expect(html).toContain('(+4%)')
    expect(html).toContain('Your $5,000 budget · $1,000 kept in cash')
    expect(html).toContain('Cash is included and stays unchanged.')
    expect(html).not.toContain('$6,200')
    expect(html).not.toContain('$5,160')
  })

  it.each([7, 90, 365, 730])('offers every calendar day from zero to the %s-day endpoint', (days) => {
    const html = render(planProjection(days))
    const slider = html.match(/<input\b[^>]*type="range"[^>]*>/)?.[0]
    expect(slider).toBeDefined()
    expect(slider).toContain('min="0"')
    expect(slider).toContain('max="' + days + '"')
    expect(slider).toContain('step="1"')
    expect(slider).toContain('value="' + days + '"')
    expect(slider).toContain('aria-valuetext="Day ' + days + ' of ' + days + ', estimated value $5,200, change +$200"')
    expect(html).toContain('Total plan value: choose a day')
    expect(html).toContain('Approximate daily path from the final estimate.')
  })

  it('keeps an all-cash projection flat with zero change rather than suggesting investment gains', () => {
    const html = render(buildPlanProjection(planFixtures.allCash))
    expect(html).toContain('Initial value $5,000. Expected value $5,000 after 90 days.')
    expect(html).toContain('Estimated value</span><strong>$5,000</strong>')
    expect(html).toContain('$0 <span>(0%)</span>')
    expect(html).toContain('Cash is included and stays unchanged.')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('+$0')
  })

  it('presents falling expected value as a negative monetary and percentage change', () => {
    const plan = structuredClone(planFixtures.sample)
    plan.numeros.rendimiento_esperado = -0.06
    const html = render(buildPlanProjection(plan))
    expect(html).toContain('Expected value $4,700 after 90 days.')
    expect(html).toContain('-$300')
    expect(html).toContain('(-6%)')
    expect(html).not.toContain('+$300')
  })

  it('shows only the supplied lower scenario for a portfolio, without an invented upper range', () => {
    const html = render(planProjection())
    expect(html).toContain('Lower scenario')
    expect(html.replace(/\s+/g, ' ')).toContain('Lower scenario at day 90: $4,750')
    expect(html).not.toContain('Estimated range')
    expect(html).not.toContain('Estimated value range')
    expect(html).not.toContain('90%')
  })

  it('can show both endpoints when an individual holding actually has a supplied range', () => {
    const plan = structuredClone(planFixtures.sample)
    const holding = plan.cartera[0]
    const analysis = structuredClone(decisionFixtures.invest)
    analysis.simbolo = holding.simbolo
    analysis.numeros.monto = holding.monto
    analysis.numeros.plazo_dias = plan.numeros.plazo_dias
    analysis.numeros.perfil = plan.numeros.perfil
    analysis.numeros.peor_caso = -45
    analysis.numeros.mejor_caso = 85
    const projection = buildHoldingProjection(holding, plan, analysis)!
    const html = render(projection)
    expect(html).toContain('Estimated range')
    expect(html.replace(/\s+/g, ' ')).toContain('Estimated value range at day 90: $855 to $985')
    expect(html).not.toContain('Lower scenario')
  })

  it('marks an intermediate tooltip as an approximation while retaining its value and gain', () => {
    const projection = planProjection()
    const html = renderToStaticMarkup(createElement(ValuePointDetails, { point: projection.points[45], days: 90 }))
    expect(html).toContain('Day 45 of 90')
    expect(html).toContain('$5,100')
    expect(html).toContain('+$100')
    expect(html).toContain('(+2%)')
    expect(html).toContain('Approximate path')
    const endpoint = renderToStaticMarkup(createElement(ValuePointDetails, { point: projection.points[90], days: 90 }))
    expect(endpoint).not.toContain('Approximate path')
  })
})
