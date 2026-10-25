import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PlannerEntry from './PlannerEntry'

describe('planner entry choices', () => {
  it('offers two equally available ways to start without a selected skill level', () => {
    const html = renderToStaticMarkup(createElement(PlannerEntry, { onChoose: () => {} }))
    expect(html.match(/<button\b/g)).toHaveLength(2)
    expect(html.match(/type="button"/g)).toHaveLength(2)
    expect(html).toContain('aria-labelledby="entry-heading"')
    expect(html).toContain('Your plan, your way.')
    expect(html).toContain('Guide me step by step')
    expect(html).toContain('I’ll fill it in')
    expect(html).toContain('New to investing or Horizon?')
    expect(html).not.toContain('aria-pressed')
    expect(html).not.toContain('type="radio"')
  })
})
