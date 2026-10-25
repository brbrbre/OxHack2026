import { money } from '../lib/format'
import { ECB_REFERENCE_RATES } from './referenceRates'

export type CurrencyCode = 'USD' | 'MXN' | 'GBP' | 'EUR'

export interface CurrencyMetadata {
  readonly code: CurrencyCode
  readonly name: string
  readonly symbol: string
}

export const CURRENCIES: readonly CurrencyMetadata[] = Object.freeze([
  Object.freeze({ code: 'USD', name: 'US dollar', symbol: '$' }),
  Object.freeze({ code: 'MXN', name: 'Mexican peso', symbol: 'MX$' }),
  Object.freeze({ code: 'GBP', name: 'British pound', symbol: '£' }),
  Object.freeze({ code: 'EUR', name: 'Euro', symbol: '€' }),
])

const { perEuro } = ECB_REFERENCE_RATES

// All API amounts stay in USD. These factors only change their presentation.
export const ratesPerUsd: Readonly<Record<CurrencyCode, number>> = Object.freeze({
  USD: 1,
  MXN: perEuro.MXN / perEuro.USD,
  GBP: perEuro.GBP / perEuro.USD,
  EUR: perEuro.EUR / perEuro.USD,
})

export function fromUsd(value: number, currency: CurrencyCode): number {
  return value * ratesPerUsd[currency]
}

export function toUsd(value: number, currency: CurrencyCode): number {
  return value / ratesPerUsd[currency]
}

export function currencyName(currency: CurrencyCode): string {
  return CURRENCIES.find(({ code }) => code === currency)!.name
}

export function formatMoney(usdValue: number, currency: CurrencyCode, signed = false, locale = 'en-GB'): string {
  if (currency === 'USD' && (locale === 'en' || locale === 'en-GB')) return money(usdValue, signed)

  const value = fromUsd(usdValue, currency)
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value)
}

// For editable inputs only: preserve tiny budgets without rounding the stored USD amount.
export function formatLocalAmount(usdValue: number, currency: CurrencyCode): string {
  const value = fromUsd(usdValue, currency)
  return new Intl.NumberFormat('en-GB', {
    useGrouping: false,
    maximumFractionDigits: value !== 0 && Math.abs(value) < 0.01 ? 8 : 2,
  }).format(value)
}
