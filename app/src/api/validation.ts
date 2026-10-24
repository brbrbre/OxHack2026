import { ApiError } from './errors'
import type { AssetsResponse, DecideResponse, PlanAllocation, PlanAssetDecision, PlanResponse, PricesResponse, SummaryResponse, AskResponse } from './types'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function fraction(value: unknown): value is number {
  return finite(value) && value >= 0 && value <= 1
}

function sameMoney(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(0.01, Math.abs(left) * 1e-12, Math.abs(right) * 1e-12)
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
    'prob_perdida', 'senal', 'peor_caso', 'mejor_caso', 'monto_sugerido']
  if (!keys.every((key) => finite(numbers[key])) ||
      !['conservador', 'moderado', 'agresivo'].includes(String(numbers.perfil)) ||
      !fraction(numbers.fraccion) ||
      !(numbers.tendencia_12m === null || finite(numbers.tendencia_12m)) ||
      !strings(numbers.eventos)) return invalid('analysis')
  if (Number(numbers.monto) <= 0 || !Number.isInteger(numbers.plazo_dias) || Number(numbers.plazo_dias) <= 0 ||
      Number(numbers.volatilidad) < 0 || Number(numbers.prob_perdida) < 0 ||
      Number(numbers.prob_perdida) > 1 || Number(numbers.peor_caso) > Number(numbers.mejor_caso) ||
      Number(numbers.monto_sugerido) < 0 || Number(numbers.monto_sugerido) > Number(numbers.monto) ||
      !sameMoney(Number(numbers.monto_sugerido), Number(numbers.monto) * numbers.fraccion)) {
    return invalid('analysis')
  }
  return value as unknown as DecideResponse
}

function planAsset(value: unknown): value is PlanAssetDecision {
  return record(value) && typeof value.simbolo === 'string' && value.simbolo.length > 0 &&
    typeof value.nombre === 'string' && value.nombre.length > 0 &&
    typeof value.grupo === 'string' && value.grupo.length > 0 &&
    typeof value.razon === 'string' && fraction(value.fraccion) &&
    (value.fuera_del_plan === undefined || value.fuera_del_plan === null || typeof value.fuera_del_plan === 'string')
}

function allocation(value: unknown): value is PlanAllocation {
  return record(value) && typeof value.simbolo === 'string' && value.simbolo.length > 0 &&
    typeof value.nombre === 'string' && value.nombre.length > 0 &&
    typeof value.grupo === 'string' && value.grupo.length > 0 &&
    fraction(value.peso) && value.peso > 0 &&
    finite(value.monto) && value.monto > 0
}

export function parsePlan(value: unknown): PlanResponse {
  if (!record(value) || !record(value.numeros) ||
      !Array.isArray(value.cartera) || value.cartera.length > 5 || !value.cartera.every(allocation) ||
      !Array.isArray(value.invertir) || !value.invertir.every(planAsset) ||
      !Array.isArray(value.esperar) || !value.esperar.every(planAsset) ||
      !Array.isArray(value.no_por_ahora) || !value.no_por_ahora.every(planAsset) ||
      !finite(value.efectivo) || typeof value.resumen !== 'string' ||
      typeof value.modelo !== 'string' || typeof value.aviso !== 'string') return invalid('investment plan')

  const numbers = value.numeros
  const keys = ['monto', 'plazo_dias', 'invertido', 'rendimiento_esperado',
    'volatilidad', 'peor_caso', 'tolerancia']
  if (!keys.every((key) => finite(numbers[key])) ||
      !['conservador', 'moderado', 'agresivo'].includes(String(numbers.perfil)) ||
      Number(numbers.monto) <= 0 || !Number.isInteger(numbers.plazo_dias) || Number(numbers.plazo_dias) <= 0 ||
      Number(numbers.invertido) < 0 || Number(numbers.volatilidad) < 0 || !fraction(numbers.tolerancia) ||
      (value.efectivo < 0 && !sameMoney(value.efectivo, 0))) return invalid('investment plan')

  const classified = [...value.invertir, ...value.esperar, ...value.no_por_ahora]
  const investCandidates = value.invertir
  const symbols = classified.map((asset) => asset.simbolo)
  const allocatedSymbols = value.cartera.map((asset) => asset.simbolo)
  const invested = value.cartera.reduce((total, asset) => total + asset.monto, 0)
  if (new Set(symbols).size !== symbols.length || new Set(allocatedSymbols).size !== allocatedSymbols.length ||
      !sameMoney(invested, Number(numbers.invertido)) ||
      !sameMoney(Number(numbers.invertido) + value.efectivo, Number(numbers.monto)) ||
      value.cartera.some((asset, index, portfolio) =>
        !sameMoney(asset.monto, Number(numbers.monto) * asset.peso) ||
        (index > 0 && asset.peso > portfolio[index - 1].peso + 1e-9) ||
        !investCandidates.some((candidate) => candidate.simbolo === asset.simbolo && candidate.grupo === asset.grupo))) {
    return invalid('investment plan')
  }
  return value as unknown as PlanResponse
}

export function parseSummary(value: unknown): SummaryResponse {
  if (!record(value) || typeof value.texto !== 'string' || value.texto.trim() === '' ||
      (value.fuente !== 'gemini' && value.fuente !== 'template')) return invalid('summary')
  return { texto: value.texto, fuente: value.fuente }
}

export function parseAsk(value: unknown): AskResponse {
  if (!record(value) || typeof value.respuesta !== 'string' || value.respuesta.trim() === '' ||
      !['gemini', 'local', 'offline'].includes(String(value.fuente))) return invalid('answer')
  return { respuesta: value.respuesta, fuente: value.fuente as AskResponse['fuente'] }
}
