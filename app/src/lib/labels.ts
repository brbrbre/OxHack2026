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
