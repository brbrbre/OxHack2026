import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { I18nProvider, translate } from '../../i18n/I18nContext'
import type { Locale } from '../../i18n/I18nContext'
import { messages } from '../../i18n/locales'
import LandingPage from './LandingPage'

const translatedLocales: Locale[] = ['es-419', 'zh-CN', 'fr', 'it']

describe('localized Horizon introduction', () => {
  it.each(translatedLocales)('keeps the landing-only introduction, FAQ and demo entries in the %s registry', (locale) => {
    for (const source of ['A clearer view.', 'Before you invest.', 'What can I explore with Horizon?',
      'Can I use Horizon on my phone?', 'Illustrative mobile view · Responsive web app', 'Explore an example date',
      'Illustrative SPY price history', 'Illustrative example. Not live market data or a forecast.']) {
      expect(Object.prototype.hasOwnProperty.call(messages[locale], source), source).toBe(true)
      expect(messages[locale][source].trim(), source).not.toBe('')
    }
  })

  it.each(translatedLocales)('localizes the introduction, FAQ and chart controls in %s', (locale) => {
    const html = renderToStaticMarkup(createElement(I18nProvider, { initialLocale: locale,
      children: createElement(LandingPage, { onStart: () => {} }) }))
    for (const source of ['A clearer view.', 'Before you invest.', 'What can I explore with Horizon?',
      'Explore an example date', 'Illustrative SPY price history']) {
      expect(html).toContain(translate(locale, source))
      expect(html).not.toContain(source)
    }
    expect(html).not.toContain('lucide-sunrise')
    expect(html).toContain('href="?view=planner"')
    expect(html).toContain('aria-valuetext=')
    expect(html).not.toContain('{point}')
    expect(html).not.toContain('{amount}')
  })
})
