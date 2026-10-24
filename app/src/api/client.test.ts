import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { fetchJson } from './http'
import { parseDecision, parsePrices } from './validation'
import { decisionFixtures } from '../mocks/decisions'
import { planFixtures } from '../mocks/plan'

vi.mock('../config', async (importOriginal) => ({
  ...await importOriginal<typeof import('../config')>(),
  USE_MOCKS: false,
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('real API contract', () => {
  it('encodes symbols and preserves the dias parameter', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      simbolo: '^GSPC', fechas: ['2025-10-24'], cierres: [598.12],
    })))
    vi.stubGlobal('fetch', fetch)
    await api.getPrices('^GSPC', 365)
    expect(fetch.mock.calls[0][0]).toBe('/api/prices/%5EGSPC?dias=365')
  })

  it('posts unchanged Spanish wire codes and preserves the API copy verbatim', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(decisionFixtures.invest)))
    vi.stubGlobal('fetch', fetch)
    const body = { simbolo: 'SPY', monto: 1000, plazo_dias: 30, perfil: 'moderado' as const }
    const result = await api.decide(body)
    expect(fetch.mock.calls[0][0]).toBe('/api/decide')
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body)
    expect(result.razones).toEqual(decisionFixtures.invest.razones)
  })

  it.each([400, 404])('preserves the API error text and HTTP %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Asset unavailable.' }), { status }),
    ))
    await expect(api.getAssets()).rejects.toMatchObject({ message: 'Asset unavailable.', status })
  })

  it('rejects mismatched price arrays instead of drawing misleading points', () => {
    expect(() => parsePrices({ simbolo: 'SPY', fechas: ['2025-10-24'], cierres: [] }))
      .toThrow('incomplete price history')
  })

  it('rejects unsupported decisions and impossible probabilities', () => {
    expect(() => parseDecision({ ...decisionFixtures.invest, decision: 'MAYBE' })).toThrow('incomplete analysis')
    const result = structuredClone(decisionFixtures.invest)
    result.numeros.prob_perdida = 1.1
    expect(() => parseDecision(result)).toThrow('incomplete analysis')
  })

  it('does not silently use mock data when the real server is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.getAssets()).rejects.toThrow('could not reach the service')
  })

  it('explains an empty proxy error as service unavailability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    await expect(api.getAssets()).rejects.toMatchObject({
      message: 'The service is temporarily unavailable. Please try again shortly.', status: 500,
    })
  })

  it('cancels a superseded request instead of surfacing an error for the old asset', async () => {
    vi.stubGlobal('fetch', vi.fn((_path, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const controller = new AbortController()
    const request = api.getPrices('SPY', 365, controller.signal)
    controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('turns a hung service into a clear timeout message', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_path, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const request = fetchJson('/api/assets')
    const assertion = expect(request).rejects.toThrow('longer than expected')
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
  })

  it('rejects an analysis belonging to a different submitted amount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(decisionFixtures.invest))))
    await expect(api.decide({ simbolo: 'SPY', monto: 2000, plazo_dias: 30, perfil: 'moderado' }))
      .rejects.toThrow('did not match your plan')
  })

  it('posts the exact plan request and preserves its summary and classifications', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(planFixtures.sample)))
    vi.stubGlobal('fetch', fetch)
    const body = { monto: 5000, plazo_dias: 90, perfil: 'moderado' as const, tipos: ['ETFs', 'US stocks', 'Crypto'] }
    const result = await api.plan(body)
    expect(fetch.mock.calls[0][0]).toBe('/api/plan')
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(fetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body)
    expect(result).toEqual(planFixtures.sample)
  })

  it('preserves the unknown asset type error from the plan endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'Unknown asset types: Bonds' }), { status: 400 },
    )))
    await expect(api.plan({ monto: 5000, plazo_dias: 90, perfil: 'moderado', tipos: ['Bonds'] }))
      .rejects.toMatchObject({ message: 'Unknown asset types: Bonds', status: 400 })
  })

  it.each([
    { monto: 6000, plazo_dias: 90, perfil: 'moderado' as const, tipos: ['ETFs', 'US stocks', 'Crypto'] },
    { monto: 5000, plazo_dias: 30, perfil: 'moderado' as const, tipos: ['ETFs', 'US stocks', 'Crypto'] },
    { monto: 5000, plazo_dias: 90, perfil: 'agresivo' as const, tipos: ['ETFs', 'US stocks', 'Crypto'] },
    { monto: 5000, plazo_dias: 90, perfil: 'moderado' as const, tipos: ['ETFs'] },
  ])('rejects a plan belonging to a different request: %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(planFixtures.sample))))
    await expect(api.plan(body)).rejects.toThrow('investment plan did not match your request')
  })
})
