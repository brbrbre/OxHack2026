import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import GuidedPlanner from '../components/GuidedPlanner'
import type { GuidedPlannerProps } from '../components/GuidedPlanner'
import InvestmentForm from '../components/InvestmentForm'
import { assets } from '../mocks/assets'
import CurrencyAmountInput from './CurrencyAmountInput'
import { CurrencyProvider, useCurrency } from './CurrencyContext'
import type { CurrencyCode } from './currency'
import { formatLocalAmount, formatMoney, toUsd } from './currency'
import { ECB_REFERENCE_RATES } from './referenceRates'

function renderInCurrency(element: ReactElement, currency: CurrencyCode) {
  return renderToStaticMarkup(createElement(CurrencyProvider, { initialCurrency: currency, children: element }))
}

function amountInput(html: string) {
  const input = Array.from(html.matchAll(/<input\b[^>]*>/g), ([match]) => match)
    .find((markup) => markup.includes('name="amount"'))
  expect(input).toBeDefined()
  return input!
}

const guidedProps: GuidedPlannerProps = {
  assets,
  draft: { simbolo: 'SPY', monto: '1000', plazo_dias: 90, perfil: 'moderado', tipos: ['ETFs'] },
  mode: 'plan', step: 0, pending: false, unavailable: false, typesError: null,
  onChange: () => {}, onModeChange: () => {}, onSubmit: () => {}, onStepChange: () => {},
  onChooseDifferent: () => {}, onUseQuick: () => {},
}

describe('budget currency input', () => {
  it.each([
    ['USD', '1000'], ['MXN', '18781.92'], ['GBP', '748.04'], ['EUR', '893.42'],
  ] as const)('presents the canonical USD budget as an editable local amount in %s', (currency, local) => {
    const onChange = vi.fn()
    const html = renderInCurrency(createElement(CurrencyAmountInput, {
      value: '1000', onChange, hintId: 'budget-hint',
    }), currency)
    expect(amountInput(html)).toContain('value="' + local + '"')
    expect(amountInput(html)).toContain('aria-describedby="budget-hint"')
    expect(html).toContain('id="budget-hint"')
    expect(html).toContain('aria-label="Budget currency"')
    const options = Array.from(html.matchAll(/<option\b[^>]*>/g), ([match]) => match)
    expect(options).toHaveLength(4)
    expect(options.map((option) => option.match(/value="([^"]+)"/)?.[1]))
      .toEqual(['USD', 'MXN', 'GBP', 'EUR'])
    expect(options.find((option) => option.includes('value="' + currency + '"'))).toContain('selected=""')
    expect(onChange).not.toHaveBeenCalled()
  })

  it.each(['MXN', 'GBP', 'EUR'] as const)('makes the USD base and fixed reference date discoverable in %s', (currency) => {
    const html = renderInCurrency(createElement(CurrencyAmountInput, {
      value: '1000', onChange: () => {}, hintId: 'budget-hint',
    }), currency)
    expect(html).toContain('≈ $1,000 USD')
    expect(html).toContain('Demo FX · ECB, 23 Oct 2026')
    expect(html).toContain('Fixed reference rates, not live quotes.')
    expect(html).toContain('Estimates are calculated in USD; changing currency keeps the same budget.')
    expect(html).toContain(ECB_REFERENCE_RATES.date)
    expect(html).toContain('href="' + ECB_REFERENCE_RATES.sourceUrl + '"')
  })

  it('preserves the previous USD input value and display without a provider', () => {
    const html = renderToStaticMarkup(createElement(CurrencyAmountInput, {
      value: '5275.50', onChange: () => {}, hintId: 'amount-hint',
    }))
    expect(amountInput(html)).toContain('value="5275.50"')
    expect(html).toContain('Your total budget in US dollars.')
    expect(html).not.toContain('Demo FX')
    expect(html).not.toContain('≈')
  })

  it('preserves an empty draft instead of presenting zero or a fabricated USD equivalent', () => {
    const html = renderInCurrency(createElement(CurrencyAmountInput, {
      value: '', onChange: () => {}, hintId: 'amount-hint',
    }), 'MXN')
    expect(amountInput(html)).toContain('value=""')
    expect(html).not.toContain('≈')
    expect(html).not.toContain('NaN')
  })

  it.each(['USD', 'MXN', 'GBP', 'EUR'] as const)('keeps the valid maximum USD budget within the local input bounds in %s', (currency) => {
    const html = renderInCurrency(createElement(CurrencyAmountInput, {
      value: '1000000000', onChange: () => {}, hintId: 'amount-hint',
    }), currency)
    const input = amountInput(html)
    const amount = Number(input.match(/\bvalue="([^"]+)"/)?.[1])
    const max = Number(input.match(/\bmax="([^"]+)"/)?.[1])
    expect(amount).toBeLessThanOrEqual(max)
    expect(input).toContain('min="0"')
    expect(input).toContain('step="any"')
  })

  it('keeps a tiny peso budget positive and editable when displayed as USD', () => {
    const canonicalUsd = toUsd(0.01, 'MXN')
    const html = renderInCurrency(createElement(CurrencyAmountInput, {
      value: String(canonicalUsd), onChange: () => {}, hintId: 'amount-hint',
    }), 'USD')
    const input = amountInput(html)
    const amount = Number(input.match(/\bvalue="([^"]+)"/)?.[1])
    expect(amount).toBeGreaterThan(0)
    expect(amount).toBeLessThan(0.01)
    expect(input).toContain('min="0"')
    expect(input).toContain('step="any"')
  })

  it('uses the same converted budget control in the quick and guided forms', () => {
    const before = structuredClone(guidedProps.draft)
    const quick = renderInCurrency(createElement(InvestmentForm, {
      assets, draft: guidedProps.draft, onChange: () => {}, onSubmit: () => {},
      onModeChange: () => {}, pending: false, isDemo: false, unavailable: false,
      typesError: null, mode: 'plan',
    }), 'GBP')
    const guided = renderInCurrency(createElement(GuidedPlanner, guidedProps), 'GBP')
    for (const html of [quick, guided]) {
      expect(amountInput(html)).toContain('value="748.04"')
      expect(html).toContain('≈ $1,000 USD')
    }
    expect(guidedProps.draft).toEqual(before)
  })
})

describe('shared budget currency presentation', () => {
  it.each(['USD', 'MXN', 'GBP', 'EUR'] as const)('shows the guided review in %s without modifying its USD draft', (currency) => {
    const draft = { ...guidedProps.draft, monto: '5275.50' }
    const before = structuredClone(draft)
    const html = renderInCurrency(createElement(GuidedPlanner, { ...guidedProps, draft, step: 3 }), currency)
    expect(html).toContain('<dt>Budget</dt><dd>' + formatMoney(5275.5, currency) + '</dd>')
    expect(html).toContain('3 months (90 days)')
    expect(html).toContain('Moderate')
    expect(draft).toEqual(before)
  })

  it('keeps full-precision USD as the source rather than feeding a rounded local display into the next conversion', () => {
    const usd = '53.24270120727217'
    for (const currency of ['MXN', 'GBP', 'EUR'] as const) {
      const html = renderInCurrency(createElement(CurrencyAmountInput, {
        value: usd, onChange: () => {}, hintId: 'amount-hint',
      }), currency)
      expect(amountInput(html)).toContain('value="' + formatLocalAmount(Number(usd), currency) + '"')
    }
  })

  it('defaults existing monetary consumers outside the provider to USD', () => {
    function Consumer() {
      const { currency, money } = useCurrency()
      return createElement('output', { 'data-currency': currency }, money(1000))
    }
    expect(renderToStaticMarkup(createElement(Consumer))).toBe('<output data-currency="USD">$1,000</output>')
  })
})
