import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PriceChart from '../components/PriceChart'
import { formatQuotePrice, formatQuoteTick, quoteForSymbol } from './quote'

describe('asset quote currencies', () => {
  it.each([
    ['SPY', 'USD'], ['^GSPC', 'USD'], ['WALMEX.MX', 'MXN'],
    ['HSBA.L', 'GBp'], ['SHEL.L', 'GBp'], ['VOD.L', 'GBp'],
    ['BTCUSDT', 'USDT'], ['GBPUSD=X', 'FX'], ['MXN=X', 'FX'],
  ])('identifies the quote currency for %s', (symbol, currency) => {
    expect(quoteForSymbol(symbol).currency).toBe(currency)
  })

  it('converts London pence to pounds exactly once across price and axis labels', () => {
    expect(formatQuotePrice('HSBA.L', 1352)).toBe('£13.52')
    expect(formatQuoteTick('HSBA.L', 1352)).toBe('£13.52')
    expect(quoteForSymbol('HSBA.L').note).toContain('100 pence = £1')
  })

  it('distinguishes Mexican pesos, US dollars and USDT', () => {
    expect(formatQuotePrice('WALMEX.MX', 56.4)).toBe('MX$56.40')
    expect(formatQuotePrice('SPY', 601.4)).toBe('$601.40')
    expect(formatQuotePrice('BTCUSDT', 80720)).toBe('80,720.00 USDT')
  })

  it('identifies the direction and precision of each exchange rate', () => {
    expect(formatQuotePrice('GBPUSD=X', 1.31)).toBe('1.3100 USD per GBP')
    expect(formatQuotePrice('MXN=X', 19.8)).toBe('19.8000 MXN per USD')
    expect(formatQuoteTick('GBPUSD=X', 1.3123)).toBe('1.3123')
    expect(quoteForSymbol('GBPUSD=X').note).toBe('Exchange rate: USD per GBP.')
    expect(quoteForSymbol('MXN=X').note).toBe('Exchange rate: MXN per USD.')
  })

  it('formats a future full currency pair as an exchange rate', () => {
    expect(formatQuotePrice('EURUSD=X', 1.0812)).toBe('1.0812 USD per EUR')
    expect(quoteForSymbol('UNKNOWN=X').note).toBe('Exchange rate.')
  })
})

describe('price chart quote presentation', () => {
  function renderChart(symbol: string, closes: number[]) {
    const prices = { simbolo: symbol, fechas: ['2026-10-22', '2026-10-23'], cierres: closes }
    const before = structuredClone(prices)
    const html = renderToStaticMarkup(createElement(PriceChart, {
      symbol, name: 'Example asset', prices, pending: false, error: null,
      onRetry: () => {}, isDemo: false,
    }))
    expect(prices).toEqual(before)
    return html
  }

  it('uses a downward arrow for a negative return', () => {
    const html = renderChart('BTCUSDT', [100, 72.7])
    expect(html).toContain('lucide-arrow-down-right')
    expect(html).toContain('-27.3%')
    expect(html).not.toContain('lucide-arrow-up-right')
  })

  it('uses an upward arrow for a positive return', () => {
    const html = renderChart('SPY', [100, 102])
    expect(html).toContain('lucide-arrow-up-right')
    expect(html).not.toContain('lucide-arrow-down-right')
  })

  it('shows London prices in pounds while preserving API pence and the relative return', () => {
    const html = renderChart('HSBA.L', [1300, 1352])
    expect(html).toContain('£13.52')
    expect(html).toContain('+4%')
    expect(html).toContain('100 pence = £1')
  })

  it('includes the FX units in both the visible price and the accessible chart description', () => {
    const html = renderChart('GBPUSD=X', [1.3, 1.31])
    expect(html).toContain('1.3100 USD per GBP')
    expect(html).toContain('Exchange rate: USD per GBP.')
    expect(html).toContain('Latest close 1.3100 USD per GBP')
  })
})
