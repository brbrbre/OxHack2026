import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { CurrencyProvider } from '../currency/CurrencyContext'
import { decisionFixtures } from '../mocks/decisions'
import AskPanel from './AskPanel'
import RemindPanel from './RemindPanel'
import SummaryBlock from './SummaryBlock'

describe('optional explanations and reminders', () => {
  it('keeps the supplied summary verbatim and identifies its USD amounts in other currencies', () => {
    const listen = vi.spyOn(api, 'listen')
    const html = renderToStaticMarkup(createElement(CurrencyProvider, { initialCurrency: 'GBP',
      children: createElement(SummaryBlock, { summary: { texto: 'Invest $455 and keep $545 for later.', fuente: 'template' }, pending: false }),
    }))
    expect(html).toContain('Invest $455 and keep $545 for later.')
    expect(html).toContain('This written summary and its audio use USD; your plan amounts use GBP.')
    expect(html).toContain('Listen')
    expect(listen).not.toHaveBeenCalled()
  })

  it('labels tutor answer currency without requesting an answer before the person asks', () => {
    const ask = vi.spyOn(api, 'ask')
    const html = renderToStaticMarkup(createElement(CurrencyProvider, { initialCurrency: 'MXN',
      children: createElement(AskPanel, { result: decisionFixtures.invest, plan: null }),
    }))
    expect(html).toContain('Written answers use USD; your plan amounts use MXN.')
    expect(html).toContain('Your question')
    expect(ask).not.toHaveBeenCalled()
  })

  it('requires a number and explicit consent before a reminder can be submitted', () => {
    const remind = vi.spyOn(api, 'remind')
    const html = renderToStaticMarkup(createElement(RemindPanel, { result: decisionFixtures.invest }))
    expect(html).toContain('Your WhatsApp number')
    expect(html).toContain('I agree to one WhatsApp message')
    expect(html).toContain('type="submit" class="remind-button" disabled=""')
    expect(remind).not.toHaveBeenCalled()
  })

  it('hides optional features when their analysis is absent', () => {
    expect(renderToStaticMarkup(createElement(SummaryBlock, { summary: null, pending: false }))).toBe('')
    expect(renderToStaticMarkup(createElement(AskPanel, { result: null, plan: null }))).toBe('')
    expect(renderToStaticMarkup(createElement(RemindPanel, { result: null }))).toBe('')
  })
})
