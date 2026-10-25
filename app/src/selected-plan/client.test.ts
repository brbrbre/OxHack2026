import { afterEach, describe, expect, it, vi } from 'vitest'
import { parsePlan } from '../api/validation'
import { selectedPlanApi } from './client'
import type { SelectedPlanRequest } from './client'
import { mockSelectedPlan } from './mocks'

const source = vi.hoisted(() => ({ mocks: false }))
vi.mock('../config', async (importOriginal) => ({
  ...await importOriginal<typeof import('../config')>(),
  get USE_MOCKS() { return source.mocks },
}))

const body: SelectedPlanRequest = { simbolos: ['SPY', 'GLD'], monto: 1000, plazo_dias: 37, perfil: 'moderado' }
const unsupported = 'This feature needs the updated server. Ask the team to deploy the selected-assets API.'
const mismatch = 'The selected investment plan did not match your request. Please try again.'

function respond(value: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(value), { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => {
  source.mocks = false
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('selected-only real plan requests', () => {
  it('posts the exact symbols and request codes to the independent endpoint', async () => {
    const response = mockSelectedPlan(body)
    response.resumen = 'Server explanation remains unchanged.'
    const before = structuredClone(body)
    const fetch = respond(response)
    const result = await selectedPlanApi.plan(body)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('/api/plan/selected')
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(fetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('tipos')
    expect(result).toEqual(response)
    expect(body).toEqual(before)
  })

  it('uses the exact selected summary endpoint and body instead of a category plan summary', async () => {
    const response = { texto: 'A registered selected-plan summary.', fuente: 'gemini' }
    const fetch = respond(response)
    expect(await selectedPlanApi.summary(body)).toEqual(response)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('/api/summary/plan/selected')
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body)
  })

  it.each([
    { method: 'plan', status: 404 }, { method: 'summary', status: 404 },
    { method: 'plan', status: 405 }, { method: 'summary', status: 405 },
  ] as const)('explains an older server $status for $method without falling back to automatic endpoints', async ({ method, status }) => {
    const fetch = respond({ error: status === 404 ? 'Not Found' : 'Method Not Allowed' }, status)
    await expect(selectedPlanApi[method](body)).rejects.toMatchObject({ status, message: unsupported })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe(method === 'plan' ? '/api/plan/selected' : '/api/summary/plan/selected')
  })

  it('preserves a server validation failure instead of inventing a successful result', async () => {
    respond({ error: 'Unknown selected assets: OTHER' }, 400)
    await expect(selectedPlanApi.plan(body)).rejects.toMatchObject({ status: 400, message: 'Unknown selected assets: OTHER' })
  })

  it.each(['plan', 'summary'] as const)('preserves the unknown-asset 404 from %s instead of calling it a missing deployment', async (method) => {
    const fetch = respond({ error: 'Unknown asset: GLD' }, 404)
    await expect(selectedPlanApi[method](body)).rejects.toMatchObject({ status: 404, message: 'Unknown asset: GLD' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    { monto: 999 }, { plazo_dias: 30 }, { perfil: 'agresivo' as const },
  ])('rejects valid-shaped results for different request metadata: %j', async (change) => {
    respond(mockSelectedPlan({ ...body, ...change }))
    await expect(selectedPlanApi.plan(body)).rejects.toThrow(mismatch)
  })

  it('rejects an automatic plan that includes an unselected classified or allocated asset', async () => {
    respond(mockSelectedPlan({ ...body, simbolos: ['SPY', 'AAPL'] }))
    await expect(selectedPlanApi.plan(body)).rejects.toThrow(mismatch)
  })

  it('requires every selected asset to appear in exactly one decision list, including non-holdings', async () => {
    const request = { ...body, simbolos: ['SPY', 'NVDA'] }
    const response = mockSelectedPlan(request)
    response.no_por_ahora = []
    respond(response)
    await expect(selectedPlanApi.plan(request)).rejects.toThrow(mismatch)
  })

  it('rejects duplicate classifications through the existing PlanResponse validator', async () => {
    const response = mockSelectedPlan(body)
    response.invertir.push({ ...response.invertir[0] })
    respond(response)
    await expect(selectedPlanApi.plan(body)).rejects.toThrow('incomplete investment plan')
  })

  it('keeps the existing response invariants for budgets and weights', async () => {
    const response = mockSelectedPlan(body)
    response.efectivo = 1
    respond(response)
    await expect(selectedPlanApi.plan(body)).rejects.toThrow('incomplete investment plan')
  })

  it('rejects a holding above the model allocation cap instead of resizing or overriding it', async () => {
    const response = mockSelectedPlan(body)
    expect(response.cartera[0].peso).toBe(0.6)
    response.invertir[0].fraccion = 0.5
    expect(parsePlan(response)).toBe(response)
    respond(response)
    await expect(selectedPlanApi.plan(body)).rejects.toThrow(mismatch)
  })

  it('validates summary text rather than accepting an incomplete response', async () => {
    respond({ texto: '', fuente: 'gemini' })
    await expect(selectedPlanApi.summary(body)).rejects.toThrow('incomplete summary')
  })

  it.each(['plan', 'summary'] as const)('cancels a pending %s request using the supplied signal', async (method) => {
    vi.stubGlobal('fetch', vi.fn((_path, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const controller = new AbortController()
    const request = selectedPlanApi[method](body, controller.signal)
    controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('does not issue a request after cancellation', async () => {
    const fetch = respond(mockSelectedPlan(body))
    const controller = new AbortController()
    controller.abort()
    await expect(selectedPlanApi.plan(body, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps network and timeout errors explicit without switching to samples', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(selectedPlanApi.plan(body)).rejects.toThrow('could not reach the service')
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_path, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const request = selectedPlanApi.plan(body)
    const assertion = expect(request).rejects.toThrow('longer than expected')
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
  })
})

describe('synthetic selected-plan examples', () => {
  it('uses a plainly labelled 60/40 example for two eligible selections without running an optimizer', () => {
    const before = structuredClone(body)
    const response = mockSelectedPlan(body)
    expect(parsePlan(response)).toBe(response)
    expect(response.cartera.map((asset) => [asset.simbolo, asset.peso, asset.monto])).toEqual([
      ['SPY', 0.6, 600], ['GLD', 0.4, 400],
    ])
    expect(response.resumen).toContain('Synthetic selected-plan example, not a real optimization.')
    expect(response.modelo).toBe('synthetic-selected-demo')
    expect(response.aviso).toContain('Synthetic sample data')
    expect(body).toEqual(before)
  })

  it('classifies only the exact selection and allocates only eligible assets', () => {
    const response = mockSelectedPlan({ ...body, simbolos: ['SPY', 'GLD', 'BTCUSDT', 'NVDA'] })
    expect(parsePlan(response)).toBe(response)
    expect(response.cartera.map((asset) => asset.simbolo)).toEqual(['SPY', 'GLD'])
    expect(response.esperar.map((asset) => asset.simbolo)).toEqual(['BTCUSDT'])
    expect(response.no_por_ahora.map((asset) => asset.simbolo)).toEqual(['NVDA'])
    expect([...response.invertir, ...response.esperar, ...response.no_por_ahora].map((asset) => asset.simbolo).sort())
      .toEqual(['BTCUSDT', 'GLD', 'NVDA', 'SPY'])
  })

  it('keeps the full original budget in cash when none of the selected assets is eligible', () => {
    const response = mockSelectedPlan({ ...body, simbolos: ['BTCUSDT', 'ETHUSDT', 'NVDA'] })
    expect(parsePlan(response)).toBe(response)
    expect(response.cartera).toEqual([])
    expect(response.efectivo).toBe(body.monto)
    expect(response.numeros.invertido).toBe(0)
    expect(response.numeros.peor_caso).toBe(0)
  })

  it('limits sample holdings to five while preserving every selected classification', () => {
    const response = mockSelectedPlan({ ...body, monto: 333.34, simbolos: ['SPY', 'GLD', 'AAPL', 'MSFT', 'VOO', 'QQQ'] })
    expect(parsePlan(response)).toBe(response)
    expect(response.cartera).toHaveLength(5)
    expect(response.invertir).toHaveLength(6)
    expect(response.invertir.at(-1)?.fuera_del_plan).toContain('Synthetic example')
    expect(response.cartera.reduce((sum, asset) => sum + asset.monto, 0) + response.efectivo).toBeCloseTo(333.34, 10)
    expect(response.numeros).toMatchObject({ monto: 333.34, plazo_dias: 37, perfil: 'moderado' })
  })

  it('switches both new routes to the isolated samples with the same mock flag and no network', async () => {
    source.mocks = true
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await selectedPlanApi.plan(body)).toEqual(mockSelectedPlan(body))
    expect(await selectedPlanApi.summary(body)).toMatchObject({ fuente: 'template', texto: expect.stringContaining('Synthetic selected-plan example') })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('honors cancellation in mock mode without showing a synthetic success', async () => {
    source.mocks = true
    const controller = new AbortController()
    const request = selectedPlanApi.plan(body, controller.signal)
    controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it.each([{ simbolos: [] }, { simbolos: ['SPY', 'SPY'] }, { simbolos: ['UNKNOWN'] }])('rejects invalid mock selections: %j', ({ simbolos }) => {
    expect(() => mockSelectedPlan({ ...body, simbolos })).toThrow()
  })
})
