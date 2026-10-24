import type { PlanAssetDecision, PlanRequest, PlanResponse } from '../api/types'
import { DEFAULT_NOTICE } from '../config'
import { PROFILE_LABELS } from '../lib/labels'
import { assets } from './assets'
import { mockDecision } from './decisions'

const tolerances = { conservador: 0.05, moderado: 0.1, agresivo: 0.2 }
const illustrativeInvestment = { conservador: 0.6, moderado: 0.9, agresivo: 1 }

function dollars(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(value)
}

// Synthetic examples for exercising the API contract, not a portfolio model.
export function mockPlan(body: PlanRequest): PlanResponse {
  const invertir: PlanAssetDecision[] = []
  const esperar: PlanAssetDecision[] = []
  const noPorAhora: PlanAssetDecision[] = []
  const groups = Object.keys(assets).filter((group) => body.tipos.includes(group))
  for (const group of groups) {
    for (const asset of assets[group]) {
      const result = mockDecision({ ...body, simbolo: asset.simbolo })
      const item: PlanAssetDecision = {
        ...asset, grupo: group,
        razon: result.razones.at(-1) ?? '',
        fraccion: result.numeros.fraccion,
      }
      if (result.decision === 'INVERTIR') invertir.push(item)
      else if (result.decision === 'ESPERAR') esperar.push(item)
      else noPorAhora.push(item)
    }
  }

  // Round-robin selection provides varied examples across the chosen groups.
  // SPY and VOO are not held together in these preset examples.
  const queues = groups.map((group) => invertir.filter((asset) => asset.grupo === group))
  const selected: PlanAssetDecision[] = []
  while (selected.length < 5 && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      if (selected.length === 5) break
      let candidate = queue.shift()
      while (candidate && ['SPY', 'VOO'].includes(candidate.simbolo) &&
             selected.some((asset) => ['SPY', 'VOO'].includes(asset.simbolo))) {
        candidate = queue.shift()
      }
      if (candidate) selected.push(candidate)
    }
  }

  const investedWeight = Math.min(illustrativeInvestment[body.perfil], selected.length * 0.4)
  const weight = selected.length ? investedWeight / selected.length : 0
  const cartera = selected.map((asset) => ({
    simbolo: asset.simbolo, nombre: asset.nombre, grupo: asset.grupo,
    peso: weight, monto: body.monto * weight,
  }))
  const invested = cartera.reduce((sum, asset) => sum + asset.monto, 0)
  const tolerance = tolerances[body.perfil]
  const worstCase = -body.monto * tolerance * 0.642 * investedWeight / 0.9
  const cash = body.monto - invested
  const profile = PROFILE_LABELS[body.perfil].toLowerCase()
  const parts = cartera.map((asset) => dollars(asset.monto) + ' in ' + asset.nombre).join(', ')
  return {
    cartera,
    efectivo: cash,
    invertir,
    esperar,
    no_por_ahora: noPorAhora,
    resumen: 'For ' + body.plazo_dias + ' days with a ' + profile + ' profile: ' + parts +
      '. Keep ' + dollars(cash) + ' in cash. In a bad scenario the plan could lose about ' +
      dollars(-worstCase) + ' (' + (worstCase / body.monto * 100).toFixed(1) +
      '%); your profile accepts up to ' + (tolerance * 100).toFixed(0) + '%.',
    numeros: {
      monto: body.monto, plazo_dias: body.plazo_dias, perfil: body.perfil,
      invertido: invested, rendimiento_esperado: 0.057 * investedWeight / 0.9,
      volatilidad: 0.08 * investedWeight / 0.9, peor_caso: worstCase, tolerancia: tolerance,
    },
    modelo: 'baseline',
    aviso: DEFAULT_NOTICE,
  }
}

const sample = mockPlan({
  monto: 5000, plazo_dias: 90, perfil: 'moderado', tipos: ['ETFs', 'US stocks', 'Crypto'],
})

const allCash: PlanResponse = {
  ...structuredClone(sample),
  cartera: [],
  efectivo: 5000,
  invertir: [],
  esperar: [],
  no_por_ahora: [...sample.invertir, ...sample.esperar, ...sample.no_por_ahora].map((asset) => ({
    ...asset, fraccion: 0,
    razon: 'The model sees a higher chance of losing than gaining over this period.',
  })),
  resumen: 'For 90 days with a moderate profile, none of the selected assets looks good right now. ' +
    'Keep the $5,000 in cash and check again later.',
  numeros: {
    ...sample.numeros, invertido: 0, rendimiento_esperado: 0, volatilidad: 0, peor_caso: 0,
  },
}

export const planFixtures = { sample, allCash }
