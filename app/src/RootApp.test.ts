import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import RootApp, { pageFromSearch } from './RootApp'
import { api } from './api/client'
import { DEFAULT_NOTICE } from './config'
import { assets } from './mocks/assets'

function renderHome() {
  return renderToStaticMarkup(createElement(RootApp))
}

describe('Horizon page navigation', () => {
  it.each([
    { search: '', page: 'home' },
    { search: '?view=planner', page: 'planner' },
    { search: '?ref=team&view=planner', page: 'planner' },
    { search: '?view=home', page: 'home' },
    { search: '?view=unknown', page: 'home' },
    { search: '?view=', page: 'home' },
    { search: '?redirect=planner', page: 'home' },
    { search: '?simbolo=WALMEX.MX&monto=500&plazo=180&perfil=conservador', page: 'planner' },
    { search: '?simbolo=SPY&monto=0&plazo=30&perfil=moderado', page: 'planner' },
    { search: '?simbolo=SPY', page: 'planner' },
    { search: '?view=home&simbolo=SPY&monto=500&plazo=30&perfil=moderado', page: 'home' },
  ])('opens $page for $search', ({ search, page }) => {
    expect(pageFromSearch(search)).toBe(page)
  })

  it('introduces Horizon without mounting the planner or requesting the catalogue', () => {
    const getAssets = vi.spyOn(api, 'getAssets').mockResolvedValue(assets)
    const html = renderHome()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('id="landing-title"')
    expect(html).toContain('A clearer view.')
    expect(html).toContain('Before you invest.')
    expect(html).not.toContain('id="entry-heading"')
    expect(html).not.toContain('id="investment-form"')
    expect(html).not.toContain('Opening your planner…')
    expect(getAssets).not.toHaveBeenCalled()
  })

  it('provides real planner links and valid, unique in-page navigation targets', () => {
    const html = renderHome()
    const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), ([, id]) => id)
    expect(new Set(ids).size).toBe(ids.length)
    const anchors = Array.from(html.matchAll(/<a\b[^>]*href="#([^"]+)"/g), ([, id]) => id)
    expect(anchors.length).toBeGreaterThan(4)
    for (const id of anchors) {
      expect(id).toMatch(/^home-/)
      expect(ids).toContain(id)
    }
    expect(html.match(/href="\?view=planner"/g)!.length).toBeGreaterThan(2)
    expect(html).toContain('Explore your plan')
    expect(html).toContain('Try the web app')
    expect(html).toContain('aria-controls="home-navigation"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('explains the available experiences without claiming a native app or trade execution', () => {
    const html = renderHome()
    expect(html).toContain('Guide me step by step')
    expect(html).toContain('I’ll fill it in')
    expect(html).toContain('responsive web app')
    expect(html).toContain('no separate native app or App Store download at this stage')
    expect(html).toContain('Horizon does not place trades or move your money.')
    expect(html).not.toContain('apps.apple.com')
    expect(html).not.toContain('play.google.com')
    expect(html).toContain(DEFAULT_NOTICE)
    expect(html).toContain('https://github.com/brbrbre/OxHack2026')
  })

  it('labels the interactive history and mobile illustration as examples', () => {
    const html = renderHome()
    expect(html).toContain('Illustrative example. Not live market data or a forecast.')
    expect(html).toContain('Illustrative mobile view')
    expect(html).toContain('Explore an example date')
    expect(html).toContain('type="range"')
    expect(html).toContain('aria-valuetext=')
    expect(html).toContain('role="img" aria-labelledby=')
    expect(html).toContain('/assets/logos/apple.svg')
    expect(html).toContain('/assets/logos/gold-bar.svg')
  })

  it('keeps the questions accessible through native disclosures and states forecast uncertainty', () => {
    const html = renderHome()
    expect(html.match(/<details>/g)).toHaveLength(5)
    expect(html.match(/<summary>/g)).toHaveLength(5)
    expect(html).toContain('Are the results guaranteed?')
    expect(html).toContain('a guarantee or a limit on what could happen')
    expect(html).toContain('prediction model used')
  })
})
