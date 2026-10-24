import { ApiError } from './errors'
import type { AssetsResponse, DecideResponse, PricesResponse } from './types'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function invalid(subject: string): never {
  throw new ApiError('The service returned incomplete ' + subject + '. Please try again.')
}

export function parseAssets(value: unknown): AssetsResponse {
  if (!record(value) || Object.keys(value).length === 0) return invalid('asset information')
  let count = 0
  for (const group of Object.values(value)) {
    if (!Array.isArray(group)) return invalid('asset information')
    for (const asset of group) {
      if (!record(asset) || typeof asset.simbolo !== 'string' || !asset.simbolo ||
          typeof asset.nombre !== 'string' || !asset.nombre) return invalid('asset information')
      count += 1
    }
  }
  if (!count) return invalid('asset information')
  return value as AssetsResponse
}

export function parsePrices(value: unknown): PricesResponse {
  if (!record(value) || typeof value.simbolo !== 'string' || !strings(value.fechas) ||
      !value.fechas.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))) ||
      !Array.isArray(value.cierres) || !value.cierres.every(finite) ||
      value.fechas.length !== value.cierres.length) return invalid('price history')
  return value as unknown as PricesResponse
}

export function parseDecision(value: unknown): DecideResponse {
  if (!record(value) || typeof value.simbolo !== 'string' || typeof value.nombre !== 'string' ||
      !['INVERTIR', 'ESPERAR', 'NO_POR_AHORA'].includes(String(value.decision)) ||
      !strings(value.razones) || !strings(value.recomendaciones) ||
      typeof value.modelo !== 'string' || typeof value.aviso !== 'string' ||
      !record(value.numeros)) return invalid('analysis')
  const numbers = value.numeros
  const keys = ['monto', 'plazo_dias', 'rendimiento_esperado', 'volatilidad',
    'prob_perdida', 'senal', 'peor_caso', 'mejor_caso']
  if (!keys.every((key) => finite(numbers[key])) ||
      !['conservador', 'moderado', 'agresivo'].includes(String(numbers.perfil)) ||
      !strings(numbers.eventos)) return invalid('analysis')
  if (Number(numbers.monto) <= 0 || Number(numbers.plazo_dias) <= 0 ||
      Number(numbers.volatilidad) < 0 || Number(numbers.prob_perdida) < 0 ||
      Number(numbers.prob_perdida) > 1 || Number(numbers.peor_caso) > Number(numbers.mejor_caso)) {
    return invalid('analysis')
  }
  return value as unknown as DecideResponse
}
