import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AssetsResponse } from '../api/types'
import SelectedAssetsPicker, { SelectedAssetsSplit, selectedDraftSymbols, uniqueAssetSymbols } from './SelectedAssetsPicker'

const assets: AssetsResponse = {
  ETFs: [{ simbolo: 'SPY', nombre: 'S&P 500 (SPDR)' }, { simbolo: 'GLD', nombre: 'Gold' }],
  'US stocks': [{ simbolo: 'AAPL', nombre: 'Apple' }],
}

function render(symbols: string[], catalogue: AssetsResponse | null = assets) {
  return renderToStaticMarkup(createElement(SelectedAssetsPicker, {
    assets: catalogue, symbols, onChange: () => {}, unavailable: false, describedBy: 'asset-hint',
  }))
}

describe('multiple asset selection', () => {
  it('keeps a legacy single symbol but respects an explicitly empty list after removal', () => {
    expect(selectedDraftSymbols({ simbolo: 'SPY' })).toEqual(['SPY'])
    expect(selectedDraftSymbols({ simbolo: 'SPY', simbolos: [] })).toEqual([])
    expect(selectedDraftSymbols({ simbolo: 'SPY', simbolos: ['GLD', 'AAPL'] })).toEqual(['GLD', 'AAPL'])
  })

  it('prevents repeated or empty selections while preserving API symbols and selection order', () => {
    expect(uniqueAssetSymbols(['SPY', 'GLD', 'SPY', '', ' ', 'AAPL', 'GLD'])).toEqual(['SPY', 'GLD', 'AAPL'])
    expect(uniqueAssetSymbols(['^GSPC', 'WALMEX.MX', 'BTCUSDT'])).toEqual(['^GSPC', 'WALMEX.MX', 'BTCUSDT'])
    const html = render(['SPY', 'GLD', 'SPY'])
    expect(html.match(/name="selected-assets"/g)).toHaveLength(2)
    expect(html.match(/name="selected-assets" value="SPY"/g)).toHaveLength(1)
  })

  it('shows named selections with decorative logos and accessible removal while retaining one search field', () => {
    const html = render(['SPY', 'GLD'])
    expect(html).toContain('aria-label="Selected assets"')
    expect(html).toContain('S&amp;P 500 (SPDR)</strong><small>SPY</small>')
    expect(html).toContain('Gold</strong><small>GLD</small>')
    expect(html).toContain('asset-logo asset-logo-small')
    expect(html).toContain('aria-label="Remove S&amp;P 500 (SPDR) (SPY)"')
    expect(html).toContain('aria-label="Remove Gold (GLD)"')
    expect(html.match(/id="asset"/g)).toHaveLength(1)
    expect(html.match(/role="combobox"/g)).toHaveLength(1)
    expect(html).toContain('Search again to add another asset.')
    expect(html).toContain('Use the arrow keys to browse, Enter to choose, and Escape to close.')
  })

  it('keeps search available when no assets are selected', () => {
    const html = render([])
    expect(html).toContain('role="combobox"')
    expect(html).toContain('Choose at least one asset.')
    expect(html).not.toContain('name="selected-assets"')
    expect(html).not.toMatch(/role="combobox"[^>]*disabled/)
  })

  it('allows the whole catalogue without an arbitrary selection cap', () => {
    const html = render(['SPY', 'GLD', 'AAPL'])
    expect(html.match(/name="selected-assets"/g)).toHaveLength(3)
    expect(html).toContain('value="All available assets selected"')
    expect(html).toContain('Remove an asset to change your selection.')
    expect(html).not.toContain('role="combobox"')
    expect(html).not.toMatch(/class="selected-asset-remove"[^>]*disabled/)
    expect(html.match(/id="asset"/g)).toHaveLength(1)
  })

  it('preserves selections while the catalogue reloads', () => {
    const html = render(['SPY'], null)
    expect(html).toContain('name="selected-assets" value="SPY"')
    expect(html).toContain('aria-label="Remove SPY"')
    expect(html).toMatch(/role="combobox"[^>]*disabled/)
    expect(html).toContain('Loading assets…')
  })
})

describe('manual asset budget explanation', () => {
  it('makes the equal comparison split clear instead of presenting it as portfolio optimization', () => {
    const html = renderToStaticMarkup(createElement(SelectedAssetsSplit, { count: 2, amount: '1000' }))
    expect(html).toContain('About $500 per asset')
    expect(html).toContain('Your $1,000 budget is split equally across 2 assets for comparison, not an optimized allocation.')
  })

  it.each([{ count: 1, amount: '1000' }, { count: 0, amount: '1000' }, { count: 2, amount: '' },
    { count: 2, amount: '0' }, { count: 2, amount: 'invalid' }])('only explains a valid shared budget: %j', (props) => {
    expect(renderToStaticMarkup(createElement(SelectedAssetsSplit, props))).toBe('')
  })
})
