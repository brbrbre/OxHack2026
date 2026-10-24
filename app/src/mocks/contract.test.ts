import { describe, expect, it } from 'vitest'
import { parseAssets, parseDecision, parsePrices } from '../api/validation'
import { assets } from './assets'
import { decisionFixtures, mockDecision } from './decisions'
import { mockPrices } from './prices'
import { mockRequest } from './handlers'

describe('demo API fixtures', () => {
  it('provides 19 unique assets across all seven real groups', () => {
    const catalogue = parseAssets(assets)
    const symbols = Object.values(catalogue).flat().map((asset) => asset.simbolo)
    expect(Object.keys(catalogue)).toEqual([
      'ETFs', 'US stocks', 'Mexican stocks (BMV)', 'UK stocks', 'Indices', 'Currencies', 'Crypto',
    ])
    expect(symbols).toHaveLength(19)
    expect(new Set(symbols).size).toBe(19)
    expect(symbols).toEqual([
      'SPY', 'VOO', 'QQQ', 'GLD', 'AAPL', 'MSFT', 'NVDA', 'WALMEX.MX', 'AMXB.MX',
      'FEMSAUBD.MX', 'VOD.L', '^GSPC', '^FTSE', '^MXX', 'GBPUSD=X', 'MXN=X', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT',
    ])
    expect(catalogue.ETFs.find((asset) => asset.simbolo === 'GLD')?.nombre).toBe('Gold')
    expect(catalogue.Currencies.map((asset) => asset.nombre))
      .toEqual(['British pound / US dollar', 'US dollar / Mexican peso'])
  })

  it('covers all three decisions without changing the response shape', () => {
    expect(new Set(Object.values(decisionFixtures).map((fixture) => parseDecision(fixture).decision)))
      .toEqual(new Set(['INVERTIR', 'ESPERAR', 'NO_POR_AHORA']))
    for (const fixture of Object.values(decisionFixtures)) {
      expect(fixture.aviso).toBe('Educational prototype, not financial advice. Data: Yahoo Finance, Binance.')
    }
  })

  it('keeps the requested amount, horizon, profile and monetary range consistent', () => {
    const result = parseDecision(mockDecision({
      simbolo: 'SPY', monto: 2000, plazo_dias: 90, perfil: 'conservador',
    }))
    expect(result.numeros).toMatchObject({
      monto: 2000, plazo_dias: 90, perfil: 'conservador', peor_caso: -90, mejor_caso: 170,
    })
    expect(result.razones[0]).toContain('Over 90 days')
    expect(result.razones[1]).toContain('$2,000')
    expect(decisionFixtures.invest.numeros.monto).toBe(1000)
  })

  it('includes the Fed event and exact wait recommendations supplied by the team', () => {
    const result = mockDecision({ simbolo: 'BTCUSDT', monto: 1000, plazo_dias: 30, perfil: 'moderado' })
    expect(result.razones[0]).toBe('Fed rate decision on 28 Oct. Prices often move more on that day.')
    expect(result.recomendaciones).toEqual([
      'Check again after 28 Oct.',
    ])
    expect(result.numeros.eventos).toEqual(['Fed rate decision (2026-10-28)'])
  })

  it('matches the complete investment example in the updated API README', () => {
    const result = mockDecision({ simbolo: 'SPY', monto: 1000, plazo_dias: 30, perfil: 'moderado' })
    expect(result).toEqual(decisionFixtures.invest)
    expect(result.razones).toEqual([
      'Over 30 days the model expects +2.0%, with a 31% chance of loss.',
      'Likely range: -$45 to $85 on $1,000.',
      'The expected gain makes up for the risk for your profile.',
    ])
  })

  it('keeps the risk-based WAIT reason consistent with its monetary range', () => {
    const result = parseDecision(mockDecision({
      simbolo: 'ETHUSDT', monto: 1000, plazo_dias: 30, perfil: 'moderado',
    }))
    expect(result.decision).toBe('ESPERAR')
    expect(result.numeros.peor_caso).toBe(-220)
    expect(result.razones).toEqual([
      'In a bad scenario you could lose $220 (-22.0%); your moderate profile accepts up to 10%.',
    ])
    expect(result.recomendaciones).toEqual([
      'If you want to invest now, put in about $455 instead of $1,000.',
    ])
    expect(result.numeros.eventos).toEqual([])
  })

  it('updates risk copy when the submitted amount or profile changes', () => {
    const result = mockDecision({ simbolo: 'ETHUSDT', monto: 2000, plazo_dias: 90, perfil: 'conservador' })
    expect(result.numeros).toMatchObject({ monto: 2000, plazo_dias: 90, perfil: 'conservador', peor_caso: -440 })
    expect(result.razones[0]).toBe(
      'In a bad scenario you could lose $440 (-22.0%). Review whether that fits your conservative risk profile.',
    )
    expect(result.recomendaciones[0]).toBe('If you want to invest now, put in about $910 instead of $2,000.')
  })

  it('uses the updated not-now explanation and recommendation verbatim', () => {
    const result = mockDecision({ simbolo: 'NVDA', monto: 1000, plazo_dias: 30, perfil: 'moderado' })
    expect(result.decision).toBe('NO_POR_AHORA')
    expect(result.razones).toEqual(['The model sees a higher chance of losing than gaining over this period.'])
    expect(result.recomendaciones).toEqual(['Check again in a few days, or try a longer period.'])
  })

  it('generates stable, aligned price arrays and includes weekends for crypto', () => {
    const equity = parsePrices(mockPrices('SPY'))
    const crypto = parsePrices(mockPrices('BTCUSDT'))
    expect(equity).toEqual(mockPrices('SPY'))
    expect(equity.fechas.length).toBeGreaterThan(250)
    expect(equity.fechas.every((date) => ![0, 6].includes(new Date(date + 'T12:00:00Z').getUTCDay()))).toBe(true)
    expect(crypto.fechas).toHaveLength(366)
    expect(crypto.cierres.every((close) => close > 0)).toBe(true)
  })

  it('returns the expected 404 for unknown demo assets', async () => {
    await expect(mockRequest('/api/prices/UNKNOWN?dias=365'))
      .rejects.toMatchObject({ status: 404 })
  })

  it('rejects invalid request values with the contract error status', async () => {
    await expect(mockRequest('/api/decide', {
      method: 'POST',
      body: JSON.stringify({ simbolo: 'SPY', monto: -10, plazo_dias: 30, perfil: 'moderado' }),
    })).rejects.toMatchObject({ status: 400 })
  })
})
