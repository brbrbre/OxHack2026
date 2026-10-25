import type { DecideResponse } from '../api/types'
import type { AssetInspection } from './assetInspection'

/** A comparison or holding can reuse only the analysis for its exact USD input. */
export function matchingInspectionAnalysis(selection: AssetInspection, analysis?: DecideResponse | null): DecideResponse | null {
  return analysis && analysis.simbolo === selection.symbol && analysis.numeros.monto === selection.amount &&
    analysis.numeros.plazo_dias === selection.days && analysis.numeros.perfil === selection.profile ? analysis : null
}
