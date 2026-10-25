import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { messages } from './locales'
import type { Locale } from './types'

export type { Locale } from './types'
export const LOCALES: readonly { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es-419', label: 'Español (Latinoamérica)' },
  { value: 'zh-CN', label: '中文（简体）' },
  { value: 'fr', label: 'Français' },
  { value: 'it', label: 'Italiano' },
]
export const LANGUAGE_STORAGE_KEY = 'horizon-language'
type Values = Record<string, string | number>
export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((item) => item.value === value)
}
export function translate(locale: Locale, source: string, values: Values = {}): string {
  const translated = Object.prototype.hasOwnProperty.call(messages[locale], source) ? messages[locale][source] : source
  return translated.replace(/\{([^{}]+)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder)
}

export function localizedDate(locale: Locale, value: string, long = false): string {
  const date = new Date(value + 'T12:00:00Z')
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    day: long ? 'numeric' : undefined, month: 'short', year: long ? 'numeric' : undefined, timeZone: 'UTC',
  }).format(date)
}

export function localizedPercentage(locale: Locale, value: number, signed = false): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale, {
    style: 'percent', maximumFractionDigits: 1, signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value)
}

interface I18nValue {
  locale: Locale
  setLocale: (value: Locale) => void
  t: (source: string, values?: Values) => string
  dateLabel: (value: string, long?: boolean) => string
  percentage: (value: number, signed?: boolean) => string
}
const I18nContext = createContext<I18nValue>({
  locale: 'en', setLocale: () => {}, t: (source, values) => translate('en', source, values),
  dateLabel: (value, long) => localizedDate('en', value, long),
  percentage: (value, signed) => localizedPercentage('en', value, signed),
})

function initialLanguage(explicit?: Locale): Locale {
  if (explicit) return explicit
  try {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (isLocale(saved)) return saved
    }
  } catch { /* Browser privacy settings can disable storage. */ }
  return 'en'
}

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLanguage(initialLocale))
  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return
    setLocaleState(next)
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch { /* Language switching still works when storage is unavailable. */ }
  }, [])
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale
  }, [locale])
  // Keep this page's choice through navigation; other tabs must not change it.
  // A fresh load restores the last explicit choice, or English when none exists.
  const t = useCallback((source: string, values?: Values) => translate(locale, source, values), [locale])
  const dateLabel = useCallback((value: string, long?: boolean) => localizedDate(locale, value, long), [locale])
  const percentage = useCallback((value: number, signed?: boolean) => localizedPercentage(locale, value, signed), [locale])
  const context = useMemo(() => ({ locale, setLocale, t, dateLabel, percentage }), [locale, setLocale, t, dateLabel, percentage])
  return <I18nContext.Provider value={context}>{children}</I18nContext.Provider>
}

export function useI18n() { return useContext(I18nContext) }
