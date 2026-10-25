import { api } from '../api/client'
import type { DecideRequest, DecideResponse } from '../api/types'
import type { PlanDraft } from '../components/InvestmentForm'

export function selectedSymbols(draft: Pick<PlanDraft, 'simbolo' | 'simbolos'>): string[] {
  return [...new Set((draft.simbolos ?? [draft.simbolo]).filter(Boolean))]
}

/** A user-visible equal comparison split, not a portfolio allocation model. */
export function splitSelectedBudget(amount: number, symbols: string[]) {
  const unique = [...new Set(symbols.filter(Boolean))]
  const cents = Math.round(amount * 100)
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(cents) || !unique.length || cents < unique.length) {
    throw new Error('Your budget must cover at least US$0.01 for each selected asset.')
  }
  // Converted budgets may contain fractions of a US cent. Preserve that value
  // rather than changing the person's local-currency budget during analysis.
  if (Math.abs(amount * 100 - cents) > 1e-7) {
    const equal = amount / unique.length
    return unique.map((simbolo, index) => ({ simbolo,
      monto: index === unique.length - 1 ? amount - equal * (unique.length - 1) : equal }))
  }
  const share = Math.floor(cents / unique.length)
  const remainder = cents % unique.length
  return unique.map((simbolo, index) => ({ simbolo, monto: (share + (index < remainder ? 1 : 0)) / 100 }))
}

/** Reuse the deployed single-asset endpoint with bounded concurrency and cancellation. */
export async function analyzeSelectedAssets(symbols: string[], request: Omit<DecideRequest, 'simbolo'>,
  signal: AbortSignal, decide = api.decide): Promise<DecideResponse[]> {
  const shares = splitSelectedBudget(request.monto, symbols)
  const results: DecideResponse[] = new Array(shares.length)
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) cancel()
  let next = 0
  try {
    await Promise.all(Array.from({ length: Math.min(3, shares.length) }, async () => {
      while (next < shares.length) {
        if (controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError')
        const index = next++
        results[index] = await decide({ ...request, ...shares[index] }, controller.signal)
      }
    }))
    return results
  } catch (error) {
    controller.abort()
    throw error
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}
