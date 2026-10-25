import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { assets } from '../mocks/assets'
import GuidedPlanner from './GuidedPlanner'
import type { GuidedPlannerProps, GuidedStep } from './GuidedPlanner'

const props: GuidedPlannerProps = {
  assets,
  draft: { simbolo: 'AAPL', monto: '5275.50', plazo_dias: 90, perfil: 'moderado', tipos: ['ETFs', 'US stocks', 'Crypto'] },
  mode: 'plan', step: 0, pending: false, unavailable: false, typesError: null,
  onChange: () => {}, onModeChange: () => {}, onSubmit: () => {}, onStepChange: () => {},
  onChooseDifferent: () => {}, onUseQuick: () => {},
}

function render(changes: Partial<GuidedPlannerProps> = {}) {
  const input = { ...props, ...changes }
  const draft = structuredClone(input.draft)
  const html = renderToStaticMarkup(createElement(GuidedPlanner, input))
  expect(input.draft).toEqual(draft)
  return html
}

function button(html: string, text: string) {
  const found = Array.from(html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g), ([match]) => match)
    .find((markup) => markup.replace(/<[^>]+>/g, '').trim() === text)
  expect(found, 'Expected a button labelled ' + text).toBeDefined()
  return found!
}

function inputs(html: string, name: string) {
  return Array.from(html.matchAll(/<input\b[^>]*>/g), ([match]) => match)
    .filter((markup) => markup.includes('name="' + name + '"'))
}

describe('guided planner', () => {
  it.each([
    { step: 0, question: 'How much would you like to explore investing?', control: 'id="amount"' },
    { step: 1, question: 'How long would you leave it invested?', control: 'name="horizon"' },
    { step: 2, question: 'How do you feel about ups and downs?', control: 'name="risk"' },
    { step: 3, question: 'Does this look like your plan?', control: 'name="planner-mode"' },
  ] as const)('shows only the current question at step $step', ({ step, question, control }) => {
    const html = render({ step })
    expect(html.match(/<h2\b/g)).toHaveLength(1)
    expect(html).toContain('id="guided-question-heading" tabindex="-1">' + question)
    expect(html).toContain('Step ' + (step + 1) + ' of 4')
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html).toContain(control)
    for (const other of ['id="amount"', 'name="horizon"', 'name="risk"', 'name="planner-mode"']) {
      if (other !== control) expect(html).not.toContain(other)
    }
    expect(button(html, step === 3 ? 'See my plan' : 'Continue')).toContain('type="submit"')
    expect(button(html, 'Back')).toContain('type="button"')
  })

  it('keeps native amount validation and a decimal keyboard on the budget step', () => {
    const html = render()
    expect(html).toMatch(/id="amount"[^>]*type="number"[^>]*inputMode="decimal"[^>]*min="0"[^>]*max="1000000000"[^>]*step="any"[^>]*required=""/)
    expect(html).toContain('value="5275.50"')
    expect(html).toContain('aria-describedby="guided-amount-hint"')
    expect(html).toContain('aria-label="Budget currency"')
    for (const code of ['USD', 'MXN', 'GBP', 'EUR']) expect(html).toContain('value="' + code + '"')
  })

  it.each([1, 37, 60])('offers every day through the native slider at %s days', (days) => {
    const html = render({ step: 1, draft: { ...props.draft, plazo_dias: days } })
    const horizon = inputs(html, 'horizon')
    expect(horizon).toHaveLength(1)
    expect(horizon[0]).toContain('type="range"')
    expect(horizon[0]).toContain('min="1" max="60" step="1"')
    expect(horizon[0]).toContain('value="' + days + '"')
    expect(horizon[0]).toContain('aria-valuetext="' + days + (days === 1 ? ' day"' : ' days"'))
  })

  it('retains a saved longer duration when returning to the guided time step', () => {
    const html = render({ step: 1 })
    expect(inputs(html, 'horizon')[0]).toContain('type="hidden"')
    expect(inputs(html, 'horizon')[0]).toContain('value="90"')
    expect(html).toContain('Choose a duration from 1 to 60 days')
    expect(html).not.toContain('type="range"')
  })

  it('describes risk in plain language without changing the submitted profile codes', () => {
    const html = render({ step: 2 })
    const values = inputs(html, 'risk').map((markup) => markup.match(/value="([^"]+)"/)?.[1])
    expect(values).toEqual(['conservador', 'moderado', 'agresivo'])
    for (const phrase of ['I prefer smaller ups and downs', 'I’m comfortable with some ups and downs', 'I’m comfortable with larger ups and downs']) {
      expect(html).toContain(phrase)
    }
    for (const label of ['Conservative', 'Moderate', 'Aggressive']) expect(html).toContain(label)
    expect(inputs(html, 'risk').find((markup) => markup.includes('value="moderado"'))).toContain('checked=""')
  })

  it('reviews the shared budget, horizon and risk before a request is submitted', () => {
    const html = render({ step: 3 })
    expect(html).toContain('$5,275.50')
    expect(html).toContain('<dt>Time invested</dt><dd>90 days</dd>')
    expect(html).toContain('<dt>Comfort with risk</dt><dd>Moderate</dd>')
    expect(html).toContain('Help me explore')
    expect(html).toContain('I have something in mind')
  })

  it.each([1, 37, 60, 90, 180, 365])('reviews %s days without relying on a fixed duration-name map', (days) => {
    const html = render({ step: 3, draft: { ...props.draft, plazo_dias: days } })
    expect(html).toContain('<dt>Time invested</dt><dd>' + days + (days === 1 ? ' day</dd>' : ' days</dd>'))
    expect(html).not.toContain('undefined')
  })

  it('uses the API catalogue name and keeps the legacy single asset selected in review', () => {
    const html = render({ step: 3, mode: 'asset', assets: {
      'US stocks': [{ simbolo: 'AAPL', nombre: 'Apple from the API' }, { simbolo: 'NVDA', nombre: 'NVIDIA' }],
    } })
    expect(html.match(/role="combobox"/g)).toHaveLength(1)
    expect(html).toContain('Apple from the API</strong><small>AAPL</small>')
    expect(html).toContain('name="selected-assets" value="AAPL"')
    expect(html).not.toContain('id="asset-types"')
  })

  it('reviews the selected-only plan before submitting multiple assets', () => {
    const html = render({ step: 3, mode: 'asset', draft: { ...props.draft, simbolos: ['AAPL', 'GLD'], monto: '1000' } })
    expect(html).toContain('Choose one or more investments, such as Apple or Gold.')
    expect(html).toContain('name="selected-assets" value="AAPL"')
    expect(html).toContain('name="selected-assets" value="GLD"')
    expect(html).toContain('Selected assets: 2')
    expect(html).toContain('Horizon will build a plan using only your selected assets. Amounts may differ, and some money may stay in cash.')
    expect(html.indexOf('Selected assets: 2')).toBeLessThan(html.indexOf('See my plan'))
    expect(html).not.toContain('split equally')
    expect(button(html, 'See my plan')).not.toContain('disabled')
  })

  it('requires a selected asset only on the final manual review step', () => {
    const draft = { ...props.draft, simbolos: [], simbolo: '' }
    const html = render({ step: 3, mode: 'asset', draft })
    expect(html).toContain('Choose at least one asset.')
    expect(button(html, 'See my plan')).toContain('disabled=""')
    expect(button(html, 'Back')).not.toContain('disabled')
    expect(button(render({ step: 0, mode: 'asset', draft }), 'Continue')).not.toContain('disabled')
  })

  it('keeps exact API group names and associates a server error with the review choices', () => {
    const html = render({ step: 3, typesError: 'Choose at least one asset type.' })
    expect(html.match(/type="checkbox"/g)).toHaveLength(Object.keys(assets).length)
    const values = inputs(html, 'asset-types').map((markup) => markup.match(/value="([^"]+)"/)?.[1])
    expect(values).toEqual(Object.keys(assets))
    expect(html).toContain('aria-describedby="guided-types-hint asset-types-error"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('id="asset-types-error" role="alert">Choose at least one asset type.')
    expect(html).not.toContain('role="combobox"')
  })

  it.each([0, 1, 2] as GuidedStep[])('allows step %s to continue while the catalogue is loading', (step) => {
    const html = render({ step, assets: null })
    expect(button(html, 'Continue')).not.toContain('disabled')
    expect(button(html, 'Back')).not.toContain('disabled')
  })

  it('waits for the catalogue on the final step but keeps Back available', () => {
    const html = render({ step: 3, assets: null, unavailable: true })
    expect(button(html, 'See my plan')).toContain('disabled=""')
    expect(button(html, 'Back')).not.toContain('disabled')
    expect(html).toContain('Use Try again above to reload your options.')
  })

  it('announces a pending request and retains navigation for cancellation', () => {
    const html = render({ step: 3, pending: true })
    expect(button(html, 'Checking…')).toContain('disabled=""')
    expect(button(html, 'Back')).not.toContain('disabled')
    expect(button(html, 'Use the quick form')).not.toContain('disabled')
    expect(html).toContain('role="status">Checking your choices. Your plan will appear here.')
    expect(html).toContain('$5,275.50')
  })
})
