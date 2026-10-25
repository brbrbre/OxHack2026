import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { decisionFixtures } from '../mocks/decisions'
import SelectedAssetResults from './SelectedAssetResults'

describe('selected asset answers', () => {
  it('shows separate budget shares and decision codes without claiming a combined portfolio forecast', () => {
    const first = structuredClone(decisionFixtures.invest)
    const second = structuredClone(decisionFixtures.wait)
    first.numeros.monto = 500
    second.numeros.monto = 500
    const html = renderToStaticMarkup(createElement(SelectedAssetResults, {
      results: [first, second], budget: 1000, selectedSymbol: first.simbolo,
      pending: false, error: null, onRetry: () => {}, onSelect: () => {},
    }))
    expect(html).toContain('Your selected investments')
    expect(html).toContain('not an optimized portfolio or a combined risk estimate')
    expect(html).toContain('>Invest</span>')
    expect(html).toContain('>Wait</span>')
    expect(html.match(/Budget share/g)).toHaveLength(2)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toContain('aria-controls="selected-asset-heading"')
  })
})
