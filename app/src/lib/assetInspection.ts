import type { Asset, DecideResponse, PlanResponse, RiskProfile } from '../api/types'

/** Display context only: inspecting an asset never changes the portfolio allocation. */
export interface AssetInspection {
  symbol: string
  name: string
  amount: number
  days: number
  profile: RiskProfile
  basis: 'allocation' | 'comparison' | 'hypothetical'
  weight?: number
  analysis?: DecideResponse
}

export function inspectPlanAsset(plan: PlanResponse, asset: Asset): AssetInspection {
  const allocation = plan.cartera.find((item) => item.simbolo === asset.simbolo)
  return { symbol: asset.simbolo, name: asset.nombre,
    amount: allocation?.monto ?? plan.numeros.monto,
    days: plan.numeros.plazo_dias, profile: plan.numeros.perfil,
    basis: allocation ? 'allocation' : 'hypothetical',
    ...(allocation ? { weight: allocation.peso } : {}),
  }
}
