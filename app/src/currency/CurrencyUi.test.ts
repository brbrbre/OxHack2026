import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { decisionFixtures } from '../mocks/decisions'
import { planFixtures } from '../mocks/plan'
import DecisionCard from '../components/DecisionCard'
import PlanResult from '../components/PlanResult'
import CurrencyAmountInput from './CurrencyAmountInput'
import { CurrencyProvider } from './CurrencyContext'
import { formatLocalAmount, formatMoney, toUsd } from './currency'
import type { CurrencyCode } from './currency'

function render(child: ReactElement, currency: CurrencyCode = 'USD') {
  return renderToStaticMarkup(createElement(CurrencyProvider, { initialCurrency: currency, children: child }))
}

function inputValue(html: string): string {
  return html.match(/<input[^>]*name="amount"[^>]*value="([^"]*)"/)![1]
}

function escaped(value: string): string {
  return renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
}

describe('budget currency control', () => {
  it('keeps an existing USD input format and provides four labelled currency choices', () => {
    const html = renderToStaticMarkup(createElement(CurrencyAmountInput, {
      value: '5275.50', onChange: () => {}, hintId: 'budget-hint',
    }))
    expect(inputValue(html)).toBe('5275.50')
    expect(html).toContain('aria-describedby="budget-hint"')
    expect(html).toContain('aria-label="Budget currency"')
    expect(html.match(/<option\b/g)).toHaveLength(4)
    for (const code of ['USD', 'MXN', 'GBP', 'EUR']) expect(html).toContain('value="' + code + '"')
    expect(html).toContain('Your total budget in US dollars.')
    expect(html).not.toContain('Demo FX')
  })

  it.each(['MXN', 'GBP', 'EUR'] as const)('renders the USD budget in %s with a dated reference and USD equivalent', (currency) => {
    const html = render(createElement(CurrencyAmountInput, {
      value: '1000', onChange: () => {}, hintId: 'budget-hint',
    }), currency)
    expect(inputValue(html)).toBe(formatLocalAmount(1000, currency))
    expect(html).toContain('selected=""')
    expect(html).toContain('$1,000')
    expect(html).toContain('Demo FX · ECB, 23 Oct 2026')
    expect(html).toContain('Fixed reference rates, not live quotes.')
    expect(html).toContain('https://www.ecb.europa.eu/')
    expect(html).toContain('2026-10-23')
  })

  it.each(['USD', 'MXN', 'GBP', 'EUR'] as const)('keeps an empty %s budget empty and required', (currency) => {
    const html = render(createElement(CurrencyAmountInput, {
      value: '', onChange: () => {}, hintId: 'budget-hint',
    }), currency)
    expect(inputValue(html)).toBe('')
    expect(html).toContain('required=""')
    expect(html).not.toContain('≈')
  })

  it.each(['USD', 'MXN', 'GBP', 'EUR'] as const)('allows the displayed USD maximum in %s without a step mismatch', (currency) => {
    const html = render(createElement(CurrencyAmountInput, {
      value: '1000000000', onChange: () => {}, hintId: 'budget-hint',
    }), currency)
    const max = Number(html.match(/<input[^>]*max="([^"]*)"/)![1])
    expect(Number(inputValue(html))).toBeLessThanOrEqual(max)
    expect(html).toContain('step="any"')
  })

  it('preserves a one-cent peso budget as a positive USD input when returning to dollars', () => {
    const usd = toUsd(0.01, 'MXN')
    const html = render(createElement(CurrencyAmountInput, {
      value: String(usd), onChange: () => {}, hintId: 'budget-hint',
    }))
    expect(Number(inputValue(html))).toBeGreaterThan(0)
    expect(Number(inputValue(html))).toBeLessThan(0.01)
    expect(html).toContain('min="0"')
  })
})

describe('result currency presentation', () => {
  it.each(['MXN', 'GBP', 'EUR'] as const)('converts structured decision amounts to %s before rounding, leaving API text intact', (currency) => {
    const result = structuredClone(decisionFixtures.waitRisk)
    result.numeros.monto_sugerido = 455.49
    result.numeros.fraccion = 0.45549
    const before = structuredClone(result)
    const html = render(createElement(DecisionCard, {
      result, pending: false, error: null, onRetry: () => {}, isDemo: false,
    }), currency)
    expect(html).toContain('Suggested now: ' + escaped(formatMoney(455.49, currency)))
    const split = html.match(/<dl class="decision-money-split"[^>]*>([\s\S]*?)<\/dl>/)?.[1]
    expect(split).toBeDefined()
    expect(split).toContain('<dt>Suggested investment now</dt>')
    expect(split).toContain(escaped(formatMoney(455.49, currency)))
    expect(split).toContain('<dt>Keep uninvested for now</dt>')
    expect(split).toContain(escaped(formatMoney(544.51, currency)))
    expect(html).toContain('How your ' + escaped(formatMoney(result.numeros.monto, currency)) + ' is split')
    expect(html).toContain('These amounts come from your budget. They are not profits.')
    expect(html).toContain('The gain and loss estimates below use the full ' + escaped(formatMoney(result.numeros.monto, currency))
      + ' over 30 days, not just the suggested ' + escaped(formatMoney(455.49, currency)) + '.')
    expect(html).toContain(formatMoney(result.numeros.peor_caso, currency, true))
    for (const text of [...result.razones, ...result.recomendaciones]) expect(html).toContain(escaped(text))
    expect(html).toContain('Written explanations use USD; the amounts above use ' + currency + '.')
    expect(result).toEqual(before)
  })

  it('retains the whole-dollar USD headline and does not turn a sub-dollar investment into Keep', () => {
    const partial = structuredClone(decisionFixtures.waitRisk)
    partial.numeros.monto_sugerido = 455.49
    const partialHtml = render(createElement(DecisionCard, {
      result: partial, pending: false, error: null, onRetry: () => {}, isDemo: false,
    }))
    expect(partialHtml).toContain('>Suggested now: $455</h2>')
    const partialSplit = partialHtml.match(/<dl class="decision-money-split"[^>]*>([\s\S]*?)<\/dl>/)?.[1]
    expect(partialSplit).toContain('$455.49')
    expect(partialSplit).toContain('$544.51')
    const small = structuredClone(decisionFixtures.invest)
    small.numeros.monto = 0.42
    small.numeros.monto_sugerido = 0.42
    const smallHtml = render(createElement(DecisionCard, {
      result: small, pending: false, error: null, onRetry: () => {}, isDemo: false,
    }))
    expect(smallHtml).toContain('Invest the full $0.42 now')
    expect(smallHtml).toContain('<dt>Suggested investment now</dt><dd>$0.42</dd>')
    expect(smallHtml).toContain('<dt>Keep uninvested for now</dt><dd>$0</dd>')
  })

  it.each(['MXN', 'GBP', 'EUR'] as const)('keeps a sub-dollar partial suggestion visible in %s instead of classifying it as zero', (currency) => {
    const result = structuredClone(decisionFixtures.waitRisk)
    result.numeros.monto_sugerido = 0.4
    result.numeros.fraccion = 0.0004
    const html = render(createElement(DecisionCard, {
      result, pending: false, error: null, onRetry: () => {}, isDemo: false,
    }), currency)
    expect(html).toContain('>Suggested now: ' + escaped(formatMoney(0.4, currency)) + '</h2>')
    const split = html.match(/<dl class="decision-money-split"[^>]*>([\s\S]*?)<\/dl>/)?.[1]
    expect(split).toContain(escaped(formatMoney(0.4, currency)))
    expect(split).toContain(escaped(formatMoney(999.6, currency)))
    expect(html).not.toContain('>Keep your')
  })

  it('converts portfolio amounts while preserving disclosure defaults, weights and exclusion reasons', () => {
    const result = structuredClone(planFixtures.sample)
    const excluded = result.invertir.find((asset) => !result.cartera.some((holding) => holding.simbolo === asset.simbolo))!
    excluded.fuera_del_plan = 'Moves like another holding.'
    const before = structuredClone(result)
    const html = render(createElement(PlanResult, {
      result, pending: false, error: null, onRetry: () => {},
    }), 'GBP')
    expect(html).toContain('Invest ' + formatMoney(result.numeros.invertido, 'GBP') + ' across')
    expect(html).toContain('keep ' + formatMoney(result.efectivo, 'GBP') + ' in cash')
    expect(html).toContain('style="width:18%"')
    expect(html).toContain('<details class="allocation-details">')
    expect(html).toContain('<details class="plan-classification invest" open=""')
    expect(html).toContain('<details class="plan-classification wait" aria-labelledby=')
    expect(html).toContain('<details class="plan-classification not-now" aria-labelledby=')
    expect(html).toContain('Not in the plan: Moves like another holding.')
    expect(html).toContain(escaped(result.resumen))
    expect(html).toContain('Written explanations and the plan summary use USD; your allocation uses GBP.')
    expect(result).toEqual(before)
  })

  it.each([
    { result: decisionFixtures.invest, pending: false, error: null },
    { result: null, pending: true, error: null },
    { result: null, pending: false, error: 'Unavailable' },
    { result: null, pending: false, error: null },
  ])('associates each state with a supplied unique heading id', (state) => {
    const html = render(createElement(DecisionCard, {
      ...state, onRetry: () => {}, isDemo: false, headingId: 'selected-asset-heading',
    }))
    expect(html).toContain('aria-labelledby="selected-asset-heading"')
    expect(html).toContain('id="selected-asset-heading"')
    expect(html).not.toContain('id="outlook-heading"')
  })
})
