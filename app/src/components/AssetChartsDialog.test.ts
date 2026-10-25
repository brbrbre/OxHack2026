import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AssetInspection } from '../lib/assetInspection'
import { decisionFixtures } from '../mocks/decisions'
import { DEFAULT_NOTICE } from '../config'
import AssetChartsDialog from './AssetChartsDialog'

const selection: AssetInspection = { symbol: 'SPY', name: 'S&P 500 (SPDR)', amount: 1000,
  days: 30, profile: 'moderado', basis: 'allocation', weight: 0.2 }
function render(input: AssetInspection) {
  const before = structuredClone(input)
  const html = renderToStaticMarkup(createElement(AssetChartsDialog, { selection: input, onClose() {} }))
  expect(input).toEqual(before)
  return html
}

describe('asset chart dialog presentation', () => {
  it('labels the native modal and its two keyboard tabs with unique connected targets', () => {
    const html = render(selection)
    expect(html).toContain('<dialog')
    expect(html).toContain('class="asset-charts-dialog"')
    expect(html).toContain('Close asset details')
    expect(html).toContain('S&amp;P 500 (SPDR)')
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
    expect(new Set(ids).size).toBe(ids.length)
    for (const match of html.matchAll(/aria-(?:labelledby|describedby|controls)="([^"]+)"/g)) expect(ids).toContain(match[1])
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*tabindex="0"/)
    expect(html).toMatch(/role="tab"[^>]*aria-selected="false"[^>]*tabindex="-1"/)
    expect(html).toContain('Your investment')
    expect(html).toContain('Price history')
    expect(html).toContain(DEFAULT_NOTICE)
  })

  it('uses the actual allocation and weight as context for its separate estimate', () => {
    const html = render(selection)
    expect(html).toContain('<dt>Allocated amount</dt><dd>$1,000')
    expect(html).toContain('<dt>Of your plan</dt><dd>20%</dd>')
    expect(html).toContain('This estimate uses the allocated amount. It does not change your plan.')
    expect(html).toContain('Estimating this amount…')
  })

  it('does not label a comparison budget as an allocation', () => {
    const html = render({ ...selection, basis: 'comparison', amount: 500 })
    expect(html).toContain('<dt>Budget share</dt><dd>$500')
    expect(html).toContain('This is your comparison budget share, not a portfolio allocation.')
    expect(html).not.toContain('Allocated amount')
    expect(html).not.toContain('Of your plan')
  })

  it('clearly labels excluded assets as full-budget illustrations instead of plan holdings', () => {
    const html = render({ ...selection, basis: 'hypothetical' })
    expect(html).toContain('<dt>Illustrative amount</dt><dd>$1,000')
    expect(html).toContain('This asset is not allocated in your plan. This illustration uses your full budget; it does not change the plan.')
    expect(html).toContain('class="asset-charts-basis hypothetical"')
    expect(html).not.toContain('Allocated amount')
    expect(html).not.toContain('Of your plan')
  })

  it('refuses to render a supplied forecast for another amount or asset', () => {
    const html = render({ ...selection, amount: 500, analysis: decisionFixtures.invest })
    expect(html).toContain('Estimating this amount…')
    expect(html).not.toContain('Prediction: baseline')
  })
})
