import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, LANGUAGE_STORAGE_KEY, LOCALES, isLocale, localizedDate, localizedPercentage, translate, useI18n } from './I18nContext'
import type { Locale } from './I18nContext'
import { messages } from './locales'
import { FRONTEND_ERROR_MESSAGES, localizeKnownError } from './errors'
import PlannerEntry from '../components/PlannerEntry'
import InvestmentForm from '../components/InvestmentForm'
import GuidedPlanner from '../components/GuidedPlanner'
import ErrorMessage from '../components/ErrorMessage'
import SelectedAssetResults from '../components/SelectedAssetResults'
import { decisionFixtures } from '../mocks/decisions'

function localize(locale: Locale, children: ReactNode) {
  return renderToStaticMarkup(createElement(I18nProvider, { initialLocale: locale, children }))
}

function Probe() {
  const { locale, t } = useI18n()
  return createElement('span', { 'data-locale': locale }, t('Your plan'))
}

afterEach(() => vi.unstubAllGlobals())

describe('language preferences', () => {
  it('offers the five requested languages with their own names', () => {
    expect(LOCALES.map(({ value }) => value)).toEqual(['en', 'es-419', 'zh-CN', 'fr', 'it'])
    expect(LOCALES.map(({ label }) => label)).toEqual(['English', 'Español (Latinoamérica)', '中文（简体）', 'Français', 'Italiano'])
    expect(isLocale('es-419')).toBe(true)
    expect(isLocale('unsupported')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })

  it('defaults to English without a provider or saved browser preference', () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<span data-locale="en">Your plan</span>')
    expect(renderToStaticMarkup(createElement(I18nProvider, { children: createElement(Probe) })))
      .toBe('<span data-locale="en">Your plan</span>')
  })

  it('restores only supported saved languages and lets an explicit initial language override storage', () => {
    const getItem = vi.fn((key: string): string | null => key === LANGUAGE_STORAGE_KEY ? 'fr' : null)
    vi.stubGlobal('window', { localStorage: { getItem } })
    expect(renderToStaticMarkup(createElement(I18nProvider, { children: createElement(Probe) })))
      .toBe('<span data-locale="fr">' + translate('fr', 'Your plan') + '</span>')
    expect(localize('it', createElement(Probe))).toBe('<span data-locale="it">' + translate('it', 'Your plan') + '</span>')
    getItem.mockReturnValue('not-a-language')
    expect(renderToStaticMarkup(createElement(I18nProvider, { children: createElement(Probe) })))
      .toBe('<span data-locale="en">Your plan</span>')
  })

  it('continues to work when browser storage is blocked', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('Storage blocked') } })
    expect(renderToStaticMarkup(createElement(I18nProvider, { children: createElement(Probe) })))
      .toBe('<span data-locale="en">Your plan</span>')
  })

  it.each([null, 'not-a-language'])('keeps English with saved preference %s even when the browser prefers Spanish', (saved) => {
    const navigator = { language: 'es-MX', languages: ['es-MX', 'es', 'en-GB'] }
    const getItem = vi.fn((key: string) => key === LANGUAGE_STORAGE_KEY ? saved : null)
    const setItem = vi.fn()
    vi.stubGlobal('navigator', navigator)
    vi.stubGlobal('window', { navigator, localStorage: { getItem, setItem } })
    expect(renderToStaticMarkup(createElement(I18nProvider, { children: createElement(Probe) })))
      .toBe('<span data-locale="en">Your plan</span>')
    expect(getItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY)
    expect(setItem).not.toHaveBeenCalled()
  })
})

describe('translated messages and formatting', () => {
  it('keeps the complete registry and every interpolation token, including repetitions, across languages', () => {
    const keys = Object.keys(messages.en).sort()
    expect(keys.length).toBeGreaterThan(100)
    for (const { value } of LOCALES) {
      expect(Object.keys(messages[value]).sort()).toEqual(keys)
      for (const key of keys) {
        const translated = messages[value][key]
        expect(translated.trim(), value + ': ' + key).not.toBe('')
        const tokens = (text: string) => (text.match(/\{[^{}]+\}/g) ?? []).sort()
        expect(tokens(translated), value + ': ' + key).toEqual(tokens(key))
      }
    }
  })

  it('keeps every English message identical to its source, including former fallback-only shell text', () => {
    expect(messages.en['Language']).toBe('Language')
    expect(messages.en['Welcome to Horizon']).toBe('Welcome to Horizon')
    for (const [source, message] of Object.entries(messages.en)) expect(message).toBe(source)
  })

  it('interpolates named values, including zero, without interpreting replacement characters', () => {
    expect(translate('es-419', 'Step {step} of {total}', { step: 0, total: 4 })).toBe('Paso 0 de 4')
    expect(translate('fr', 'About {amount} per asset', { amount: '$&' })).toBe('Environ $& par actif')
    expect(translate('zh-CN', 'Remove {asset}', { asset: 'SPY' })).toBe('移除 SPY')
    expect(translate('it', 'Unknown message {value}', { value: 'unchanged' })).toBe('Unknown message unchanged')
    expect(translate('en', 'Step {step} of {total}', { step: 1 })).toBe('Step 1 of {total}')
  })

  it('uses the source for unknown and inherited property names without interpreting them as dictionary entries', () => {
    for (const { value: locale } of LOCALES) {
      for (const source of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
        expect(translate(locale, source)).toBe(source)
      }
      expect(translate(locale, 'Unknown {amount} / {amount} / {other}', { amount: 0 })).toBe('Unknown 0 / 0 / {other}')
      expect(translate(locale, 'Unknown {amount}', { amount: '$&' })).toBe('Unknown $&')
    }
  })

  it('preserves default English dates and percentages while using the selected locale elsewhere', () => {
    expect(localizedDate('en', '2026-10-28', true)).toBe('28 Oct 2026')
    expect(localizedPercentage('en', 0.31)).toBe('31%')
    expect(localizedPercentage('en', 0.02, true)).toBe('+2%')
    for (const locale of ['es-419', 'zh-CN', 'fr', 'it'] as const) {
      expect(localizedDate(locale, '2026-10-28', true)).toBe(new Intl.DateTimeFormat(locale, {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
      }).format(new Date('2026-10-28T12:00:00Z')))
      expect(localizedPercentage(locale, 0.125)).toBe(new Intl.NumberFormat(locale, {
        style: 'percent', maximumFractionDigits: 1, signDisplay: 'auto',
      }).format(0.125))
    }
    expect(localizedDate('fr', 'invalid')).toBe('invalid')
  })

  it('uses the same French plan terminology in the landing view and planner', () => {
    expect(translate('fr', 'Your plan')).toBe('Votre plan')
    expect(translate('fr', 'See my plan')).toBe('Voir mon plan')
  })
})

describe('translated planner controls', () => {
  const draft = { simbolo: 'SPY', simbolos: ['SPY', 'GLD'], monto: '1000', plazo_dias: 90,
    perfil: 'moderado' as const, tipos: ['ETFs', 'US stocks', 'Crypto'] }
  const assets = { ETFs: [{ simbolo: 'SPY', nombre: 'S&P 500 (SPDR)' }, { simbolo: 'GLD', nombre: 'Gold' }],
    'US stocks': [{ simbolo: 'AAPL', nombre: 'Apple' }], Crypto: [{ simbolo: 'BTCUSDT', nombre: 'Bitcoin' }] }
  const form = { assets, draft, mode: 'asset' as const, onChange: () => {}, onSubmit: () => {},
    onModeChange: () => {}, pending: false, isDemo: false, unavailable: false, typesError: null }

  it.each(LOCALES.filter(({ value }) => value !== 'en'))('translates entry and quick/guided controls for $label without changing API codes', ({ value: locale }) => {
    const entry = localize(locale, createElement(PlannerEntry, { onChoose: () => {} }))
    expect(entry).toContain(translate(locale, 'Guide me step by step'))
    const quick = localize(locale, createElement(InvestmentForm, form))
    expect(quick).toContain(translate(locale, 'Your plan'))
    expect(quick).toContain(translate(locale, 'Get my answer'))
    expect(quick).toContain(translate(locale, 'Search name or symbol'))
    expect(quick).toContain(translate(locale, 'About {amount} per asset', { amount: '$500' }))
    expect(quick).toMatch(/name="risk"[^>]*value="moderado"/)
    expect(quick).toContain('name="selected-assets" value="SPY"')
    expect(quick).toContain('S&amp;P 500 (SPDR)')
    const guided = localize(locale, createElement(GuidedPlanner, { ...form, step: 3,
      onStepChange: () => {}, onChooseDifferent: () => {}, onUseQuick: () => {} }))
    expect(guided).toContain(translate(locale, 'Does this look like your plan?'))
    expect(guided).toContain(translate(locale, 'Step {step} of {total}', { step: 4, total: 4 }))
    expect(guided).toContain('name="selected-assets" value="GLD"')
    const automatic = localize(locale, createElement(InvestmentForm, { ...form, mode: 'plan' }))
    expect(automatic).toContain(translate(locale, 'US stocks'))
    expect(automatic).toContain('value="US stocks"')
    expect(automatic).toContain('value="Crypto"')
  })

  it('localizes error controls while preserving server messages exactly', () => {
    const html = localize('es-419', createElement(ErrorMessage, { message: 'Server text stays in English.', onRetry: () => {} }))
    expect(html).toContain('No se pudo completar la solicitud.')
    expect(html).toContain('Reintentar')
    expect(html).toContain('Server text stays in English.')
  })

  it.each([
    ['This is taking longer than expected. Please try again.', 'Esto está tardando más de lo esperado. Inténtalo de nuevo.'],
    ['We could not reach the service. Please try again in a moment.', 'No pudimos conectar con el servicio. Inténtalo en un momento.'],
  ])('localizes the exact frontend error: %s', (message, translated) => {
    const html = localize('es-419', createElement(ErrorMessage, { message, onRetry: () => {} }))
    expect(html).toContain(translated)
    expect(html).not.toContain(message)
  })

  it('only translates known client errors, preserving custom server text even when it matches a UI label', () => {
    const t = vi.fn((source: string) => translate('es-419', source))
    expect(localizeKnownError('Your plan', t)).toBe('Your plan')
    expect(localizeKnownError('Unknown asset types: Bonds', t)).toBe('Unknown asset types: Bonds')
    expect(localizeKnownError('__proto__', t)).toBe('__proto__')
    expect(localizeKnownError('constructor', t)).toBe('constructor')
    expect(t).not.toHaveBeenCalled()
    expect(localizeKnownError('The service returned incomplete price history. Please try again.', t))
      .toBe('El servicio devolvió un historial de precios incompleto. Inténtalo de nuevo.')
    expect(t).toHaveBeenCalledExactlyOnceWith('The service returned incomplete price history. Please try again.')
    const html = localize('es-419', createElement(ErrorMessage, { message: 'Your plan' }))
    expect(html).toContain('<p>Your plan</p>')
    expect(FRONTEND_ERROR_MESSAGES).toHaveLength(16)
    expect(new Set(FRONTEND_ERROR_MESSAGES).size).toBe(16)
    for (const { value: locale } of LOCALES) {
      for (const message of FRONTEND_ERROR_MESSAGES) expect(messages[locale][message]?.trim()).toBeTruthy()
    }
  })

  it('localizes selection results while keeping API asset names and decisions unchanged', () => {
    const result = structuredClone(decisionFixtures.invest)
    const html = localize('fr', createElement(SelectedAssetResults, { results: [result], budget: 1000,
      pending: false, error: null, onRetry: () => {}, onSelect: () => {} }))
    expect(html).toContain('Vos investissements sélectionnés')
    expect(html).toContain('>Investir</span>')
    expect(html).toContain('S&amp;P 500 (SPDR)')
    expect(result.decision).toBe('INVERTIR')
  })
})
