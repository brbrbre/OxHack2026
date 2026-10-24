import { describe, expect, it } from 'vitest'
import { money } from '../lib/format'
import { CURRENCIES, currencyName, formatLocalAmount, formatMoney, fromUsd, ratesPerUsd, toUsd } from './currency'
import type { CurrencyCode } from './currency'
import { ECB_REFERENCE_RATES } from './referenceRates'

const codes: CurrencyCode[] = ['USD', 'MXN', 'GBP', 'EUR']

describe('dated reference currency conversion', () => {
  it('keeps the official snapshot, source and derived factors immutable', () => {
    expect(ECB_REFERENCE_RATES).toMatchObject({
      date: '2026-10-23', base: 'EUR', source: 'European Central Bank',
      perEuro: { USD: 1.1193, MXN: 21.0226, GBP: 0.83728, EUR: 1 },
    })
    expect(ECB_REFERENCE_RATES.sourceUrl).toMatch(/^https:\/\/www\.ecb\.europa\.eu\//)
    expect(Object.isFrozen(ECB_REFERENCE_RATES)).toBe(true)
    expect(Object.isFrozen(ECB_REFERENCE_RATES.perEuro)).toBe(true)
    expect(Object.isFrozen(ratesPerUsd)).toBe(true)
  })

  it('uses each ECB quote in the correct direction with USD as the API base', () => {
    expect(fromUsd(1.1193, 'EUR')).toBeCloseTo(1, 12)
    expect(fromUsd(1.1193, 'GBP')).toBeCloseTo(0.83728, 12)
    expect(fromUsd(1.1193, 'MXN')).toBeCloseTo(21.0226, 12)
    expect(toUsd(1, 'EUR')).toBeCloseTo(1.1193, 12)
    expect(toUsd(0.83728, 'GBP')).toBeCloseTo(1.1193, 12)
    expect(toUsd(21.0226, 'MXN')).toBeCloseTo(1.1193, 12)
    expect(fromUsd(100, 'MXN')).toBeGreaterThan(100)
    expect(fromUsd(100, 'GBP')).toBeLessThan(100)
    expect(fromUsd(100, 'EUR')).toBeLessThan(100)
  })

  it.each(codes)('preserves the same budget when converting %s back to USD', (code) => {
    for (const usd of [0, 0.0001, 45.75, 1000, 1_000_000_000]) {
      expect(toUsd(fromUsd(usd, code), code)).toBeCloseTo(usd, 6)
    }
  })

  it.each(codes)('preserves negative profit or loss in %s', (code) => {
    const loss = fromUsd(-45, code)
    expect(loss).toBeLessThan(0)
    expect(toUsd(loss, code)).toBeCloseTo(-45, 12)
    expect(formatMoney(-45, code, true)).toMatch(/^-/)
    expect(formatMoney(45, code, true)).toMatch(/^\+/)
  })

  it('does not round a small peso budget to zero USD before submitting it', () => {
    const usd = toUsd(0.01, 'MXN')
    expect(usd).toBeGreaterThan(0)
    expect(usd).toBeLessThan(0.01)
    expect(fromUsd(usd, 'MXN')).toBeCloseTo(0.01, 12)
    expect(formatLocalAmount(usd, 'MXN')).toBe('0.01')
    expect(Number(formatLocalAmount(usd, 'USD'))).toBeGreaterThan(0)
    expect(Number(formatLocalAmount(usd, 'GBP'))).toBeGreaterThan(0)
    expect(Number(formatLocalAmount(usd, 'EUR'))).toBeGreaterThan(0)
  })

  it('allows the API maximum USD budget to be expressed as a larger peso number', () => {
    const local = fromUsd(1_000_000_000, 'MXN')
    expect(local).toBeGreaterThan(1_000_000_000)
    expect(toUsd(local, 'MXN')).toBeCloseTo(1_000_000_000, 6)
    expect(formatLocalAmount(1_000_000_000, 'MXN')).toMatch(/^\d+\.\d{2}$/)
  })
})

describe('budget currency presentation', () => {
  it('provides the same four clearly named choices without ambiguous dollar symbols', () => {
    expect(CURRENCIES.map(({ code }) => code)).toEqual(codes)
    expect(CURRENCIES.map(({ symbol }) => symbol)).toEqual(['$', 'MX$', '£', '€'])
    expect(codes.map(currencyName)).toEqual(['US dollar', 'Mexican peso', 'British pound', 'Euro'])
  })

  it.each([
    ['USD', '$1,000'], ['MXN', 'MX$18,781.92'], ['GBP', '£748.04'], ['EUR', '€893.42'],
  ] as const)('formats the USD budget once in %s', (code, expected) => {
    expect(formatMoney(1000, code)).toBe(expected)
  })

  it('keeps the existing USD display exactly, including optional signs and decimal rules', () => {
    for (const value of [0, 1000, 1000.5, -45, -45.25, 0.001]) {
      expect(formatMoney(value, 'USD')).toBe(money(value))
      expect(formatMoney(value, 'USD', true)).toBe(money(value, true))
    }
    expect(formatMoney(1000.5, 'USD')).toBe('$1,000.50')
    expect(formatMoney(0, 'USD', true)).toBe('$0')
  })

  it('formats editable amounts without grouping or currency symbols and only rounds their display', () => {
    expect(formatLocalAmount(1000, 'USD')).toBe('1000')
    expect(formatLocalAmount(1000.5, 'USD')).toBe('1000.5')
    expect(formatLocalAmount(1000, 'MXN')).toBe('18781.92')
    expect(formatLocalAmount(1000, 'GBP')).toBe('748.04')
    expect(formatLocalAmount(1000, 'EUR')).toBe('893.42')
    expect(fromUsd(1000, 'GBP')).not.toBe(748.04)
  })
})
