import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'
import { DEFAULT_NOTICE } from './config'

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
})
