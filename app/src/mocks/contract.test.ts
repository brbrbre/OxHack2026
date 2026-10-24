import { describe, expect, it } from 'vitest'
import { parseAssets, parseDecision, parsePlan, parsePrices } from '../api/validation'
import { assets } from './assets'
import { decisionFixtures, mockDecision } from './decisions'
import { mockPrices } from './prices'
import { mockRequest } from './handlers'
import { mockPlan, planFixtures } from './plan'

describe('demo API fixtures', () => {
  it('provides 21 unique assets across all seven real groups', () => {
    const catalogue = parseAssets(assets)
    const symbols = Object.values(catalogue).flat().map((asset) => asset.simbolo)
    expect(Object.keys(catalogue)).toEqual([
      'ETFs', 'US stocks', 'Mexican stocks (BMV)', 'UK stocks', 'Indices', 'Currencies', 'Crypto',
    ])
    expect(symbols).toHaveLength(21)
    expect(new Set(symbols).size).toBe(21)
    expect(symbols).toEqual([
      'SPY', 'VOO', 'QQQ', 'GLD', 'AAPL', 'MSFT', 'NVDA', 'WALMEX.MX', 'AMXB.MX',
      'FEMSAUBD.MX', 'VOD.L', 'HSBA.L', 'SHEL.L', '^GSPC', '^FTSE', '^MXX', 'GBPUSD=X', 'MXN=X', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT',
    ])
    expect(catalogue.ETFs.find((asset) => asset.simbolo === 'GLD')?.nombre).toBe('Gold')
    expect(catalogue.Currencies.map((asset) => asset.nombre))
      .toEqual(['British pound / US dollar', 'US dollar / Mexican peso'])
    expect(catalogue['UK stocks']).toEqual([
      { simbolo: 'VOD.L', nombre: 'Vodafone' },
      { simbolo: 'HSBA.L', nombre: 'HSBC' },
      { simbolo: 'SHEL.L', nombre: 'Shell' },
    ])
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

  it('covers full, partial and zero investment with nullable and zero historical trends', () => {
    expect(parseDecision(decisionFixtures.invest).numeros).toMatchObject({
      fraccion: 1, monto_sugerido: 1000, tendencia_12m: 0.14,
    })
    expect(parseDecision(decisionFixtures.waitRisk).numeros).toMatchObject({
      fraccion: 0.455, monto_sugerido: 455, tendencia_12m: null,
    })
    expect(parseDecision(decisionFixtures.notNow).numeros).toMatchObject({
      fraccion: 0, monto_sugerido: 0, tendencia_12m: 0,
    })
    for (const simbolo of ['SPY', 'BTCUSDT', 'ETHUSDT', 'NVDA']) {
      const { numeros } = parseDecision(mockDecision({
        simbolo, monto: 2345.67, plazo_dias: 180, perfil: 'moderado',
      }))
      expect(numeros.monto_sugerido).toBeCloseTo(numeros.monto * numeros.fraccion, 8)
      expect(numeros.monto_sugerido).toBeGreaterThanOrEqual(0)
      expect(numeros.monto_sugerido).toBeLessThanOrEqual(numeros.monto)
    }
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
    for (const symbol of ['HSBA.L', 'SHEL.L']) {
      const history = parsePrices(mockPrices(symbol))
      expect(history.simbolo).toBe(symbol)
      expect(history.cierres.every((close) => close > 0)).toBe(true)
      expect(history.fechas).toEqual(equity.fechas)
    }
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

describe('demo investment plan contract', () => {
  it('provides a complete, internally consistent sample including cash and all three decisions', () => {
    const result = parsePlan(planFixtures.sample)
    expect(result.numeros).toMatchObject({ monto: 5000, plazo_dias: 90, perfil: 'moderado', tolerancia: 0.1 })
    expect(result.numeros.peor_caso).toBeCloseTo(-321)
    expect(result.cartera.reduce((sum, asset) => sum + asset.monto, 0)).toBeCloseTo(result.numeros.invertido)
    expect(result.numeros.invertido + result.efectivo).toBeCloseTo(5000)
    expect(result.efectivo).toBeGreaterThan(0)
    expect(result.invertir.length).toBeGreaterThan(0)
    expect(result.esperar.length).toBeGreaterThan(0)
    expect(result.no_por_ahora.length).toBeGreaterThan(0)
    expect(result.aviso).toBe(decisionFixtures.invest.aviso)
  })

  it('partitions every asset from the requested groups exactly once', () => {
    const tipos = ['ETFs', 'US stocks', 'Crypto']
    const result = parsePlan(mockPlan({ monto: 5000, plazo_dias: 90, perfil: 'moderado', tipos }))
    const classified = [...result.invertir, ...result.esperar, ...result.no_por_ahora]
    const expected = tipos.flatMap((group) => assets[group].map((asset) => asset.simbolo)).sort()
    expect(classified.map((asset) => asset.simbolo).sort()).toEqual(expected)
    expect(new Set(classified.map((asset) => asset.simbolo)).size).toBe(expected.length)
    expect(classified.every((asset) => tipos.includes(asset.grupo) && asset.razon.length > 0)).toBe(true)
    const investable = result.invertir.map((asset) => asset.simbolo)
    expect(result.cartera.every((asset) => investable.includes(asset.simbolo))).toBe(true)
  })

  it.each(['conservador', 'moderado', 'agresivo'] as const)(
    'preserves the selected groups, budget and risk profile for %s', (perfil) => {
      const tipos = ['UK stocks', 'Crypto', 'Currencies']
      const result = parsePlan(mockPlan({ monto: 2345.67, plazo_dias: 180, perfil, tipos }))
      expect(result.numeros).toMatchObject({ monto: 2345.67, plazo_dias: 180, perfil })
      expect(result.numeros.invertido + result.efectivo).toBeCloseTo(2345.67)
      expect(result.cartera.length).toBeLessThanOrEqual(5)
      for (const asset of result.cartera) {
        expect(asset.peso).toBeGreaterThan(0)
        expect(asset.peso).toBeLessThanOrEqual(0.4)
        expect(asset.monto).toBeCloseTo(asset.peso * 2345.67)
        expect(tipos).toContain(asset.grupo)
      }
      expect(result.cartera.map((asset) => asset.peso))
        .toEqual(result.cartera.map((asset) => asset.peso).sort((a, b) => b - a))
      expect(result.resumen).toContain('For 180 days')
    },
  )

  it('keeps the allocation cap and cash when only one investable asset is available', () => {
    const result = parsePlan(mockPlan({ monto: 1000, plazo_dias: 7, perfil: 'moderado', tipos: ['Crypto'] }))
    expect(result.cartera).toHaveLength(1)
    expect(result.cartera[0]).toMatchObject({ simbolo: 'SOLUSDT', peso: 0.4, monto: 400 })
    expect(result.efectivo).toBe(600)
  })

  it('allows a valid all-cash plan with no holdings', () => {
    const result = parsePlan(planFixtures.allCash)
    expect(result.cartera).toEqual([])
    expect(result.invertir).toEqual([])
    expect(result.numeros.invertido).toBe(0)
    expect(result.efectivo).toBe(result.numeros.monto)
    expect(result.numeros.volatilidad).toBe(0)
    expect(result.numeros.peor_caso).toBe(0)
  })

  it('routes POST /api/plan through the same mock transport', async () => {
    const result = parsePlan(await mockRequest('/api/plan', {
      method: 'POST',
      body: JSON.stringify({ monto: 5000, plazo_dias: 90, perfil: 'moderado', tipos: ['ETFs', 'US stocks', 'Crypto'] }),
    }))
    expect(result).toEqual(planFixtures.sample)
  })

  it('returns the exact 400 error for an unknown asset type', async () => {
    await expect(mockRequest('/api/plan', {
      method: 'POST',
      body: JSON.stringify({ monto: 5000, plazo_dias: 90, perfil: 'moderado', tipos: ['ETFs', 'crypto'] }),
    })).rejects.toMatchObject({ status: 400, message: 'Unknown asset types: crypto' })
  })

  it.each([
    { monto: 0 }, { monto: 1e9 + 1 }, { plazo_dias: 731 },
    { plazo_dias: 1.5 }, { tipos: [] }, { tipos: [null] },
  ])('rejects invalid plan fields: %j', async (invalid) => {
    await expect(mockRequest('/api/plan', {
      method: 'POST',
      body: JSON.stringify({ monto: 5000, plazo_dias: 90, perfil: 'moderado', tipos: ['ETFs'], ...invalid }),
    })).rejects.toMatchObject({ status: 400 })
  })
})
