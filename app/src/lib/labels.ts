import type { Decision, RiskProfile } from '../api/types'

// Wire codes stay unchanged; only their presentation labels are translated here.
export const DECISION_LABELS = {
  INVERTIR: 'Invest',
  ESPERAR: 'Wait',
  NO_POR_AHORA: 'Not now',
} as const satisfies Record<Decision, string>

export const PROFILE_LABELS = {
  conservador: 'Conservative',
  moderado: 'Moderate',
  agresivo: 'Aggressive',
} as const satisfies Record<RiskProfile, string>

/** Display names for the prediction models; the API sends their internal ids. */
const MODEL_LABELS: Record<string, string> = {
  'tendencia-tda': 'Trend + TDA',
  xgboost: 'XGBoost',
}

export function modelLabel(id: string): string {
  return MODEL_LABELS[id] ?? id
}
