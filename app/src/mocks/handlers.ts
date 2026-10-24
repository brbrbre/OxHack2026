import { ApiError } from '../api/errors'
import type { DecideRequest } from '../api/types'
import { HORIZONS } from '../config'
import { assets, findAsset } from './assets'
import { mockDecision } from './decisions'
import { mockPrices } from './prices'

async function delay(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request cancelled', 'AbortError'))
      return
    }
    const cancel = () => {
      clearTimeout(timer)
      reject(new DOMException('Request cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel)
      resolve()
    }, 350)
    signal?.addEventListener('abort', cancel, { once: true })
  })
}

export async function mockRequest(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<unknown> {
  await delay(signal)
  const url = new URL(path, 'http://mock.local')
  if (url.pathname === '/api/assets' && (!init.method || init.method === 'GET')) {
    return structuredClone(assets)
  }
  if (url.pathname.startsWith('/api/prices/') && (!init.method || init.method === 'GET')) {
    const symbol = decodeURIComponent(url.pathname.slice('/api/prices/'.length))
    const days = Number(url.searchParams.get('dias') ?? 365)
    if (!findAsset(symbol)) throw new ApiError('Asset not found.', 404)
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      throw new ApiError('The requested period is invalid.', 400)
    }
    return mockPrices(symbol, days)
  }
  if (url.pathname === '/api/decide' && init.method === 'POST') {
    let body: DecideRequest
    try { body = JSON.parse(String(init.body)) as DecideRequest }
    catch { throw new ApiError('The request is invalid.', 400) }
    if (!body || typeof body.simbolo !== 'string' || !Number.isFinite(body.monto) || body.monto <= 0 ||
        !HORIZONS.some((days) => days === body.plazo_dias) ||
        !['conservador', 'moderado', 'agresivo'].includes(body.perfil)) {
      throw new ApiError('Check the amount, period and risk profile.', 400)
    }
    return mockDecision(body)
  }
  throw new ApiError('The requested resource was not found.', 404)
}
