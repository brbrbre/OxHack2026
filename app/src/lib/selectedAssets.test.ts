import { describe, expect, it, vi } from 'vitest'
import { decisionFixtures } from '../mocks/decisions'
import { analyzeSelectedAssets, selectedSymbols, splitSelectedBudget } from './selectedAssets'

describe('selected investment comparison', () => {
  it('keeps legacy single-asset drafts and removes duplicates', () => {
    expect(selectedSymbols({ simbolo: 'SPY' })).toEqual(['SPY'])
    expect(selectedSymbols({ simbolo: 'SPY', simbolos: ['VOO', 'GLD', 'VOO'] })).toEqual(['VOO', 'GLD'])
    expect(selectedSymbols({ simbolo: '', simbolos: [] })).toEqual([])
  })

  it('splits in cents without creating or losing part of the budget', () => {
    const shares = splitSelectedBudget(1000, ['VOO', 'GLD', 'AAPL'])
    expect(shares).toEqual([{ simbolo: 'VOO', monto: 333.34 }, { simbolo: 'GLD', monto: 333.33 }, { simbolo: 'AAPL', monto: 333.33 }])
    expect(shares.reduce((sum, item) => sum + Math.round(item.monto * 100), 0)).toBe(100000)
    expect(() => splitSelectedBudget(0.01, ['VOO', 'GLD'])).toThrow(/each selected asset/)
  })

  it('preserves the original USD value of a converted local-currency budget', () => {
    const usd = 5000 / (21.0226 / 1.1193)
    const shares = splitSelectedBudget(usd, ['VOO', 'GLD'])
    expect(shares[0].monto).toBe(usd / 2)
    expect(shares.reduce((sum, item) => sum + item.monto, 0)).toBe(usd)
  })

  it('sends only existing endpoint fields, preserves selection order and caps parallel requests at three', async () => {
    let pending = 0
    let maximum = 0
    const decide = vi.fn(async (request) => {
      pending++
      maximum = Math.max(maximum, pending)
      await Promise.resolve()
      pending--
      return { ...decisionFixtures.invest, simbolo: request.simbolo, numeros: { ...decisionFixtures.invest.numeros, ...request } }
    })
    const request = { monto: 1000, plazo_dias: 90, perfil: 'moderado' as const }
    const results = await analyzeSelectedAssets(['VOO', 'GLD', 'AAPL', 'SPY'], request, new AbortController().signal, decide)
    expect(maximum).toBe(3)
    expect(results.map((item) => item.simbolo)).toEqual(['VOO', 'GLD', 'AAPL', 'SPY'])
    for (const [body] of decide.mock.calls) expect(body).toEqual({ ...request, monto: 250, simbolo: expect.any(String) })
  })

  it('does not start requests after cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    const decide = vi.fn()
    await expect(analyzeSelectedAssets(['VOO', 'GLD'], { monto: 100, plazo_dias: 30, perfil: 'moderado' }, controller.signal, decide)).rejects.toMatchObject({ name: 'AbortError' })
    expect(decide).not.toHaveBeenCalled()
  })
})
