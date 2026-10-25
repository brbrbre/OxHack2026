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
  it('keeps both entry paths and all choices available in the expanded setup form', () => {
    for (const mode of ['asset', 'plan'] as const) {
      const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode, stage: 'setup' }))
      expect(html).toContain('<h1 id="plan-heading">Your plan</h1>')
      expect(html).toContain('Start here')
      expect(html).toContain('value="5000"')
      expect(html).toContain('90 days')
      expect(html).toContain('Moderate')
      expect(html).toContain('name="planner-mode"')
      expect(html).toContain(mode === 'asset' ? 'Get my answer' : 'Build my plan')
    }
  })

  it('announces the first check while keeping its input values on screen', () => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'plan', stage: 'setup', pending: true }))
    expect(html).toContain('role="status">Comparing your asset types. Your plan will appear here.')
    expect(html).toContain('value="5000"')
    expect(html).toContain('type="submit" disabled=""')
  })

  it.each([1, 37, 60])('uses a continuous one-day-step slider at %s days in the quick form', (days) => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'asset',
      draft: { ...props.draft, plazo_dias: days } }))
    const horizon = Array.from(html.matchAll(/<input\b[^>]*>/g), ([match]) => match)
      .find((markup) => markup.includes('name="horizon"'))
    expect(horizon).toContain('type="range"')
    expect(horizon).toContain('min="1" max="60" step="1"')
    expect(horizon).toContain('value="' + days + '"')
    expect(horizon).toContain('aria-valuetext="' + days + (days === 1 ? ' day"' : ' days"'))
  })

  it('keeps a saved longer horizon exact until the user chooses to replace it', () => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'asset' }))
    expect(html).toContain('Saved duration')
    expect(html).toContain('type="hidden" name="horizon" value="90"')
    expect(html).toContain('Choose a duration from 1 to 60 days')
    expect(html).not.toContain('type="range"')
  })

  it('keeps the legacy single asset selected while allowing more assets to be added', () => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'asset' }))
    expect(html).toContain('I have assets in mind')
    expect(html).toContain('Help me choose')
    expect(html).toContain('id="asset"')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('S&amp;P 500 (SPDR)</strong><small>SPY</small>')
    expect(html).toContain('name="selected-assets" value="SPY"')
    expect(html).toContain('aria-label="Remove S&amp;P 500 (SPDR) (SPY)"')
    expect(html).toContain('Search again to add another asset.')
    expect(html).not.toContain('id="asset-types"')
  })

  it('explains the selected-only plan before submitting multiple assets', () => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, {
      ...props, mode: 'asset', draft: { ...props.draft, simbolos: ['SPY', 'GLD'] },
    }))
    expect(html).toContain('name="selected-assets" value="SPY"')
    expect(html).toContain('name="selected-assets" value="GLD"')
    expect(html).toContain('Selected assets: 2')
    expect(html).toContain('Horizon will build a plan using only your selected assets. Amounts may differ, and some money may stay in cash.')
    expect(html.indexOf('Selected assets: 2')).toBeLessThan(html.indexOf('type="submit"'))
    expect(html).not.toContain('split equally')
    expect(html).not.toContain('type="submit" disabled=""')
  })

  it('waits for an asset when the user removes every selection without blocking Help me choose', () => {
    const draft = { ...props.draft, simbolos: [], simbolo: '' }
    const manual = renderToStaticMarkup(createElement(InvestmentForm, { ...props, draft, mode: 'asset' }))
    expect(manual).toContain('Choose at least one asset.')
    expect(manual).toContain('role="combobox"')
    expect(manual).toContain('type="submit" disabled=""')
    const automatic = renderToStaticMarkup(createElement(InvestmentForm, { ...props, draft, mode: 'plan' }))
    expect(automatic).not.toContain('type="submit" disabled=""')
  })

  it('uses exact API group keys as checkboxes in the plan form', () => {
    const html = renderToStaticMarkup(createElement(InvestmentForm, { ...props, mode: 'plan' }))
    expect(html).not.toContain('role="combobox"')
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
