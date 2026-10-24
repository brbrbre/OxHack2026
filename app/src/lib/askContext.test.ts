import { describe, expect, it } from 'vitest'
import { parseAsk, parseSummary } from '../api/validation'
import { decisionFixtures } from '../mocks/decisions'
import { planFixtures } from '../mocks/plan'
import { askContext, suggestedQuestions } from './askContext'

describe('Ask Horizon helpers', () => {
  it('asks what a company does, and what a market is', () => {
    const company = structuredClone(decisionFixtures.invest)
    company.simbolo = 'WALMEX.MX'
    company.nombre = 'Walmart de México'
    expect(suggestedQuestions(company, null)[0]).toBe('What does Walmart de México do?')
    const crypto = structuredClone(decisionFixtures.invest)
    crypto.simbolo = 'BTCUSDT'
    crypto.nombre = 'Bitcoin'
    expect(suggestedQuestions(crypto, null)[0]).toBe('What is Bitcoin, really?')
  })

  it('gives plan questions on the plan screen and none without an answer', () => {
    expect(suggestedQuestions(null, planFixtures.sample)).toContain('Why spread my money across several assets?')
    expect(suggestedQuestions(null, null)).toEqual([])
  })

  it('passes the numbers already on screen, rounded like the headline', () => {
    const result = structuredClone(decisionFixtures.waitRisk)
    result.numeros.monto_sugerido = 393.38
    const context = askContext(result, null)
    expect(context.invest_now).toBe('$393')
    expect(context.decision).toBe(result.decision)
    expect(askContext(null, planFixtures.sample).screen).toBe('portfolio plan')
  })

  it('accepts only well-formed answers and summaries', () => {
    expect(parseAsk({ respuesta: 'An ETF is a basket.', fuente: 'gemini' }).fuente).toBe('gemini')
    expect(() => parseAsk({ respuesta: '', fuente: 'gemini' })).toThrow()
    expect(() => parseAsk({ respuesta: 'x', fuente: 'other' })).toThrow()
    expect(parseSummary({ texto: 'Invest $393 now.', fuente: 'template' }).texto).toBe('Invest $393 now.')
    expect(() => parseSummary({ texto: 'x', fuente: 'gpt' })).toThrow()
  })
})
