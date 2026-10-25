import { useEffect } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react'
import type { AssetsResponse } from '../api/types'
import { HORIZONS } from '../config'
import { useCurrency } from '../currency/CurrencyContext'
import CurrencyAmountInput from '../currency/CurrencyAmountInput'
import { useI18n } from '../i18n/I18nContext'
import { PROFILE_LABELS } from '../lib/labels'
import SelectedAssetsPicker, { SelectedAssetsSplit, selectedDraftSymbols } from './SelectedAssetsPicker'
import type { PlanDraft, PlannerMode } from './InvestmentForm'

export type GuidedStep = 0 | 1 | 2 | 3

const steps = ['Budget', 'Time', 'Risk', 'Review'] as const
export const guidedHorizons: Record<number, string> = {
  7: 'A week', 30: 'A month', 90: '3 months', 180: '6 months', 365: 'A year',
}

const riskChoices = [
  { value: 'conservador', label: 'I prefer smaller ups and downs' },
  { value: 'moderado', label: 'I’m comfortable with some ups and downs' },
  { value: 'agresivo', label: 'I’m comfortable with larger ups and downs' },
] as const

const questions = [
  ['How much would you like to explore investing?', 'Use an amount you’re curious about. Choose your currency beside the amount.'],
  ['How long would you leave it invested?', 'This helps us look at a period that matches your plans.'],
  ['How do you feel about ups and downs?', 'Investments can gain or lose value. Choose what you feel comfortable with.'],
  ['Does this look like your plan?', 'Check your choices, then tell us what you would like to explore.'],
] as const

const groupHelp: Record<string, string> = {
  ETFs: 'Funds that hold a basket of investments',
  'US stocks': 'Shares in US companies',
  'Mexican stocks (BMV)': 'Shares in Mexican companies',
  'UK stocks': 'Shares in UK companies',
  Indices: 'Benchmarks that track groups of investments',
  Currencies: 'Exchange rates between currencies',
  Crypto: 'Digital assets such as Bitcoin',
}

export interface GuidedPlannerProps {
  active?: boolean
  assets: AssetsResponse | null
  draft: PlanDraft
  onChange: (draft: PlanDraft) => void
  mode: PlannerMode
  onModeChange: (mode: PlannerMode) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  pending: boolean
  unavailable: boolean
  typesError: string | null
  step: GuidedStep
  onStepChange: (step: GuidedStep) => void
  onChooseDifferent: () => void
  onUseQuick: () => void
}

export default function GuidedPlanner({ assets, draft, onChange, mode, onModeChange, onSubmit,
  pending, unavailable, typesError, step, onStepChange, onChooseDifferent, onUseQuick, active = true }: GuidedPlannerProps) {
  const { money } = useCurrency()
  const { t } = useI18n()
  const selected = selectedDraftSymbols(draft)
  useEffect(() => {
    if (!active) return
    const heading = document.getElementById('guided-question-heading')
    heading?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 760px)').matches) {
      document.querySelector('.guided-progress')?.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  }, [step, active])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < 3) onStepChange((step + 1) as GuidedStep)
    else onSubmit(event)
  }

  return (
    <section className="planner-panel guided-planner" aria-labelledby="plan-heading">
      <div className="planner-route-bar">
        <button type="button" onClick={onChooseDifferent}><ArrowLeft size={15} aria-hidden="true" />{t('Change how I fill this in')}</button>
        <button type="button" onClick={onUseQuick}>{t('Use the quick form')}</button>
      </div>
      <h1 id="plan-heading">{t('Your plan')}</h1>
      <div className="guided-progress">
        <p>{t('Step {step} of {total}', { step: step + 1, total: steps.length })}</p>
        <ol aria-label={t('Plan setup progress')}>
          {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}>
            <span>{index + 1}</span>{t(label)}
          </li>)}
        </ol>
      </div>
      <div className="guided-question">
        <h2 id="guided-question-heading" tabIndex={-1}>{t(questions[step][0])}</h2>
        <p>{t(questions[step][1])}</p>
      </div>
      <form className="guided-form" onSubmit={submit}>
        {step === 0 && <div className="field">
          <label htmlFor="amount">{t('Amount to explore')}</label>
          <CurrencyAmountInput value={draft.monto} hintId="guided-amount-hint"
            hint={t('Your budget for this example. You can change it later.')}
            onChange={(monto) => onChange({ ...draft, monto })} />
        </div>}
        {step === 1 && <fieldset className="field">
          <legend className="sr-only">{t('How long would you leave it invested?')}</legend>
          <div className="horizon-options guided-time-options">
            {HORIZONS.map((days) => <label key={days} className={'horizon-option' + (draft.plazo_dias === days ? ' selected' : '')}>
              <input type="radio" name="horizon" value={days} checked={draft.plazo_dias === days}
                onChange={() => onChange({ ...draft, plazo_dias: days })} />
              <span>{t(guidedHorizons[days])}</span>
            </label>)}
          </div>
        </fieldset>}
        {step === 2 && <fieldset className="field">
          <legend className="sr-only">{t('Your comfort with risk')}</legend>
          <div className="guided-risk-options">
            {riskChoices.map(({ value, label }) => <label key={value} className={'guided-risk-option' + (draft.perfil === value ? ' selected' : '')}>
              <input type="radio" name="risk" value={value} checked={draft.perfil === value}
                onChange={() => onChange({ ...draft, perfil: value })} />
              <strong>{t(label)}</strong><span>{t(PROFILE_LABELS[value])}</span>
            </label>)}
          </div>
        </fieldset>}
        {step === 3 && <>
          <div className="guided-review">
            <dl>
              <div><dt>{t('Budget')}</dt><dd>{money(Number(draft.monto))}</dd></div>
              <div><dt>{t('Time invested')}</dt><dd>{t(guidedHorizons[draft.plazo_dias])} ({t('{days} days', { days: draft.plazo_dias })})</dd></div>
              <div><dt>{t('Comfort with risk')}</dt><dd>{t(PROFILE_LABELS[draft.perfil])}</dd></div>
            </dl>
          </div>
          <fieldset className="guided-investment-choice field">
            <legend>{t('Have something in mind?')}</legend>
            <div className="planner-mode-options">
              {([['plan', 'Help me explore'], ['asset', 'I have something in mind']] as const).map(([value, label]) => (
                <label key={value} className={'planner-mode-option' + (mode === value ? ' selected' : '')}>
                  <input type="radio" name="planner-mode" value={value} checked={mode === value}
                    onChange={() => onModeChange(value)} /><span>{t(label)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {mode === 'asset' ? <div className="field">
            <label htmlFor="asset">{t('Find investments by name or symbol')}</label>
            <SelectedAssetsPicker assets={assets} symbols={selected}
              onChange={(simbolos) => onChange({ ...draft, simbolos, simbolo: simbolos[0] ?? '' })}
              unavailable={unavailable} describedBy="guided-asset-hint" />
            <p className="field-hint" id="guided-asset-hint">{t('Choose one or more investments, such as Apple or Gold.')}</p>
            <SelectedAssetsSplit count={selected.length} amount={draft.monto} />
          </div> : <fieldset className="field asset-types" id="asset-types" tabIndex={-1} disabled={!assets}
            aria-invalid={Boolean(typesError)} aria-describedby={'guided-types-hint' + (typesError ? ' asset-types-error' : '')}>
            <legend>{t('What would you like to explore?')}</legend>
            <p className="field-hint guided-group-help" id="guided-types-hint">{t('Choose one or more types of investments to compare.')}</p>
            <div className="asset-type-options">
              {assets && Object.keys(assets).map((group) => <label className="asset-type-option" key={group}>
                <input type="checkbox" name="asset-types" value={group} checked={draft.tipos.includes(group)}
                  onChange={(event) => onChange({ ...draft, tipos: event.target.checked
                    ? [...draft.tipos, group] : draft.tipos.filter((type) => type !== group) })} />
                <span>{t(group)}{groupHelp[group] && <small className="field-hint">{t(groupHelp[group])}</small>}</span>
              </label>)}
            </div>
            {!assets && <p className="field-hint">{t(unavailable ? 'Use Try again above to reload your options.' : 'Getting your options ready…')}</p>}
            {typesError && <p className="field-error" id="asset-types-error" role="alert">{typesError}</p>}
          </fieldset>}
        </>}
        <div className="guided-actions">
          <button type="button" onClick={() => step === 0 ? onChooseDifferent() : onStepChange((step - 1) as GuidedStep)}>
            <ArrowLeft size={16} aria-hidden="true" />{t('Back')}
          </button>
          <button type="submit" className="primary-button" disabled={pending || (step === 3 && (!assets || (mode === 'asset' && selected.length === 0)))}>
            {pending ? <><LoaderCircle size={18} aria-hidden="true" />{t('Checking…')}</>
              : <>{t(step === 3 ? 'See my plan' : 'Continue')}<ArrowRight size={18} aria-hidden="true" /></>}
          </button>
        </div>
        {pending && <p className="setup-progress" role="status">{t('Checking your choices. Your plan will appear here.')}</p>}
        <p className="form-footnote">{t('No account or payment required.')}</p>
      </form>
    </section>
  )
}
