import type { Decision, RiskProfile } from '../api/types'

// Wire codes stay unchanged; only their presentation labels are translated here.
export const DECISION_LABELS = {
  INVERTIR: 'INVEST',
  ESPERAR: 'WAIT',
  NO_POR_AHORA: 'NOT NOW',
} as const satisfies Record<Decision, string>

export const PROFILE_LABELS = {
  conservador: 'Conservative',
  moderado: 'Moderate',
  agresivo: 'Aggressive',
} as const satisfies Record<RiskProfile, string>
