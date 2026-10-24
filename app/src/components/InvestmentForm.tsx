import { ArrowRight, ChevronDown, CircleHelp, LoaderCircle, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react'
import type { FormEvent } from 'react'
import type { AssetsResponse, RiskProfile } from '../api/types'
import { HORIZONS } from '../config'
import { DECISION_LABELS, PROFILE_LABELS } from '../lib/labels'

export interface PlanDraft {
  simbolo: string
  monto: string
  plazo_dias: number
  perfil: RiskProfile
}

interface Props {
  assets: AssetsResponse | null
  draft: PlanDraft
  onChange: (value: PlanDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  pending: boolean
  isDemo: boolean
  unavailable: boolean
}

const profiles = [
  { value: 'conservador', detail: 'Keep risk lower', Icon: ShieldCheck },
  { value: 'moderado', detail: 'Find a balance', Icon: SlidersHorizontal },
  { value: 'agresivo', detail: 'Accept more risk', Icon: Zap },
] as const

export default function InvestmentForm({ assets, draft, onChange, onSubmit, pending, isDemo, unavailable }: Props) {
  const count = assets ? Object.values(assets).flat().length : 0
  return (
    <section className="panel planner-panel" aria-labelledby="plan-heading">
      <div className="section-eyebrow"><span className="step-number">01</span> YOUR PLAN</div>
      <h2 id="plan-heading">Start with the essentials.</h2>
      <p className="section-description">A few details. A clearer perspective.</p>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="asset">What are you exploring?</label>
          <div className="select-wrap">
            <select id="asset" name="asset" value={draft.simbolo} disabled={!assets}
              onChange={(event) => onChange({ ...draft, simbolo: event.target.value })}>
              {!assets && <option value="SPY">{unavailable ? 'Assets unavailable' : 'Loading assets…'}</option>}
              {assets && Object.entries(assets).map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((asset) => (
                    <option key={asset.simbolo} value={asset.simbolo}>{asset.simbolo} · {asset.nombre}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
          <span className="field-hint">{count ? count + ' assets, from ETFs to crypto'
            : unavailable ? 'Use Try again above to reload your options' : 'Getting your options ready'}</span>
        </div>

        <div className="field">
          <label htmlFor="amount">How much would you invest?</label>
          <div className="amount-control">
            <span aria-hidden="true">$</span>
            <input id="amount" name="amount" type="number" inputMode="decimal" min="0.01"
              step="0.01" required value={draft.monto}
              onChange={(event) => onChange({ ...draft, monto: event.target.value })}
              aria-describedby="amount-hint" />
            <span className="currency-label">USD</span>
          </div>
          <span className="field-hint" id="amount-hint">An amount you feel comfortable exploring</span>
        </div>

        <fieldset className="field">
          <legend>What is your time horizon?</legend>
          <div className="horizon-options">
            {HORIZONS.map((days) => (
              <label className={'horizon-option' + (draft.plazo_dias === days ? ' selected' : '')} key={days}>
                <input type="radio" name="horizon" value={days} checked={draft.plazo_dias === days}
                  onChange={() => onChange({ ...draft, plazo_dias: days })} />
                <span aria-hidden="true">{days}<small>d</small></span><span className="sr-only">{days} days</span>
              </label>
            ))}
          </div>
          <span className="field-hint">How long you plan to stay invested</span>
        </fieldset>

        <fieldset className="field risk-field">
          <legend>How do you feel about risk?</legend>
          <div className="risk-options">
            {profiles.map(({ value, detail, Icon }) => (
              <label key={value} className={'risk-option' + (draft.perfil === value ? ' selected' : '')}>
                <input type="radio" name="risk" value={value} checked={draft.perfil === value}
                  onChange={() => onChange({ ...draft, perfil: value })} />
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                <span className="risk-copy"><strong>{PROFILE_LABELS[value]}</strong><span>{detail}</span></span>
                <span className="radio-indicator" aria-hidden="true" />
              </label>
            ))}
          </div>
        </fieldset>
        <button className="primary-button" type="submit" disabled={!assets || pending}>
          {pending ? <><LoaderCircle size={18} className="spin" aria-hidden="true" /> Exploring your outlook…</>
            : <>Explore my outlook <ArrowRight size={18} aria-hidden="true" /></>}
        </button>
        <p className="form-footnote"><ShieldCheck size={14} aria-hidden="true" /> Explore an idea. No account or payment needed.</p>
      </form>
      {isDemo && (
        <div className="demo-scenarios"><CircleHelp size={15} aria-hidden="true" />
          <p>Try the demo: <strong>SPY</strong> to {DECISION_LABELS.INVERTIR.toLowerCase()}, <strong>BTCUSDT</strong> to {DECISION_LABELS.ESPERAR.toLowerCase()} (event), <strong>ETHUSDT</strong> to {DECISION_LABELS.ESPERAR.toLowerCase()} (risk), or <strong>NVDA</strong> for {DECISION_LABELS.NO_POR_AHORA.toLowerCase()}.</p>
        </div>
      )}
    </section>
  )
}
