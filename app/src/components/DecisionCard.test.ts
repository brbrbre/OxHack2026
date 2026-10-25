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
    expect(html).toContain('>Invest $555 now</h2>')
    expect(html).toContain('of your $1,000')
    expect(html).toContain('keep $445 for later')
    expect(html).toContain('class="decision-badge wait">Wait</span>')
    expect(html).toContain('Estimated range on your full $1,000 over 30 days.')
    expect(html).toContain('-$220')
  })

  it('displays the supplied amount instead of deriving a new allocation', () => {
    // The HTTP parser validates financial consistency; presentation uses the API's money field.
    const result = structuredClone(decisionFixtures.waitRisk)
    result.numeros.fraccion = 0.5
    result.numeros.monto_sugerido = 612.34
    const html = render(result)
    expect(html).toContain('>Invest $612 now</h2>')
    expect(html).toContain('keep $388 for later')
  })

  it('rounds the headline to whole units without hiding a full or empty amount', () => {
    const almostAll = structuredClone(decisionFixtures.waitRisk)
    almostAll.numeros.fraccion = 0.9996
    almostAll.numeros.monto_sugerido = 999.6
    expect(render(almostAll)).toContain('>Invest the full $1,000 now</h2>')
    expect(render(almostAll)).not.toContain('allocation-breakdown')

    const cents = structuredClone(decisionFixtures.waitRisk)
    cents.numeros.fraccion = 0.39338
    cents.numeros.monto_sugerido = 393.38
    expect(render(cents)).toContain('>Invest $393 now</h2>')
    expect(render(cents)).toContain('keep $607 for later')

    const tiny = structuredClone(decisionFixtures.waitRisk)
    tiny.numeros.fraccion = 0.0004
    tiny.numeros.monto_sugerido = 0.4
    expect(render(tiny)).toContain('>Keep your $1,000 for now</h2>')
  })

  it('keeps the full budget when no investment is suggested', () => {
    const html = render(decisionFixtures.notNow)
    expect(html).toContain('>Keep your $1,000 for now</h2>')
    expect(html).toContain('class="decision-badge not-now">Not now</span>')
    expect(html).not.toContain('allocation-breakdown')
    expect(html).not.toContain('>Invest $0 now</h2>')
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
