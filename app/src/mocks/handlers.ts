import { ApiError } from '../api/errors'
import type { DecideRequest, PlanRequest } from '../api/types'
import { assets, findAsset } from './assets'
import { mockDecision } from './decisions'
import { mockPrices } from './prices'
import { mockPlan } from './plan'

function validInvestment(body: DecideRequest | PlanRequest): boolean {
  return Number.isFinite(body.monto) && body.monto > 0 && body.monto <= 1e9 &&
    Number.isInteger(body.plazo_dias) && body.plazo_dias >= 1 && body.plazo_dias <= 730 &&
    ['conservador', 'moderado', 'agresivo'].includes(body.perfil)
}

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
    if (!Number.isInteger(days) || days < 1 || days > 10950) {
      throw new ApiError('The requested period is invalid.', 400)
    }
    return mockPrices(symbol, days)
  }
  if (url.pathname === '/api/decide' && init.method === 'POST') {
    let body: DecideRequest
    try { body = JSON.parse(String(init.body)) as DecideRequest }
    catch { throw new ApiError('The request is invalid.', 400) }
    if (!body || typeof body.simbolo !== 'string' || !validInvestment(body)) {
      throw new ApiError('Check the amount, period and risk profile.', 400)
    }
    return mockDecision(body)
  }
  if (url.pathname === '/api/plan' && init.method === 'POST') {
    let body: PlanRequest
    try { body = JSON.parse(String(init.body)) as PlanRequest }
    catch { throw new ApiError('The request is invalid.', 400) }
    if (!body || !validInvestment(body) || !Array.isArray(body.tipos) || !body.tipos.length ||
        !body.tipos.every((type) => typeof type === 'string')) {
      throw new ApiError('Check the amount, period, risk profile and asset types.', 400)
    }
    const unknown = body.tipos.filter((type) => !Object.hasOwn(assets, type))
    if (unknown.length) throw new ApiError('Unknown asset types: ' + unknown.join(', '), 400)
    return mockPlan(body)
  }
  throw new ApiError('The requested resource was not found.', 404)
}
