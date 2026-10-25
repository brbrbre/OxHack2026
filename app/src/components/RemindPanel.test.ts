import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DecideResponse } from '../api/types'
import { decisionFixtures } from '../mocks/decisions'
import RemindPanel from './RemindPanel'

function render(result: DecideResponse | null) {
  return renderToStaticMarkup(createElement(RemindPanel, { result }))
}

describe('reminder entry', () => {
  it('appears only after an asset answer exists', () => {
    expect(render(null)).toBe('')
    expect(render(decisionFixtures.invest)).toContain('Make it a habit')
  })

  it('starts as a native collapsed disclosure while retaining its consent form', () => {
    const html = render(decisionFixtures.invest)
    expect(html).toContain('<details class="remind-panel optional-panel" aria-labelledby="remind-heading">')
    expect(html).toContain('<summary class="optional-panel-summary">')
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/)
    expect(html).toContain('class="optional-panel-body"')
    expect(html).toContain('id="remind-phone"')
    expect(html).toContain('Remind me in 30 days')
  })

  it('keeps the telephone field labelled and waits for explicit consent before submission', () => {
    const html = render(decisionFixtures.invest)
    expect(html).toContain('<label for="remind-phone">Your WhatsApp number</label>')
    expect(html).toMatch(/id="remind-phone"[^>]*type="tel"[^>]*inputMode="tel"/)
    const consent = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0]
    expect(consent).toBeDefined()
    expect(consent).not.toContain('checked')
    expect(html).toContain('I agree to one WhatsApp message and, if I don&#x27;t open it, one phone call about this reminder.')
    expect(html).toContain('type="submit" class="remind-button" disabled=""')
  })

  it.each(['invest', 'wait', 'waitRisk', 'notNow'] as const)('uses the submitted horizon to review the %s plan', (fixture) => {
    const result = structuredClone(decisionFixtures[fixture])
    result.numeros.plazo_dias = 90
    const html = render(result)
    expect(html).toContain('Remind me in 90 days')
    expect(html).toContain('In 90 days we&#x27;ll message you on WhatsApp to review this plan with fresh numbers.')
    expect(html).not.toContain('waiting period')
  })
})
