import type { PlanDraft } from '../components/InvestmentForm'
import { HORIZONS } from '../config'

export function hasPlanLink(search: string): boolean {
  const query = new URLSearchParams(search)
  const amount = Number(query.get('monto'))
  return Boolean(query.get('simbolo')?.trim()) && Number.isFinite(amount) && amount > 0 && amount <= 1e9 &&
    (HORIZONS as readonly number[]).includes(Number(query.get('plazo'))) &&
    ['conservador', 'moderado', 'agresivo'].includes(query.get('perfil') ?? '')
}

/** The WhatsApp reminder link opens the app with the same plan: /?simbolo=SPY&monto=1000&plazo=180&perfil=moderado */
export function planFromSearch(search: string, fallback: PlanDraft): PlanDraft {
  const q = new URLSearchParams(search)
  const plazo = Number(q.get('plazo'))
  const monto = Number(q.get('monto'))
  const perfil = q.get('perfil')
  return {
    ...fallback,
    simbolo: q.get('simbolo') || fallback.simbolo,
    monto: monto > 0 && monto <= 1e9 ? String(monto) : fallback.monto,
    plazo_dias: (HORIZONS as readonly number[]).includes(plazo) ? plazo as PlanDraft['plazo_dias'] : fallback.plazo_dias,
    perfil: perfil === 'conservador' || perfil === 'moderado' || perfil === 'agresivo' ? perfil : fallback.perfil,
  }
}
