import { ArrowRight, CircleHelp, LoaderCircle, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react'
import type { FormEvent } from 'react'
import type { AssetsResponse, RiskProfile } from '../api/types'
import { HORIZONS } from '../config'
import { DECISION_LABELS, PROFILE_LABELS } from '../lib/labels'
import CurrencyAmountInput from '../currency/CurrencyAmountInput'
import { useI18n } from '../i18n/I18nContext'
import SelectedAssetsPicker, { SelectedAssetsSplit, selectedDraftSymbols } from './SelectedAssetsPicker'

export interface PlanDraft {
  simbolo: string
  simbolos?: string[]
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
  const selected = selectedDraftSymbols(draft)
  const { t } = useI18n()
  return (
    <section className={'planner-panel' + (stage === 'setup' ? ' planner-panel-setup' : '')} aria-labelledby="plan-heading">
      {stage === 'setup' ? <div className="plan-heading-row"><div>
        <p className="plan-step">{t('Start here')}</p>
        <h1 id="plan-heading">{t('Your plan')}</h1>
        <p className="plan-intro">{t('Set your budget, time horizon and comfort with risk. Then see what could work for you.')}</p>
      </div></div> : <h2 id="plan-heading" tabIndex={-1}>{t('Your plan')}</h2>}
      <fieldset className="mode-selector">
        <legend>{t('How would you like to start?')}</legend>
        <div className="planner-mode-options">
          {([['asset', 'I have assets in mind'], ['plan', 'Help me choose']] as const).map(([value, label]) => (
            <label className={'planner-mode-option' + (mode === value ? ' selected' : '')} key={value}>
              <input type="radio" name="planner-mode" value={value} checked={mode === value}
                onChange={() => onModeChange(value)} aria-controls="investment-form" />
              <span>{t(label)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <form id="investment-form" onSubmit={onSubmit}>
        {mode === 'asset' && <div className="field field-asset">
          <label htmlFor="asset">{t('What are you exploring?')}</label>
          <SelectedAssetsPicker assets={assets} symbols={selected} unavailable={unavailable} describedBy="asset-hint"
            onChange={(simbolos) => onChange({ ...draft, simbolos, simbolo: simbolos[0] ?? '' })} />
          <span className="field-hint" id="asset-hint">{count ? t('{count} assets, from ETFs to crypto', { count })
            : unavailable ? t('Use Try again above to reload your options') : t('Getting your options ready')}</span>
        </div>}

        <div className="field field-amount">
          <label htmlFor="amount">{t('How much would you invest?')}</label>
          <CurrencyAmountInput value={draft.monto} hintId="amount-hint"
            onChange={(monto) => onChange({ ...draft, monto })} />
          {mode === 'asset' && <SelectedAssetsSplit count={selected.length} amount={draft.monto} />}
        </div>

        <fieldset className="field field-horizon">
          <legend>{t('What is your time horizon?')}</legend>
          <div className="horizon-options">
            {HORIZONS.map((days) => (
              <label className={'horizon-option' + (draft.plazo_dias === days ? ' selected' : '')} key={days}>
                <input type="radio" name="horizon" value={days} checked={draft.plazo_dias === days}
                  onChange={() => onChange({ ...draft, plazo_dias: days })} />
                <span aria-hidden="true">{days}<small>{t('d')}</small></span><span className="sr-only">{t('{days} days', { days })}</span>
              </label>
            ))}
          </div>
          <span className="field-hint">{t('How long you plan to stay invested')}</span>
        </fieldset>

        <fieldset className="field risk-field">
          <legend>{t('How do you feel about risk?')}</legend>
          <div className="risk-options">
            {profiles.map(({ value, detail, Icon }) => (
              <label key={value} className={'risk-option' + (draft.perfil === value ? ' selected' : '')}>
                <input type="radio" name="risk" value={value} checked={draft.perfil === value}
                  onChange={() => onChange({ ...draft, perfil: value })} />
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                <span className="risk-copy"><strong>{t(PROFILE_LABELS[value])}</strong><span>{t(detail)}</span></span>
                <span className="radio-indicator" aria-hidden="true" />
              </label>
            ))}
          </div>
        </fieldset>
        {mode === 'plan' && <fieldset className="field asset-types" id="asset-types" tabIndex={-1}
          aria-describedby={'asset-types-hint' + (typesError ? ' asset-types-error' : '')}
          aria-invalid={Boolean(typesError)} disabled={!assets}>
          <legend>{t('What types of assets interest you?')}</legend>
          <div className="asset-type-options">
            {assets && Object.keys(assets).map((group, index) => (
              <label className="asset-type-option" key={group}>
                <input type="checkbox" name="asset-types" id={'asset-type-' + index} value={group}
                  checked={draft.tipos.includes(group)} aria-invalid={Boolean(typesError)}
                  onChange={(event) => onChange({ ...draft, tipos: event.target.checked
                    ? [...draft.tipos, group] : draft.tipos.filter((type) => type !== group) })} />
                <span>{t(group)}</span>
              </label>
            ))}
          </div>
          <p className="field-hint" id="asset-types-hint">{t('Choose one or more asset types.')}
            {!assets && ' ' + (unavailable ? t('Use Try again above to reload your options.') : t('Loading asset types…'))}</p>
          {typesError && <p className="field-error" id="asset-types-error" role="alert">{typesError}</p>}
        </fieldset>}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={!assets || pending || (mode === 'asset' && selected.length === 0)}>
            {pending ? <><LoaderCircle size={18} aria-hidden="true" />{t('Checking…')}</>
              : <>{t(mode === 'plan' ? 'Build my plan' : 'Get my answer')} <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
          <p className="form-footnote">{t('No account or payment required.')}</p>
          {stage === 'setup' && pending && <p className="setup-progress" role="status">
            {t(mode === 'plan' ? 'Comparing your asset types. Your plan will appear here.' : 'Checking your assets. Your answer will appear here.')}
          </p>}
        </div>
      </form>
      {isDemo && mode === 'asset' && (
        <div className="demo-scenarios"><CircleHelp size={15} aria-hidden="true" />
          <p>{t('Try the demo: {invest} to {investDecision}, {event} to {waitDecision} (event), {risk} to {waitDecision} (risk), or {notNow} for {notNowDecision}.', {
            invest: 'SPY', investDecision: t(DECISION_LABELS.INVERTIR).toLocaleLowerCase(), event: 'BTCUSDT',
            waitDecision: t(DECISION_LABELS.ESPERAR).toLocaleLowerCase(), risk: 'ETHUSDT', notNow: 'NVDA',
            notNowDecision: t(DECISION_LABELS.NO_POR_AHORA).toLocaleLowerCase(),
          })}</p>
        </div>
      )}
    </section>
  )
}
