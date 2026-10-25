export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

export const DEFAULT_NOTICE =
  'Educational prototype, not financial advice. Data: Yahoo Finance, Binance.'

export const HORIZON_RANGE = { min: 1, max: 60, step: 1 } as const
export const DEFAULT_HORIZON_DAYS = 30
export const LEGACY_HORIZONS = [90, 180, 365] as const

// Historical horizons remain available to saved plans and their projections.
// New controls use HORIZON_RANGE, never this former button list.
export const HORIZONS = [7, 30, ...LEGACY_HORIZONS] as const

export function isNewHorizon(days: number): boolean {
  return Number.isInteger(days) && days >= HORIZON_RANGE.min && days <= HORIZON_RANGE.max
}

export function isSupportedHorizon(days: number): boolean {
  return isNewHorizon(days) || (LEGACY_HORIZONS as readonly number[]).includes(days)
}
