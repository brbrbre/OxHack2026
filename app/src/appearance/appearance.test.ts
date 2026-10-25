import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n/I18nContext'
import type { Locale } from '../i18n/I18nContext'
import { readTheme, ThemeProvider } from './ThemeContext'
import AppearanceControls from '../components/AppearanceControls'
import InformationNotice, { RESPONSIBILITY_NOTICE } from '../components/InformationNotice'
import SunriseIntro, { shouldShowIntro } from '../components/SunriseIntro'

describe('appearance preferences and introduction', () => {
  it('reads only valid theme preferences and works when storage is blocked', () => {
    expect(readTheme({ getItem: () => 'dark' })).toBe('dark')
    expect(readTheme({ getItem: () => 'other' })).toBe('light')
    expect(readTheme({ getItem: () => { throw new Error('Private browsing') } })).toBe('light')
    expect(readTheme()).toBe('light')
  })

  it('offers every language and an accessible toggle for the current theme', () => {
    const html = renderToStaticMarkup(createElement(ThemeProvider, { initialTheme: 'dark', children: createElement(AppearanceControls) }))
    for (const locale of ['en', 'es-419', 'zh-CN', 'fr', 'it']) expect(html).toContain('value="' + locale + '"')
    expect(html).toContain('Switch to light mode')
    expect(html).toContain('Language')
  })

  it('never delays a planner or reminder link and shows the intro only once per session', () => {
    const unseen = { getItem: () => null }
    expect(shouldShowIntro('', unseen)).toBe(true)
    expect(shouldShowIntro('', { getItem: () => '1' })).toBe(false)
    expect(shouldShowIntro('?simbolo=SPY&monto=500', unseen)).toBe(false)
    expect(shouldShowIntro('?view=planner', unseen)).toBe(false)
    expect(shouldShowIntro('', { getItem: () => { throw new Error('Storage blocked') } })).toBe(true)
  })

  it('provides a skip action without presenting an invented loading state', () => {
    const html = renderToStaticMarkup(createElement(SunriseIntro, { onComplete: () => {} }))
    expect(html).toContain('Skip introduction')
    expect(html).toContain('horizon')
    expect(html).toContain('aria-modal="true"')
    expect(html).not.toContain('progressbar')
    expect(html).not.toContain('aria-busy')
  })

  it('keeps the responsibility notice on screen in the default language', () => {
    const html = renderToStaticMarkup(createElement(InformationNotice))
    expect(html).toContain(RESPONSIBILITY_NOTICE)
    expect(html).toContain('<aside')
  })

  it.each(['es-419', 'zh-CN', 'fr', 'it'] as Locale[])('localizes the notice and controls in %s', (locale) => {
    const html = renderToStaticMarkup(createElement(I18nProvider, { initialLocale: locale, children: [
      createElement(InformationNotice, { key: 'notice' }), createElement(AppearanceControls, { key: 'controls' }),
    ] }))
    expect(html).not.toContain(RESPONSIBILITY_NOTICE)
    expect(html).not.toContain('Switch to dark mode')
    expect(html).not.toContain('aria-label="Important information"')
  })
})
