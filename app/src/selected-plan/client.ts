import { ApiError } from '../api/errors'
import { fetchJson } from '../api/http'
import type { PlanResponse, RiskProfile } from '../api/types'
import { parsePlan, parseSummary } from '../api/validation'
import { USE_MOCKS } from '../config'

export interface SelectedPlanRequest {
  simbolos: string[]
  monto: number
  plazo_dias: number
  perfil: RiskProfile
}

const PLAN_PATH = '/api/plan/selected'
const SUMMARY_PATH = '/api/summary/plan/selected'
const UNAVAILABLE = 'This feature needs the updated server. Ask the team to deploy the selected-assets API.'
const MISMATCH = 'The selected investment plan did not match your request. Please try again.'

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
}

async function request(path: typeof PLAN_PATH | typeof SUMMARY_PATH, body: SelectedPlanRequest, signal?: AbortSignal): Promise<unknown> {
  checkAbort(signal)
  if (USE_MOCKS) {
    const mocks = await import('./mocks')
    checkAbort(signal)
    return path === PLAN_PATH ? mocks.mockSelectedPlan(body) : mocks.mockSelectedSummary(body)
  }
  try {
    const response = await fetchJson(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, signal)
    checkAbort(signal)
    return response
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405) && !error.message.startsWith('Unknown asset:')) {
      throw new ApiError(UNAVAILABLE, error.status)
    }
    throw error
  }
}

function checkSelection(response: PlanResponse, body: SelectedPlanRequest): PlanResponse {
  const selection = new Set(body.simbolos)
  const classified = [...response.invertir, ...response.esperar, ...response.no_por_ahora]
  const exceedsModelCap = response.cartera.some((holding) => {
    const candidate = response.invertir.find((asset) => asset.simbolo === holding.simbolo)
    return !candidate || holding.peso > candidate.fraccion + 1e-9
  })
  if (selection.size === 0 || selection.size !== body.simbolos.length ||
      response.numeros.monto !== body.monto || response.numeros.plazo_dias !== body.plazo_dias ||
      response.numeros.perfil !== body.perfil || classified.length !== selection.size ||
      [...classified, ...response.cartera].some((asset) => !selection.has(asset.simbolo)) || exceedsModelCap) {
    throw new ApiError(MISMATCH)
  }
  return response
}

// Separate routes: never widen a selected universe to the automatic category plan.
export const selectedPlanApi = {
  async plan(body: SelectedPlanRequest, signal?: AbortSignal) {
    return checkSelection(parsePlan(await request(PLAN_PATH, body, signal)), body)
  },
  async summary(body: SelectedPlanRequest, signal?: AbortSignal) {
    return parseSummary(await request(SUMMARY_PATH, body, signal))
  },
}
