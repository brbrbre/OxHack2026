import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AssetLogo from '../components/AssetLogo'
import { ThemeProvider } from '../appearance/ThemeContext'
import { assetIdentity } from './assetIdentity'

function renderLogo(symbol: string, theme: 'light' | 'dark') {
  return renderToStaticMarkup(createElement(ThemeProvider, {
    initialTheme: theme, children: createElement(AssetLogo, { symbol }),
  }))
}

describe('asset identities', () => {
  it('preserves the same portfolio color when assets change order', () => {
    const original = ['GLD', 'AAPL', 'MSFT', 'VOO', 'QQQ']
    const before = new Map(original.map((symbol) => [symbol, assetIdentity(symbol).className]))
    for (const symbol of [...original].reverse()) expect(assetIdentity(symbol).className).toBe(before.get(symbol))
    expect(new Set([...before.values()]).size).toBe(5)
  })

  it('maps the requested recognizable logo variants and gold ETF marker', () => {
    expect(assetIdentity('AAPL').logo).toMatch(/apple\.svg$/)
    expect(assetIdentity('NVDA').logo).toMatch(/nvidia-green\.svg$/)
    expect(assetIdentity('HSBA.L').logo).toMatch(/hsbc-red\.svg$/)
    expect(assetIdentity('GLD')).toMatchObject({ className: 'asset-color-gold', badge: 'ETF' })
  })

  it('uses legible wordmarks in dark mode while retaining each original in light mode', () => {
    for (const symbol of ['SPY', 'VOO', 'QQQ', 'AAPL', 'AMXB.MX', '^GSPC', '^FTSE', '^MXX']) {
      const identity = assetIdentity(symbol)
      expect(identity.darkLogo, symbol).toBeDefined()
      expect(identity.darkLogo, symbol).not.toBe(identity.logo)
      expect(renderLogo(symbol, 'dark')).toContain('src="' + identity.darkLogo + '"')
      expect(renderLogo(symbol, 'light')).toContain('src="' + identity.logo + '"')
    }
  })

  it('keeps colorful marks, the gold marker and currency flags the same in both themes', () => {
    for (const symbol of ['NVDA', 'HSBA.L', 'SHEL.L', 'BTCUSDT', 'GLD', 'GBPUSD=X', 'MXN=X']) {
      expect(renderLogo(symbol, 'dark'), symbol).toBe(renderLogo(symbol, 'light'))
    }
  })

  it('keeps the base crypto identity and explicit currency-pair flags', () => {
    expect(assetIdentity('BTCUSDT').logo).toMatch(/btc\.svg$/)
    expect(assetIdentity('GBPUSD=X').flags).toEqual(['/assets/logos/gb.svg', '/assets/logos/us.svg'])
    expect(assetIdentity('MXN=X').flags).toEqual(['/assets/logos/us.svg', '/assets/logos/mx.svg'])
  })

  it('normalizes symbols and safely handles an unfamiliar API asset', () => {
    expect(assetIdentity(' nvda ')).toEqual(assetIdentity('NVDA'))
    expect(assetIdentity('NEW.L')).toEqual(assetIdentity('NEW.L'))
    expect(assetIdentity('NEW.L').className).toMatch(/^asset-color-fallback-[0-5]$/)
    expect(assetIdentity('__proto__').className).toMatch(/^asset-color-fallback-/)
    expect(assetIdentity('<img>')).toMatchObject({ badge: 'IM' })
  })

  it('keeps future Google and Tesla colors distinct without defining a selectable catalogue', () => {
    expect(assetIdentity('GOOG').className).toBe(assetIdentity('GOOGL').className)
    expect(assetIdentity('GOOGL').color).not.toBe(assetIdentity('TSLA').color)
  })
})
