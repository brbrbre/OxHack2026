import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { DEFAULT_NOTICE } from './config'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function renderReminderLink(search: string) {
  vi.stubGlobal('window', { location: { search } })
  vi.resetModules()
  const { default: LinkedApp } = await import('./App')
  return renderToStaticMarkup(createElement(LinkedApp))
}

function input(html: string, name: string, value?: string) {
  return Array.from(html.matchAll(/<input\b[^>]*>/g), ([match]) => match)
    .find((markup) => markup.includes('name="' + name + '"') &&
      (value === undefined || markup.includes('value="' + value + '"')))
}

describe('first visit', () => {
  it('lets the user choose guidance or the quick form before showing inputs and analysis', () => {
    const html = renderToStaticMarkup(createElement(App))
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('id="entry-heading"')
    expect(html).toContain('Your plan, your way.')
    expect(html).toContain('Start here')
    expect(html).toContain('Guide me step by step')
    expect(html).toContain('I’ll fill it in')
    expect(html).not.toContain('id="investment-form"')
    expect(html).not.toContain('id="amount"')
    expect(html).toContain('workspace-setup')
    expect(html).not.toContain('results-column')
    expect(html).not.toContain('outlook-heading')
    expect(html).not.toContain('chart-panel')
    expect(html).toContain(DEFAULT_NOTICE)
  })

  it('opens a reminder link directly in the quick form with its supplied budget, horizon and risk', async () => {
    const html = await renderReminderLink('?simbolo=SPY&monto=500&plazo=90&perfil=agresivo')
    expect(html).not.toContain('id="entry-heading"')
    expect(html).toContain('id="investment-form"')
    expect(input(html, 'amount')).toContain('value="500"')
    expect(html).toContain('Getting your options ready')
    expect(input(html, 'horizon', '90')).toContain('type="hidden"')
    expect(html).toContain('This plan keeps its original 90-day duration.')
    expect(html).not.toContain('type="range"')
    expect(input(html, 'risk', 'agresivo')).toContain('checked=""')
    expect(html).toContain('Get my answer')
    expect(html).not.toContain('outlook-heading')
    expect(html).toContain(DEFAULT_NOTICE)
  })

  it('keeps invalid reminder values out of the form while preserving valid defaults', async () => {
    const html = await renderReminderLink('?simbolo=SPY&monto=-5&plazo=61&perfil=yolo')
    expect(input(html, 'amount')).toContain('value="1000"')
    expect(input(html, 'horizon', '30')).toContain('type="range"')
    expect(input(html, 'risk', 'moderado')).toContain('checked=""')
    expect(html).not.toContain('value="-5"')
    expect(html).not.toContain('value="yolo"')
  })

  it('opens an arbitrary 37-day link in the slider with its supplied budget and profile intact', async () => {
    const html = await renderReminderLink('?simbolo=SPY&monto=500&plazo=37&perfil=agresivo')
    expect(html).not.toContain('id="entry-heading"')
    expect(input(html, 'amount')).toContain('value="500"')
    expect(input(html, 'horizon', '37')).toContain('type="range"')
    expect(input(html, 'horizon', '37')).toContain('min="1" max="60" step="1"')
    expect(input(html, 'risk', 'agresivo')).toContain('checked=""')
  })

  it('opens a portfolio reminder directly in Help me choose with the supplied custom duration', async () => {
    const html = await renderReminderLink('?view=planner&modo=plan&tipos=ETFs%2CCrypto&monto=750&plazo=37&perfil=conservador&recordatorio=abcDEF_123-xyz')
    expect(html).not.toContain('id="entry-heading"')
    expect(html).toContain('id="investment-form"')
    expect(input(html, 'amount')).toContain('value="750"')
    expect(input(html, 'horizon', '37')).toContain('type="range"')
    expect(input(html, 'risk', 'conservador')).toContain('checked=""')
    expect(input(html, 'planner-mode', 'plan')).toContain('checked=""')
    expect(html).toContain('Build my plan')
  })
})
