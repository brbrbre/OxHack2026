import { ApiError } from '../api/errors'
import type { PlanAssetDecision, PlanResponse, SummaryResponse } from '../api/types'
import { DEFAULT_NOTICE } from '../config'
import { assets, findAsset } from '../mocks/assets'
import { mockDecision } from '../mocks/decisions'
import type { SelectedPlanRequest } from './client'

const TOLERANCE = { conservador: 0.05, moderado: 0.1, agresivo: 0.2 }
const EXAMPLE_WEIGHTS: Record<number, number[]> = {
  1: [1], 2: [0.6, 0.4], 3: [0.5, 0.3, 0.2], 4: [0.4, 0.3, 0.2, 0.1], 5: [0.3, 0.25, 0.2, 0.15, 0.1],
}

function checkRequest(body: SelectedPlanRequest) {
  if (!body || !Array.isArray(body.simbolos) || !body.simbolos.length ||
      !body.simbolos.every((symbol) => typeof symbol === 'string' && symbol.length > 0) ||
      new Set(body.simbolos).size !== body.simbolos.length ||
      !Number.isFinite(body.monto) || body.monto <= 0 || body.monto > 1e9 ||
      !Number.isInteger(body.plazo_dias) || body.plazo_dias < 1 || body.plazo_dias > 730 ||
      !Object.hasOwn(TOLERANCE, body.perfil)) {
    throw new ApiError('Check the selected assets, amount, period and risk profile.', 400)
  }
  const unknown = body.simbolos.filter((symbol) => !findAsset(symbol))
  if (unknown.length) throw new ApiError('Unknown asset: ' + unknown[0], 404)
}

/** Deterministic UI examples only. No optimizer, covariance or model is run. */
export function mockSelectedPlan(body: SelectedPlanRequest): PlanResponse {
  checkRequest(body)
  const invertir: PlanAssetDecision[] = []
  const esperar: PlanAssetDecision[] = []
  const noPorAhora: PlanAssetDecision[] = []
  for (const symbol of body.simbolos) {
    const asset = findAsset(symbol)!
    const group = Object.entries(assets).find(([, items]) => items.some((item) => item.simbolo === symbol))![0]
    const decision = mockDecision({ ...body, simbolo: symbol })
    const candidate: PlanAssetDecision = {
      ...asset, grupo: group, fraccion: decision.numeros.fraccion,
      razon: 'Synthetic example: ' + (decision.razones.at(-1) ?? 'No real model was run.'),
    }
    if (decision.decision === 'INVERTIR') invertir.push(candidate)
    else if (decision.decision === 'ESPERAR') esperar.push(candidate)
    else noPorAhora.push(candidate)
  }

  const chosen = invertir.slice(0, 5)
  const weights = EXAMPLE_WEIGHTS[chosen.length] ?? []
  let allocated = 0
  const cartera = chosen.map((asset, index) => {
    const amount = index === chosen.length - 1 ? body.monto - allocated : body.monto * weights[index]
    allocated += amount
    return { simbolo: asset.simbolo, nombre: asset.nombre, grupo: asset.grupo, monto: amount, peso: amount / body.monto }
  })
  for (const asset of invertir) asset.fuera_del_plan = chosen.includes(asset) ? null
    : 'Synthetic example: this sample holds up to five eligible assets.'
  const cash = cartera.length ? 0 : body.monto
  const tolerance = TOLERANCE[body.perfil]
  return {
    cartera, efectivo: cash, invertir, esperar, no_por_ahora: noPorAhora,
    resumen: 'Synthetic selected-plan example, not a real optimization. Only your selected assets are considered. ' +
      (cartera.length ? 'Illustrative weights are preset for this demo.' : 'No selected assets are eligible in this example; the budget stays in cash.'),
    numeros: {
      monto: body.monto, plazo_dias: body.plazo_dias, perfil: body.perfil, invertido: allocated,
      rendimiento_esperado: cartera.length ? 0.02 : 0, volatilidad: cartera.length ? 0.04 : 0,
      peor_caso: cartera.length ? -body.monto * tolerance * 0.6 : 0, tolerancia: tolerance,
    },
    modelo: 'synthetic-selected-demo',
    aviso: DEFAULT_NOTICE + ' Synthetic sample data; no real optimization was run.',
  }
}

export function mockSelectedSummary(body: SelectedPlanRequest): SummaryResponse {
  const plan = mockSelectedPlan(body)
  return { texto: plan.resumen + ' This example covers ' + body.plazo_dias + ' days.', fuente: 'template' }
}
