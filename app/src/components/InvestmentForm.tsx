import { ArrowRight, CircleHelp, LoaderCircle, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react'
import type { FormEvent } from 'react'
import type { AssetsResponse, RiskProfile } from '../api/types'
import { HORIZONS } from '../config'
import { DECISION_LABELS, PROFILE_LABELS } from '../lib/labels'
import AssetPicker from './AssetPicker'
import CurrencyAmountInput from '../currency/CurrencyAmountInput'

export interface PlanDraft {
  simbolo: string
  monto: string
  plazo_dias: number
  perfil: RiskProfile
  tipos: string[]
}

export type PlannerMode = 'asset' | 'plan'

interface Props {
  assets: AssetsResponse | null
  draft: PlanDraft
  onChange: (value: PlanDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  pending: boolean
  isDemo: boolean
  unavailable: boolean
  mode: PlannerMode
  onModeChange: (mode: PlannerMode) => void
  typesError: string | null
  stage?: 'setup' | 'workspace'
}

const profiles = [
  { value: 'conservador', detail: 'Keep risk lower', Icon: ShieldCheck },
  { value: 'moderado', detail: 'Find a balance', Icon: SlidersHorizontal },
  { value: 'agresivo', detail: 'Accept more risk', Icon: Zap },
] as const

export default function InvestmentForm({ assets, draft, onChange, onSubmit, pending, isDemo, unavailable,
  mode, onModeChange, typesError, stage = 'workspace' }: Props) {
  const count = assets ? Object.values(assets).flat().length : 0
  return (
    <section className={'planner-panel' + (stage === 'setup' ? ' planner-panel-setup' : '')} aria-labelledby="plan-heading">
      {stage === 'setup' ? <div className="plan-heading-row"><div>
        <p className="plan-step">Start here</p>
        <h1 id="plan-heading">Your plan</h1>
        <p className="plan-intro">Set your budget, time horizon and comfort with risk. Then see what could work for you.</p>
      </div></div> : <h2 id="plan-heading" tabIndex={-1}>Your plan</h2>}
      <fieldset className="mode-selector">
        <legend>How would you like to start?</legend>
        <div className="planner-mode-options">
          {([['asset', 'I have an asset in mind'], ['plan', 'Help me choose']] as const).map(([value, label]) => (
            <label className={'planner-mode-option' + (mode === value ? ' selected' : '')} key={value}>
              <input type="radio" name="planner-mode" value={value} checked={mode === value}
                onChange={() => onModeChange(value)} aria-controls="investment-form" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <form id="investment-form" onSubmit={onSubmit}>
        {mode === 'asset' && <div className="field field-asset">
          <label htmlFor="asset">What are you exploring?</label>
          <AssetPicker assets={assets} symbol={draft.simbolo} unavailable={unavailable} describedBy="asset-hint"
            onChange={(simbolo) => onChange({ ...draft, simbolo })} />
          <span className="field-hint" id="asset-hint">{count ? count + ' assets, from ETFs to crypto'
            : unavailable ? 'Use Try again above to reload your options' : 'Getting your options ready'}</span>
        </div>}

        <div className="field field-amount">
          <label htmlFor="amount">How much would you invest?</label>
          <CurrencyAmountInput value={draft.monto} hintId="amount-hint"
            onChange={(monto) => onChange({ ...draft, monto })} />
        </div>

        <fieldset className="field field-horizon">
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
        {mode === 'plan' && <fieldset className="field asset-types" id="asset-types" tabIndex={-1}
          aria-describedby={'asset-types-hint' + (typesError ? ' asset-types-error' : '')}
          aria-invalid={Boolean(typesError)} disabled={!assets}>
          <legend>What types of assets interest you?</legend>
          <div className="asset-type-options">
            {assets && Object.keys(assets).map((group, index) => (
              <label className="asset-type-option" key={group}>
                <input type="checkbox" name="asset-types" id={'asset-type-' + index} value={group}
                  checked={draft.tipos.includes(group)} aria-invalid={Boolean(typesError)}
                  onChange={(event) => onChange({ ...draft, tipos: event.target.checked
                    ? [...draft.tipos, group] : draft.tipos.filter((type) => type !== group) })} />
                <span>{group}</span>
              </label>
            ))}
          </div>
          <p className="field-hint" id="asset-types-hint">Choose one or more asset types.
            {!assets && (unavailable ? ' Use Try again above to reload your options.' : ' Loading asset types…')}</p>
          {typesError && <p className="field-error" id="asset-types-error" role="alert">{typesError}</p>}
        </fieldset>}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={!assets || pending}>
            {pending ? <><LoaderCircle size={18} aria-hidden="true" />Checking…</>
              : <>{mode === 'plan' ? 'Build my plan' : 'Get my answer'} <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
          <p className="form-footnote">No account or payment required.</p>
          {stage === 'setup' && pending && <p className="setup-progress" role="status">
            {mode === 'plan' ? 'Comparing your asset types. Your plan will appear here.' : 'Checking your asset. Your answer will appear here.'}
          </p>}
        </div>
      </form>
      {isDemo && mode === 'asset' && (
        <div className="demo-scenarios"><CircleHelp size={15} aria-hidden="true" />
          <p>Try the demo: <strong>SPY</strong> to {DECISION_LABELS.INVERTIR.toLowerCase()}, <strong>BTCUSDT</strong> to {DECISION_LABELS.ESPERAR.toLowerCase()} (event), <strong>ETHUSDT</strong> to {DECISION_LABELS.ESPERAR.toLowerCase()} (risk), or <strong>NVDA</strong> for {DECISION_LABELS.NO_POR_AHORA.toLowerCase()}.</p>
        </div>
      )}
    </section>
  )
}
