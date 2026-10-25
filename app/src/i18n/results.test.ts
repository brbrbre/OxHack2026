import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { HabitStatus } from '../api/types'
import AskPanel from '../components/AskPanel'
import DecisionCard from '../components/DecisionCard'
import PlanResult from '../components/PlanResult'
import PriceChart from '../components/PriceChart'
import RemindPanel from '../components/RemindPanel'
import SummaryBlock from '../components/SummaryBlock'
import { habitSettled, habitSteps } from '../lib/habitSteps'
import { decisionFixtures } from '../mocks/decisions'
import { planFixtures } from '../mocks/plan'
import { I18nProvider, LOCALES, translate } from './I18nContext'
import type { Locale } from './I18nContext'
import { messages } from './locales'

function render(locale: Locale, content: ReactNode) {
  return renderToStaticMarkup(createElement(I18nProvider, { initialLocale: locale, children: content }))
}
function escape(value: string) {
  return renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
}
const translations = [
  { locale: 'es-419' as const, decision: 'Esperar', risk: 'Riesgo de este plan', listen: 'Escuchar', days: '30 días', ask: 'Pregúntale a Horizon' },
  { locale: 'zh-CN' as const, decision: '等待', risk: '此计划的风险', listen: '收听', days: '30 天', ask: '向 Horizon 提问' },
  { locale: 'fr' as const, decision: 'Attendre', risk: 'Risque de ce plan', listen: 'Écouter', days: '30 jours', ask: 'Demandez à Horizon' },
  { locale: 'it' as const, decision: 'Attendi', risk: 'Rischio di questo piano', listen: 'Ascolta', days: '30 giorni', ask: 'Chiedi a Horizon' },
]

describe('localized result interfaces', () => {
  it.each(translations)('translates $locale decisions without changing API prose or numeric codes', ({ locale, decision, days }) => {
    const result = structuredClone(decisionFixtures.wait)
    result.razones = ['Wait', ...result.razones]
    result.recomendaciones = ['Listen', ...result.recomendaciones]
    const before = structuredClone(result)
    const html = render(locale, createElement(DecisionCard, { result, pending: false, error: null, onRetry() {}, isDemo: false, headingId: 'selected-asset-heading' }))
    expect(html).toContain('class="decision-badge wait">' + decision)
    expect(html).toContain(days)
    expect(html).toContain('<li>Wait</li>')
    expect(html).toContain('<li>Listen</li>')
    expect(html).toContain(escape(result.razones[1]))
    expect(html).toContain('id="selected-asset-heading"')
    expect(html).not.toContain('id="outlook-heading"')
    expect(result).toEqual(before)
  })

  it.each(translations)('translates $locale portfolio interface and keeps backend summary and reasons intact', ({ locale, risk }) => {
    const result = structuredClone(planFixtures.sample)
    result.resumen = 'Plan summary'
    result.invertir[0].razon = 'Cash'
    result.invertir[0].fuera_del_plan = 'Wait'
    const html = render(locale, createElement(PlanResult, { result, pending: false, error: null, onRetry() {} }))
    expect(html).toContain(risk)
    expect(html).toContain('<p>Plan summary</p>')
    expect(html).toContain('<p>Cash</p>')
    expect(html).toContain(escape(messages[locale]['Not in the plan:']) + ' Wait')
    expect(html).toMatch(/<details class="plan-classification invest" open=""/)
    expect(html).not.toMatch(/<details class="plan-classification wait"[^>]* open=/)
    expect(html).not.toMatch(/\{(?:amount|count|change|limit)\}/)
  })

  it.each(translations)('translates $locale summary and question controls while leaving the summary verbatim', ({ locale, listen, ask }) => {
    const html = render(locale, createElement('div', null,
      createElement(SummaryBlock, { summary: { texto: 'In short', fuente: 'gemini' }, pending: false }),
      createElement(AskPanel, { result: decisionFixtures.invest, plan: null }),
    ))
    expect(html).toContain('<p class="summary-text">In short</p>')
    expect(html).toContain(listen)
    expect(html).toContain(escape(ask))
    expect(html).toContain(escape(translate(locale, 'What does {asset} do?', { asset: decisionFixtures.invest.nombre })))
    expect(html).not.toContain('{asset}')
  })

  it.each(translations)('translates $locale reminder consent without enabling it', ({ locale }) => {
    const html = render(locale, createElement(RemindPanel, { result: decisionFixtures.invest }))
    expect(html).toContain(escape(translate(locale, 'Remind me in {days} days', { days: 30 })))
    expect(html).toContain(escape(translate(locale, "I agree to one WhatsApp message and, if I don't open it, one phone call about this reminder.")))
    expect(html).not.toMatch(/type="checkbox"[^>]*checked/)
    expect(html).toContain('class="remind-button" disabled=""')
  })

  it.each(translations)('localizes $locale chart date and forecast labels without changing the closing prices', ({ locale }) => {
    const prices = { simbolo: 'SPY', fechas: ['2026-10-22', '2026-10-23'], cierres: [98, 100] }
    const html = render(locale, createElement(PriceChart, { prices, symbol: 'SPY', name: 'S&P 500 (SPDR)', pending: false,
      error: null, onRetry() {}, isDemo: false, result: decisionFixtures.invest }))
    expect(html).toContain(escape(translate(locale, '90% range in {days} days', { days: 30 })))
    expect(html).toContain(escape(translate(locale, 'Prices in USD (US dollars).')))
    expect(html).not.toContain('Latest close')
    expect(html).not.toContain('{date}')
    expect(prices.cierres).toEqual([98, 100])
  })
})

describe('result translation coverage and reminder state integrity', () => {
  it('covers every real Twilio label and preserves its done/missed/waiting state', () => {
    const id = 'local-test'
    const base: HabitStatus = { token: id, vence: '2026-11-24', estado: 'enviado', enviado_en: '2026-10-25',
      abierto_en: null, llamado_en: null, error: null, simbolo: 'SPY', plazo_dias: 30, demo: true }
    const cases: Partial<HabitStatus>[] = [
      { enviado_en: null, estado: 'pendiente' }, {}, { mensaje_estado: 'delivered' }, { mensaje_estado: 'undelivered' },
      { abierto_en: '2026-10-25', estado: 'abierto' }, { estado: 'llamado', llamada_estado: 'completed' },
      ...['busy', 'no-answer', 'failed', 'canceled', 'unknown'].map((llamada_estado) => ({ estado: 'sin_respuesta' as const, llamada_estado })),
      { estado: 'llamando', llamada_estado: 'ringing' }, { estado: 'llamando', llamada_estado: 'queued' }, { estado: 'error' },
    ]
    for (const overrides of cases) {
      const status = { ...base, ...overrides }
      const steps = habitSteps(status)
      const settled = habitSettled(status)
      for (const { value: locale } of LOCALES) {
        for (const step of steps) expect(messages[locale][step.label], locale + ': ' + step.label).toBeTruthy()
        expect(habitSteps(status)).toEqual(steps)
        expect(habitSettled(status)).toBe(settled)
      }
    }
  })
})
