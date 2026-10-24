import type { DecideResponse, PlanResponse } from '../api/types'
import { money, percentage } from './format'

const FUND_LIKE = /^\^|=X$|USDT$/

/** Questions a beginner would ask about what is on screen. */
export function suggestedQuestions(result: DecideResponse | null, plan: PlanResponse | null): string[] {
  if (plan) {
    return [
      'Why spread my money across several assets?',
      'What does the cash part of my plan do?',
      'What is an ETF, in simple words?',
      'What does "a bad scenario" mean here?',
    ]
  }
  if (!result) return []
  const partial = result.numeros.fraccion > 0 && result.numeros.fraccion < 1
  return [
    FUND_LIKE.test(result.simbolo) ? 'What is ' + result.nombre + ', really?' : 'What does ' + result.nombre + ' do?',
    partial ? 'Why invest only part of my money now?' : 'Why does Horizon suggest this amount?',
    'What does "chance of loss" mean?',
    'Where do I see this company or market in my daily life?',
  ]
}

/** The numbers the app already calculated. The tutor may explain them, never change them. */
export function askContext(result: DecideResponse | null, plan: PlanResponse | null): Record<string, unknown> {
  if (plan) {
    return {
      screen: 'portfolio plan',
      budget: money(plan.numeros.monto),
      invest_now: money(Math.round(plan.numeros.invertido)),
      keep_in_cash: money(Math.round(plan.efectivo)),
      days: plan.numeros.plazo_dias,
      holdings: plan.cartera.map((asset) => asset.nombre + ' ' + percentage(asset.peso)),
      bad_case_for_plan: money(Math.round(-plan.numeros.peor_caso)),
      profile_accepts_loss_up_to: percentage(plan.numeros.tolerancia),
    }
  }
  if (!result) return {}
  const n = result.numeros
  return {
    screen: 'single asset answer',
    decision: result.decision,
    budget: money(n.monto),
    invest_now: money(Math.round(n.monto_sugerido)),
    days: n.plazo_dias,
    profile: n.perfil,
    expected_return: percentage(n.rendimiento_esperado, true),
    chance_of_loss: percentage(n.prob_perdida),
    bad_case_on_full_budget: money(Math.round(n.peor_caso)),
    model: result.modelo,
  }
}
