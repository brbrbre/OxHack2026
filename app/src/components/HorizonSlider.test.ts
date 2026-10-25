import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { isNewHorizon, isSupportedHorizon } from '../config'
import { I18nProvider, translate } from '../i18n/I18nContext'
import type { Locale } from '../i18n/types'
import HorizonSlider from './HorizonSlider'

function render(value: number, onChange = () => {}) {
  return renderToStaticMarkup(createElement(HorizonSlider, { value, onChange }))
}

describe('investment duration slider', () => {
  it.each([1, 30, 37, 60])('keeps an accessible, day-by-day native range at %s days', (days) => {
    const html = render(days)
    const input = html.match(/<input\b[^>]*>/)?.[0]
    expect(input).toContain('type="range"')
    expect(input).toContain('name="horizon"')
    expect(input).toContain('min="1"')
    expect(input).toContain('max="60"')
    expect(input).toContain('step="1"')
    expect(input).toContain('value="' + days + '"')
    expect(input).toContain('aria-label="Investment period"')
    expect(input).toContain('aria-valuetext="' + days + (days === 1 ? ' day"' : ' days"'))
    const hintId = input?.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toContain('id="' + hintId + '"')
    expect(html).not.toContain('type="radio"')
  })

  it.each([90, 180, 365])('preserves saved %s days without silently clamping or changing the draft', (days) => {
    const onChange = vi.fn()
    const html = render(days, onChange)
    expect(html).toContain('Saved duration')
    expect(html).toContain('This plan keeps its original ' + days + '-day duration.')
    expect(html).toContain('type="hidden" name="horizon" value="' + days + '"')
    expect(html).toContain('Choose a duration from 1 to 60 days')
    expect(html).toContain('type="button"')
    expect(html).not.toContain('type="range"')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts every integer in the new range and only the historical longer link values', () => {
    for (let days = 1; days <= 60; days++) expect(isNewHorizon(days)).toBe(true)
    for (const days of [0, -1, 1.5, 61, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isNewHorizon(days)).toBe(false)
      expect(isSupportedHorizon(days)).toBe(false)
    }
    for (const days of [90, 180, 365]) {
      expect(isNewHorizon(days)).toBe(false)
      expect(isSupportedHorizon(days)).toBe(true)
    }
  })

  it.each(['es-419', 'zh-CN', 'fr', 'it'] as Locale[])('localizes the value and saved-plan action in %s', (locale) => {
    const localized = (days: number) => renderToStaticMarkup(createElement(I18nProvider, {
      initialLocale: locale, children: createElement(HorizonSlider, { value: days, onChange: () => {} }),
    }))
    expect(localized(1)).toContain(translate(locale, '1 day'))
    expect(localized(37)).toContain(translate(locale, '{days} days', { days: 37 }))
    expect(localized(90)).toContain(translate(locale, 'Saved duration'))
    expect(localized(90)).toContain(translate(locale, 'Choose a duration from 1 to 60 days'))
  })
})
