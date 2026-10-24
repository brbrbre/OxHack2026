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
  fraccion: number
  monto_sugerido: number
  tendencia_12m: number | null
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

export interface PlanRequest {
  monto: number
  plazo_dias: number
  perfil: RiskProfile
  tipos: string[]
}

export interface PlanAllocation {
  simbolo: string
  nombre: string
  grupo: string
  peso: number
  monto: number
}

export interface PlanAssetDecision {
  simbolo: string
  nombre: string
  grupo: string
  razon: string
  fraccion: number
  /** Only in `invertir`: null if the asset is in the plan, otherwise why it was left out. */
  fuera_del_plan?: string | null
}

export interface PlanNumbers {
  monto: number
  plazo_dias: number
  perfil: RiskProfile
  invertido: number
  rendimiento_esperado: number
  volatilidad: number
  peor_caso: number
  tolerancia: number
}

export interface PlanResponse {
  cartera: PlanAllocation[]
  efectivo: number
  invertir: PlanAssetDecision[]
  esperar: PlanAssetDecision[]
  no_por_ahora: PlanAssetDecision[]
  resumen: string
  numeros: PlanNumbers
  modelo: string
  aviso: string
}

export interface ApiErrorResponse {
  error: string
}

/** Plain-language summary. Gemini only rewrites the numbers above; "template" is the local fallback. */
export interface SummaryResponse {
  texto: string
  fuente: 'gemini' | 'template'
}

export interface AskTurn {
  pregunta: string
  respuesta: string
}

export interface AskRequest {
  pregunta: string
  simbolo?: string
  contexto?: Record<string, unknown>
  historial?: AskTurn[]
}

/** "gemini": tutor answer. "local": our fact sheet while Gemini is offline. "offline": no answer. */
export interface AskResponse {
  respuesta: string
  fuente: 'gemini' | 'local' | 'offline'
}

export interface RemindRequest {
  telefono: string
  consentimiento: boolean
  simbolo: string
  monto: number
  plazo_dias: number
  perfil: RiskProfile
}

/** Reminder state: pendiente -> enviado (WhatsApp) -> abierto (link opened) or llamado (phone call). */
export interface HabitStatus {
  token: string
  vence: string
  estado: 'pendiente' | 'enviado' | 'abierto' | 'llamado' | 'error'
  enviado_en: string | null
  abierto_en: string | null
  llamado_en: string | null
  error: string | null
  simbolo: string
  plazo_dias: number
  demo: boolean
}
