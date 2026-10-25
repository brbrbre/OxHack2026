import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { assets } from '../mocks/assets'
import AssetPicker, { filterAssetGroups, nextAssetIndex } from './AssetPicker'

describe('asset search', () => {
  it('preserves all API groups, assets and their order for an empty query', () => {
    const groups = filterAssetGroups(assets, '')
    expect(groups.map((group) => group.name)).toEqual(Object.keys(assets))
    expect(groups.flatMap((group) => group.assets)).toEqual(Object.values(assets).flat())
    expect(groups.flatMap((group) => group.assets)).toHaveLength(21)
  })

  it('finds names without requiring accents and handles case and surrounding space', () => {
    expect(filterAssetGroups(assets, '  america MOVIL ').flatMap((group) => group.assets).map((asset) => asset.simbolo))
      .toEqual(['AMXB.MX'])
    expect(filterAssetGroups(assets, 'mexico').flatMap((group) => group.assets).map((asset) => asset.simbolo))
      .toEqual(['WALMEX.MX'])
  })

  it('finds exact API symbols including punctuation without changing them', () => {
    for (const symbol of ['HSBA.L', '^FTSE', 'GBPUSD=X', 'BTCUSDT']) {
      expect(filterAssetGroups(assets, symbol).flatMap((group) => group.assets).map((asset) => asset.simbolo)).toEqual([symbol])
    }
  })

  it('allows combined name and symbol terms and omits empty groups', () => {
    expect(filterAssetGroups(assets, 'apple AAPL')).toEqual([{ name: 'US stocks', assets: [{ simbolo: 'AAPL', nombre: 'Apple' }] }])
    expect(filterAssetGroups(assets, 'bitcoin NVDA')).toEqual([])
  })

  it('shows no matches for unsupported assets rather than adding them to the catalogue', () => {
    expect(filterAssetGroups(assets, 'google')).toEqual([])
    expect(filterAssetGroups(assets, 'tesla')).toEqual([])
    expect(filterAssetGroups(null, '')).toEqual([])
  })

  it('uses new API catalogue entries without a hardcoded list', () => {
    const catalogue = { 'New group': [{ simbolo: 'NEW', nombre: 'New company' }] }
    expect(filterAssetGroups(catalogue, 'company')).toEqual([{ name: 'New group', assets: catalogue['New group'] }])
  })
})

describe('asset keyboard navigation', () => {
  it('wraps through the options and can move to either end', () => {
    expect(nextAssetIndex(-1, 3, 'ArrowDown')).toBe(0)
    expect(nextAssetIndex(-1, 3, 'ArrowUp')).toBe(2)
    expect(nextAssetIndex(2, 3, 'ArrowDown')).toBe(0)
    expect(nextAssetIndex(0, 3, 'ArrowUp')).toBe(2)
    expect(nextAssetIndex(1, 3, 'Home')).toBe(0)
    expect(nextAssetIndex(1, 3, 'End')).toBe(2)
  })

  it('never targets an option when there are no matches', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) expect(nextAssetIndex(0, 0, key)).toBe(-1)
  })
})

describe('asset picker accessibility', () => {
  it('exposes the selected API name and symbol with an associated, closed combobox', () => {
    const html = renderToStaticMarkup(createElement(AssetPicker, { assets, symbol: 'NVDA', onChange: () => {}, unavailable: false, describedBy: 'asset-hint' }))
    expect(html).toContain('id="asset"')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-autocomplete="list"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('value="NVIDIA (NVDA)"')
    expect(html).toContain('name="asset" value="NVDA"')
    expect(html).toContain('aria-describedby="asset-hint ')
    expect(html).not.toContain('aria-activedescendant=')
  })

  it('clearly distinguishes loading and unavailable states and disables editing', () => {
    const loading = renderToStaticMarkup(createElement(AssetPicker, { assets: null, symbol: 'SPY', onChange: () => {}, unavailable: false }))
    const failed = renderToStaticMarkup(createElement(AssetPicker, { assets: null, symbol: 'SPY', onChange: () => {}, unavailable: true }))
    expect(loading).toContain('placeholder="Loading assets…"')
    expect(failed).toContain('placeholder="Assets unavailable"')
    expect(loading).toMatch(/<input[^>]*role="combobox"[^>]*disabled=""/)
    expect(failed).toMatch(/<input[^>]*role="combobox"[^>]*disabled=""/)
  })
})
