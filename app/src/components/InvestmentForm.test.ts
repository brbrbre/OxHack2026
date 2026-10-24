import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { assets } from '../mocks/assets'
import InvestmentForm from './InvestmentForm'

const props = {
  assets,
  draft: { simbolo: 'SPY', monto: '5000', plazo_dias: 90, perfil: 'moderado' as const, tipos: ['ETFs', 'US stocks', 'Crypto'] },
  onChange: () => {}, onSubmit: () => {}, onModeChange: () => {},
  pending: false, isDemo: false, unavailable: false, typesError: null,
}

describe('investment planner modes', () => {
  it('keeps the single-asset form and its grouped catalogue', () => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'asset' }))
    expect(html).toContain('I have an asset in mind')
    expect(html).toContain('Help me choose')
    expect(html).toContain('<select id="asset"')
    expect(html).toContain('HSBA.L')
    expect(html).not.toContain('id="asset-types"')
  })

  it('uses exact API group keys as checkboxes in the plan form', () => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'plan' }))
    expect(html).not.toContain('<select id="asset"')
    expect(html.match(/type="checkbox"/g)).toHaveLength(7)
    for (const group of Object.keys(assets)) expect(html).toContain('value="' + group + '"')
    expect(html).toContain('Build my plan')
    expect(html).toContain('value="5000"')
    expect(html).toContain('name="horizon"')
    expect(html).toContain('value="moderado"')
  })

  it('shows the server type error beside its selector and associates it with the fieldset', () => {
    const message = 'Unknown asset types: Bonds'
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'plan', typesError: message }))
    expect(html).toContain('aria-describedby="asset-types-hint asset-types-error"')
    expect(html).toContain('id="asset-types-error" role="alert">' + message)
    expect(html).toContain('aria-invalid="true"')
  })

  it('disables submission while checking without disabling the mode switch', () => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'plan', pending: true }))
    expect(html).toContain('type="submit" disabled=""')
    expect(html).toContain('Checking…')
    expect(html).not.toMatch(/name="planner-mode"[^>]*disabled/)
  })

  it('shows a useful empty-catalogue state while preserving amount, time and risk inputs', () => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'plan', assets: null }))
    expect(html).toContain('Loading asset types…')
    expect(html).toContain('id="amount"')
    expect(html).toContain('What is your time horizon?')
    expect(html).toContain('How do you feel about risk?')
    expect(html).toContain('type="submit" disabled=""')
  })
})
