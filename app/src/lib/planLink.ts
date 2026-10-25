import type { PlanDraft, PlannerMode } from '../components/InvestmentForm'
import { isSupportedHorizon } from '../config'

/** The WhatsApp reminder link opens the app with the same plan: /?simbolo=SPY&monto=1000&plazo=180&perfil=moderado.
 * A "Help me choose" reminder carries the asset types instead: /?modo=plan&tipos=ETFs,Crypto&monto=... */
export function planFromSearch(search: string, fallback: PlanDraft): PlanDraft {
  const q = new URLSearchParams(search)
  const plazo = Number(q.get('plazo'))
  const monto = Number(q.get('monto'))
  const perfil = q.get('perfil')
  const tipos = (q.get('tipos') ?? '').split(',').map((type) => type.trim()).filter(Boolean)
  return {
    ...fallback,
    simbolo: q.get('simbolo') || fallback.simbolo,
    monto: monto > 0 && monto <= 1e9 ? String(monto) : fallback.monto,
    plazo_dias: isSupportedHorizon(plazo) ? plazo : fallback.plazo_dias,
    perfil: perfil === 'conservador' || perfil === 'moderado' || perfil === 'agresivo' ? perfil : fallback.perfil,
    tipos: tipos.length ? tipos : fallback.tipos,
  }
}

/** "Help me choose" when the reminder was for a plan; one asset otherwise. */
export function modeFromSearch(search: string): PlannerMode {
  return new URLSearchParams(search).get('modo') === 'plan' ? 'plan' : 'asset'
}

/** Token of the reminder that opened the app, if any. The app reports the visit, not the link itself:
 * WhatsApp's link preview also fetches the link, but it does not run JavaScript. */
export function reminderFromSearch(search: string): string | null {
  const token = new URLSearchParams(search).get('recordatorio')
  return token && /^[A-Za-z0-9_-]{10,64}$/.test(token) ? token : null
}
