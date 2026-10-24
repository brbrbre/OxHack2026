import { DEFAULT_NOTICE } from '../config'
import { ApiError } from '../api/errors'
import type { DecideRequest, DecideResponse } from '../api/types'
import { findAsset } from './assets'
import { PROFILE_LABELS } from '../lib/labels'

// These are illustrative fixtures, not investment rules or a financial model.
export const decisionFixtures: Record<'invest' | 'wait' | 'waitRisk' | 'notNow', DecideResponse> = {
  invest: {
    simbolo: 'SPY',
    nombre: 'S&P 500 (SPDR)',
    decision: 'INVERTIR',
    razones: [
      'Over 30 days the model expects +2.0%, with a 31% chance of loss.',
      'Likely range: -$45 to $85 on $1,000.',
      'The expected gain makes up for the risk for your profile.',
    ],
    recomendaciones: [],
    numeros: {
      monto: 1000, plazo_dias: 30, perfil: 'moderado',
      rendimiento_esperado: 0.02, volatilidad: 0.04, prob_perdida: 0.31,
      senal: 0.5, peor_caso: -45, mejor_caso: 85, eventos: [],
    },
    modelo: 'baseline',
    aviso: DEFAULT_NOTICE,
  },
  wait: {
    simbolo: 'BTCUSDT',
    nombre: 'Bitcoin',
    decision: 'ESPERAR',
    razones: [
      'Fed rate decision on 28 Oct. Prices often move more on that day.',
    ],
    recomendaciones: [
      'Check again after 28 Oct.',
    ],
    numeros: {
      monto: 1000, plazo_dias: 30, perfil: 'moderado',
      rendimiento_esperado: 0.012, volatilidad: 0.09, prob_perdida: 0.46,
      senal: 0.15, peor_caso: -125, mejor_caso: 149,
      eventos: ['Fed rate decision (2026-10-28)'],
    },
    modelo: 'baseline',
    aviso: DEFAULT_NOTICE,
  },
  waitRisk: {
    simbolo: 'ETHUSDT',
    nombre: 'Ethereum',
    decision: 'ESPERAR',
    razones: [
      'In a bad scenario you could lose $220 (-22.0%); your moderate profile accepts up to 10%.',
    ],
    recomendaciones: [
      'If you want to invest now, put in about $455 instead of $1,000.',
    ],
    numeros: {
      monto: 1000, plazo_dias: 30, perfil: 'moderado',
      rendimiento_esperado: 0.012, volatilidad: 0.09, prob_perdida: 0.46,
      senal: 0.15, peor_caso: -220, mejor_caso: 149, eventos: [],
    },
    modelo: 'baseline',
    aviso: DEFAULT_NOTICE,
  },
  notNow: {
    simbolo: 'NVDA',
    nombre: 'NVIDIA',
    decision: 'NO_POR_AHORA',
    razones: [
      'The model sees a higher chance of losing than gaining over this period.',
    ],
    recomendaciones: [
      'Check again in a few days, or try a longer period.',
    ],
    numeros: {
      monto: 1000, plazo_dias: 30, perfil: 'moderado',
      rendimiento_esperado: -0.018, volatilidad: 0.11, prob_perdida: 0.64,
      senal: -0.45, peor_caso: -170, mejor_caso: 80, eventos: [],
    },
    modelo: 'baseline',
    aviso: DEFAULT_NOTICE,
  },
}

function dollars(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(value)
}

export function mockDecision(body: DecideRequest): DecideResponse {
  const asset = findAsset(body.simbolo)
  if (!asset) throw new ApiError('Asset not found.', 404)
  const fixture = body.simbolo === 'BTCUSDT' ? decisionFixtures.wait
    : body.simbolo === 'ETHUSDT' ? decisionFixtures.waitRisk
    : body.simbolo === 'NVDA' ? decisionFixtures.notNow : decisionFixtures.invest
  const result = structuredClone(fixture)
  result.simbolo = asset.simbolo
  result.nombre = asset.nombre
  result.numeros = {
    ...result.numeros,
    monto: body.monto,
    plazo_dias: body.plazo_dias,
    perfil: body.perfil,
    peor_caso: Math.round(fixture.numeros.peor_caso * body.monto / 1000 * 100) / 100,
    mejor_caso: Math.round(fixture.numeros.mejor_caso * body.monto / 1000 * 100) / 100,
  }
  if (result.decision === 'INVERTIR') {
    result.razones[0] = 'Over ' + body.plazo_dias +
      ' days the model expects +2.0%, with a 31% chance of loss.'
    result.razones[1] = 'Likely range: ' + dollars(result.numeros.peor_caso) +
      ' to ' + dollars(result.numeros.mejor_caso) + ' on ' + dollars(body.monto) + '.'
  }
  if (fixture === decisionFixtures.waitRisk) {
    const loss = Math.abs(result.numeros.peor_caso)
    const lossPercent = (loss / body.monto * 100).toFixed(1)
    const profile = PROFILE_LABELS[body.perfil].toLowerCase()
    result.razones[0] = 'In a bad scenario you could lose ' + dollars(loss) + ' (-' + lossPercent + '%)' +
      (body.perfil === 'moderado' ? '; your ' + profile + ' profile accepts up to 10%.'
        : '. Review whether that fits your ' + profile + ' risk profile.')
    result.recomendaciones[0] = 'If you want to invest now, put in about ' +
      dollars(body.monto * 0.455) + ' instead of ' + dollars(body.monto) + '.'
  }
  return result
}
