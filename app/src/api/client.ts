import { USE_MOCKS } from '../config'
import { ApiError } from './errors'
import { fetchJson } from './http'
import { parseAssets, parseDecision, parsePlan, parsePrices, parseSummary, parseAsk } from './validation'
import type { AskRequest, DecideRequest, PlanRequest } from './types'

async function request(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<unknown> {
  if (USE_MOCKS) {
    const { mockRequest } = await import('../mocks/handlers')
    return mockRequest(path, init, signal)
  }
  return fetchJson(path, init, signal)
}

export const api = {
  async getAssets(signal?: AbortSignal) {
    return parseAssets(await request('/api/assets', {}, signal))
  },

  async getPrices(symbol: string, days = 365, signal?: AbortSignal) {
    const response = parsePrices(
      await request('/api/prices/' + encodeURIComponent(symbol) + '?dias=' + days, {}, signal),
    )
    if (response.simbolo !== symbol) throw new ApiError('The service returned prices for a different asset.')
    return response
  },

  async decide(body: DecideRequest, signal?: AbortSignal) {
    const response = parseDecision(await request('/api/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, signal))
    if (response.simbolo !== body.simbolo || response.numeros.monto !== body.monto ||
        response.numeros.plazo_dias !== body.plazo_dias || response.numeros.perfil !== body.perfil) {
      throw new ApiError('The analysis did not match your plan. Please try again.')
    }
    return response
  },

  async summary(kind: 'decide' | 'plan', body: DecideRequest | PlanRequest, signal?: AbortSignal) {
    return parseSummary(await request('/api/summary/' + kind, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, signal))
  },

  /** MP3 from ElevenLabs, or null when the server has no audio (the app then uses the browser voice). */
  async listen(texto: string, signal?: AbortSignal): Promise<Blob | null> {
    if (USE_MOCKS) return null
    try {
      const response = await fetch('/api/listen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
        signal,
      })
      return response.ok && response.headers.get('content-type')?.startsWith('audio/') ? await response.blob() : null
    } catch {
      return null
    }
  },

  async ask(body: AskRequest, signal?: AbortSignal) {
    return parseAsk(await request('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, signal))
  },

  async plan(body: PlanRequest, signal?: AbortSignal) {
    const response = parsePlan(await request('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, signal))
    const groups = new Set(body.tipos)
    const assets = [...response.cartera, ...response.invertir, ...response.esperar, ...response.no_por_ahora]
    if (response.numeros.monto !== body.monto || response.numeros.plazo_dias !== body.plazo_dias ||
        response.numeros.perfil !== body.perfil || assets.some((asset) => !groups.has(asset.grupo))) {
      throw new ApiError('The investment plan did not match your request. Please try again.')
    }
    return response
  },
}
