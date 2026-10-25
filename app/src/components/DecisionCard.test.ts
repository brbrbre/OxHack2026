import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DecideResponse } from '../api/types'
import { DECISION_LABELS, PROFILE_LABELS } from '../lib/labels'
import { decisionFixtures } from '../mocks/decisions'
import DecisionCard from './DecisionCard'

function render(result: DecideResponse | null, options: { pending?: boolean; error?: string | null } = {}) {
  const before = structuredClone(result)
  const html = renderToStaticMarkup(createElement(DecisionCard, {
    result, pending: options.pending ?? false, error: options.error ?? null,
    onRetry: () => {}, isDemo: false,
  }))
  expect(result).toEqual(before)
  return html
}

function capitalSplit(html: string) {
  const split = html.match(/<dl class="decision-money-split"[^>]*>([\s\S]*?)<\/dl>/)?.[1]
  expect(split, 'Expected a labelled split of the original budget').toBeDefined()
  function value(label: string) {
    const amount = split!.match(new RegExp('<dt>' + label + '<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>'))?.[1]
    expect(amount, label).toBeDefined()
    return amount!.replace(/<[^>]+>/g, '')
  }
  return { html: split!, suggested: value('Suggested investment now'), uninvested: value('Keep uninvested for now') }
}

describe('investment amount presentation', () => {
  it('keeps the API asset name and symbol together beside its decorative identity mark', () => {
    const result = { ...decisionFixtures.invest, nombre: 'API supplied asset name' }
    const html = render(result)
    const summary = html.split('<dl class="plan-summary">')[1].split('</dl>')[0]
    expect(summary).toContain('API supplied asset name')
    expect(summary).toContain('SPY')
    expect(summary).toContain('asset-name-row')
    expect(summary).toContain('aria-hidden="true"')
  })

  it('leads with the full suggested amount and keeps the decision in a separate badge', () => {
    const html = render(decisionFixtures.invest)
    expect(html).toContain('class="suggested-amount" tabindex="-1">Invest the full $1,000 now</h2>')
    expect(html).toContain('class="decision-badge invest">Invest</span>')
    expect(html).not.toContain('Your outlook suggests an opportunity.')
    expect(html).not.toContain('decision-symbol')
  })

  it('shows the partial amount and what remains for later', () => {
    const result = structuredClone(decisionFixtures.waitRisk)
    result.numeros.fraccion = 0.555
    result.numeros.monto_sugerido = 555
    const html = render(result)
    expect(html).toContain('>Suggested now: $555</h2>')
    expect(html).toContain('How your $1,000 is split')
    expect(capitalSplit(html)).toMatchObject({ suggested: '$555', uninvested: '$445' })
    expect(html).toContain('class="decision-badge wait">Wait</span>')
    expect(html).toContain('Estimated range on your full $1,000 over 30 days.')
    const reasons = html.split('<div class="reasons">')[1].split('</div>')[0]
    expect(reasons).toContain('The gain and loss estimates below use the full $1,000 over 30 days, not just the suggested $555.')
    expect(html).toContain('<dt>Investment period</dt><dd>30 days</dd>')
    expect(html).toContain('-$220')
  })

  it('explains that the $209 suggested and $791 uninvested are the original capital, separate from gains and losses', () => {
    const result = structuredClone(decisionFixtures.waitRisk)
    result.numeros.fraccion = 0.209
    result.numeros.monto_sugerido = 209
    result.numeros.peor_caso = -100
    result.numeros.mejor_caso = 200
    const html = render(result)
    const split = capitalSplit(html)
    expect(html).toContain('>Suggested now: $209</h2>')
    expect(split).toMatchObject({ suggested: '$209', uninvested: '$791' })
    const numeric = (value: string) => Number(value.replace(/[$,]/g, ''))
    expect(numeric(split.suggested) + numeric(split.uninvested)).toBe(result.numeros.monto)
    expect(html).toContain('These amounts come from your budget. They are not profits.')
    expect(split.html).not.toContain('-$100')
    expect(split.html).not.toContain('+$200')
    expect(html).toContain('-$100')
    expect(html).toContain('+$200')
    expect(html).toContain('The gain and loss estimates below use the full $1,000 over 30 days, not just the suggested $209.')
  })

  it('displays the supplied amount instead of deriving a new allocation', () => {
    // The HTTP parser validates financial consistency; presentation uses the API's money field.
    const result = structuredClone(decisionFixtures.waitRisk)
    result.numeros.fraccion = 0.5
    result.numeros.monto_sugerido = 612.34
    const html = render(result)
    expect(html).toContain('>Suggested now: $612</h2>')
    expect(capitalSplit(html)).toMatchObject({ suggested: '$612.34', uninvested: '$387.66' })
    expect(html).toContain('not just the suggested $612.34.')
  })

  it.each([
    { suggested: 999.6, headline: '$999.60', exact: '$999.60', uninvested: '$0.40' },
    { suggested: 393.38, headline: '$393', exact: '$393.38', uninvested: '$606.62' },
    { suggested: 0.4, headline: '$0.40', exact: '$0.40', uninvested: '$999.60' },
  ])('keeps the $suggested capital exact and avoids rounding a partial investment to full or zero', ({ suggested, headline, exact, uninvested }) => {
    const result = structuredClone(decisionFixtures.waitRisk)
    result.numeros.fraccion = suggested / result.numeros.monto
    result.numeros.monto_sugerido = suggested
    const html = render(result)
    expect(html).toContain('>Suggested now: ' + headline + '</h2>')
    expect(capitalSplit(html)).toMatchObject({ suggested: exact, uninvested })
    expect(html).toContain('These amounts come from your budget. They are not profits.')
    expect(html).toContain('not just the suggested ' + exact + '.')
    expect(html).not.toContain('>Keep your $1,000 for now</h2>')
  })

  it('keeps the full budget when no investment is suggested', () => {
    const html = render(decisionFixtures.notNow)
    expect(html).toContain('>Keep your $1,000 for now</h2>')
    expect(html).toContain('class="decision-badge not-now">Not now</span>')
    expect(capitalSplit(html)).toMatchObject({ suggested: '$0', uninvested: '$1,000' })
    expect(html).toContain('These amounts come from your budget. They are not profits.')
    expect(html).not.toContain('not just the suggested')
    expect(html).not.toContain('>Invest $0 now</h2>')
  })

  it('still shows both capital amounts when the full budget is suggested', () => {
    const html = render(decisionFixtures.invest)
    expect(capitalSplit(html)).toMatchObject({ suggested: '$1,000', uninvested: '$0' })
    expect(html).toContain('How your $1,000 is split')
    expect(html).toContain('These amounts come from your budget. They are not profits.')
    expect(html).not.toContain('not just the suggested')
  })

  it('keeps an Invest decision distinct from Wait without rounding a nearly full allocation up to full', () => {
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.monto_sugerido = 999.6
    result.numeros.fraccion = 0.9996
    const html = render(result)
    expect(html).toContain('>Invest $999.60 now</h2>')
    expect(html).toContain('class="decision-badge invest">Invest</span>')
    expect(html).not.toContain('Invest the full')
    expect(capitalSplit(html)).toMatchObject({ suggested: '$999.60', uninvested: '$0.40' })
  })

  it('keeps a whole-dollar headline for a split budget while showing its precise amount below', () => {
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.monto = 333.34
    result.numeros.monto_sugerido = 333.34
    const html = render(result)
    expect(html).toContain('>Invest the full $333 now</h2>')
    expect(html).toContain('<dd>$333.34</dd>')
    expect(capitalSplit(html)).toMatchObject({ suggested: '$333.34', uninvested: '$0' })
  })

  it('uses centralized English labels while leaving Spanish codes unchanged', () => {
    expect(DECISION_LABELS).toEqual({ INVERTIR: 'Invest', ESPERAR: 'Wait', NO_POR_AHORA: 'Not now' })
    expect(PROFILE_LABELS).toEqual({ conservador: 'Conservative', moderado: 'Moderate', agresivo: 'Aggressive' })
    expect(decisionFixtures.invest.decision).toBe('INVERTIR')
    expect(decisionFixtures.invest.numeros.perfil).toBe('moderado')
    expect(render(decisionFixtures.invest)).toContain('Moderate')
  })

  it('preserves API reasons and recommendations without success checkmarks', () => {
    const result = decisionFixtures.waitRisk
    const html = render(result)
    for (const copy of [...result.razones, ...result.recomendaciones]) expect(html).toContain(copy)
    expect(html).not.toContain('reason-check')
    expect(html).not.toContain('lucide-check')
    expect(html).toContain('<li>' + result.razones[0] + '</li>')
  })

  it('describes the baseline and preserves any other model name', () => {
    expect(render(decisionFixtures.invest)).toContain('Prediction: baseline (3-year historical average)')
    const result = { ...decisionFixtures.invest, modelo: 'team-forecast-v2' }
    expect(render(result)).toContain('Prediction: team-forecast-v2')
    expect(render(result)).not.toContain('3-year historical average')
  })

  it('explains volatility using the actual response horizon', () => {
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.plazo_dias = 90
    result.numeros.volatilidad = 0.126
    const html = render(result)
    expect(html).toContain('Typical move in 90 days:')
    expect(html).toContain('±12.6%')
    expect(html).not.toContain('>Volatility<')
  })

  it.each([
    { result: null, options: {}, title: 'Ready to check your next plan?' },
    { result: null, options: { pending: true }, title: 'Checking…' },
    { result: null, options: { error: 'Service unavailable.' }, title: 'We couldn&#x27;t get your answer.' },
    { result: decisionFixtures.invest, options: {}, title: 'Invest the full $1,000 now' },
  ])('keeps a focusable result heading for each state: $title', ({ result, options, title }) => {
    const html = render(result, options)
    expect(html).toMatch(/<h2 id="outlook-heading"[^>]*tabindex="-1"/)
    expect(html).toContain(title)
  })
})
