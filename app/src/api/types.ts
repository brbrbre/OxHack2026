export interface Asset {
  simbolo: string
  nombre: string
}

export type AssetsResponse = Record<string, Asset[]>
export type RiskProfile = 'conservador' | 'moderado' | 'agresivo'
export type Decision = 'INVERTIR' | 'ESPERAR' | 'NO_POR_AHORA'

export interface PricesResponse {
  simbolo: string
  fechas: string[]
  cierres: number[]
}

export interface DecideRequest {
  simbolo: string
  monto: number
  plazo_dias: number
  perfil: RiskProfile
}

export interface DecisionNumbers {
  monto: number
  plazo_dias: number
  perfil: RiskProfile
  rendimiento_esperado: number
  volatilidad: number
  prob_perdida: number
  senal: number
  peor_caso: number
  mejor_caso: number
  eventos: string[]
}

export interface DecideResponse {
  simbolo: string
  nombre: string
  decision: Decision
  razones: string[]
  recomendaciones: string[]
  numeros: DecisionNumbers
  modelo: string
  aviso: string
}

export interface ApiErrorResponse {
  error: string
}
