import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PlanResponse } from '../api/types'
import { mockPlan, planFixtures } from '../mocks/plan'
import PlanResult from './PlanResult'

function text(value: string) {
  return renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
}

function render(result: PlanResponse | null, options: { pending?: boolean; error?: string | null } = {}) {
  const before = structuredClone(result)
  const html = renderToStaticMarkup(createElement(PlanResult, {
    result, pending: options.pending ?? false, error: options.error ?? null, onRetry: () => {},
  }))
  expect(result).toEqual(before)
  return html
}

describe('portfolio plan presentation', () => {
  it('leads with the API investment amount and keeps cash in the full-budget allocation', () => {
    const html = render(planFixtures.sample)
    expect(html).toContain('Invest $4,500 across 5 assets')
    expect(html).toContain('of your $5,000')
    expect(html).toContain('keep $500 in cash')
    expect(html).toContain('style="width:18%"')
    expect(html).toContain('class="allocation-segment allocation-cash" aria-hidden="true" style="width:10%"')
    expect(html).not.toContain('style="width:20%"')
    expect(html).toContain('<th scope="col">Asset</th>')
    expect(html).toContain('<th scope="col">Amount</th>')
    expect(html).toContain('<th scope="col">Weight</th>')
  })

  it('exposes every allocated name, percentage and amount through the bar and table', () => {
    const html = render(planFixtures.sample)
    expect(html).toContain('role="img" aria-label=')
    for (const asset of planFixtures.sample.cartera) {
      expect(html).toContain(text(asset.nombre + ' (' + asset.simbolo + '): 18%, $900'))
      expect(html).toContain('class="portfolio-asset-name">' + text(asset.nombre))
      expect(html).toContain('class="portfolio-asset-symbol">' + asset.simbolo)
    }
    expect(html).toContain('Cash: 10%, $500')
  })

  it('uses the budget rather than the invested amount when explaining portfolio loss', () => {
    const html = render(planFixtures.sample)
    expect(html).toContain('In a bad scenario this plan could lose about $321 (-6.4%). Your profile accepts up to 10%.')
    expect(html).not.toContain('(-7.1%)')
  })

  it('keeps each API candidate in its supplied decision group and preserves its reason', () => {
    const html = render(planFixtures.sample)
    expect(html).toContain('class="decision-badge invest">Invest')
    expect(html).toContain('class="decision-badge wait">Wait')
    expect(html).toContain('class="decision-badge not-now">Not now')
    for (const asset of [...planFixtures.sample.invertir, ...planFixtures.sample.esperar, ...planFixtures.sample.no_por_ahora]) {
      expect(html).toContain('class="candidate-symbol">' + asset.simbolo)
      expect(html).toContain('<p>' + text(asset.razon) + '</p>')
    }
  })

  it('shows the summary exactly as supplied and explains the baseline', () => {
    const html = render(planFixtures.sample)
    expect(html).toContain('<p>' + text(planFixtures.sample.resumen) + '</p>')
    expect(html).toContain('Prediction: baseline (3-year historical average)')
    expect(render({ ...planFixtures.sample, modelo: 'team-forecast-v2' })).toContain('Prediction: team-forecast-v2')
  })

  it('handles an all-cash plan without NaN, phantom holdings or a false loss', () => {
    const html = render(planFixtures.allCash)
    expect(html).toContain('Keep your $5,000 for now')
    expect(html).toContain('keep $5,000 in cash')
    expect(html).toContain('Cash: 100%, $5,000')
    expect(html).toContain('style="width:100%"')
    expect(html).toContain('In a bad scenario this plan could lose about $0 (0.0%).')
    expect(html.match(/No assets in this group\./g)).toHaveLength(2)
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Invest $0')
  })

  it('does not describe a positive lower estimate as a loss', () => {
    const result = structuredClone(planFixtures.sample)
    result.numeros.peor_caso = 100
    const html = render(result)
    expect(html).toContain(text("The model's lower estimate is +$100 (+2.0%). Your profile accepts up to 10%."))
    const riskSection = html.split('<section class="plan-risk"')[1].split('</section>')[0]
    expect(riskSection).not.toContain('could lose about')
  })

  it('keeps a zero-cash table row while omitting a zero-width cash segment', () => {
    const result = mockPlan({ monto: 5000, plazo_dias: 90, perfil: 'agresivo', tipos: ['ETFs', 'US stocks', 'Crypto'] })
    const html = render(result)
    expect(html).toContain('Cash: 0%, $0')
    expect(html).not.toContain('class="allocation-segment allocation-cash"')
    expect(html).toContain('class="portfolio-asset-name">Cash</span></td><td>$0</td><td>0%</td>')
  })

  it('uses the singular asset label for a one-holding plan', () => {
    const result = mockPlan({ monto: 1000, plazo_dias: 30, perfil: 'moderado', tipos: ['Crypto'] })
    expect(render(result)).toContain('Invest $400 across 1 asset')
  })

  it.each([-1e-12, 1e-12])('treats a floating point cash residual of %s as display zero', (cash) => {
    const result = mockPlan({ monto: 5000, plazo_dias: 90, perfil: 'agresivo', tipos: ['ETFs', 'US stocks', 'Crypto'] })
    result.efectivo = cash
    const html = render(result)
    expect(html).toContain('Cash: 0%, $0')
    expect(html).not.toContain('class="allocation-segment allocation-cash"')
    expect(html).not.toContain('-$0')
    expect(html).not.toContain('width:-')
    expect(result.efectivo).toBe(cash)
  })

  it.each([
    { result: null, options: {}, title: 'Not sure what to invest in?' },
    { result: null, options: { pending: true }, title: 'Checking…' },
    { result: null, options: { error: 'Service unavailable.' }, title: 'We could not build your plan.' },
    { result: planFixtures.sample, options: {}, title: 'Invest $4,500 across 5 assets' },
  ])('keeps a focusable result heading for $title', ({ result, options, title }) => {
    const html = render(result, options)
    expect(html).toMatch(/<h2[^>]*id="outlook-heading"[^>]*tabindex="-1"/)
    expect(html).toContain(title)
    if ('error' in options) {
      expect(html).toContain('Service unavailable.')
      expect(html).toContain('Try again')
    }
  })
})
