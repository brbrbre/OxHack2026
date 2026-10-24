import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CURRENCIES, currencyName, formatLocalAmount, fromUsd, toUsd } from './currency'
import type { CurrencyCode } from './currency'
import { useCurrency } from './CurrencyContext'
import { ECB_REFERENCE_RATES } from './referenceRates'
import { dateLabel, money as usdMoney } from '../lib/format'
import './currency.css'

interface Props {
  value: string
  onChange: (canonicalUsd: string) => void
  id?: string
  hintId: string
  hint?: string
}

export default function CurrencyAmountInput({ value, onChange, id = 'amount', hintId, hint }: Props) {
  const { currency, setCurrency } = useCurrency()
  const [edit, setEdit] = useState<{ usd: string; currency: CurrencyCode; text: string } | null>(null)
  const metadata = CURRENCIES.find((item) => item.code === currency)!
  const localValue = edit?.usd === value && edit.currency === currency ? edit.text
    : value === '' ? '' : currency === 'USD' && /^\d+(?:\.\d{0,2})?$/.test(value)
      ? value : formatLocalAmount(Number(value), currency)

  function changeAmount(text: string) {
    const usd = text === '' ? '' : String(toUsd(Number(text), currency))
    setEdit({ usd, currency, text })
    onChange(usd)
  }

  return <>
    <div className="amount-control">
      <span aria-hidden="true">{metadata.symbol}</span>
      <input id={id} name="amount" type="number" inputMode="decimal" min="0"
        max={Math.ceil(fromUsd(1_000_000_000, currency) * 100) / 100} step="any" required value={localValue}
        onChange={(event) => changeAmount(event.target.value)} aria-describedby={hintId} />
      <span className="currency-select-wrap">
        <select aria-label="Budget currency" title={currencyName(currency)} value={currency}
          onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>
          {CURRENCIES.map(({ code, name }) => <option value={code} key={code} title={name}
            aria-label={code + ' — ' + name}>{code}</option>)}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </span>
    </div>
    <p className="field-hint currency-budget-hint" id={hintId}>
      {hint ?? 'Your total budget in ' + currencyName(currency) + 's.'}
      {currency !== 'USD' && value !== '' && Number.isFinite(Number(value)) && <span> ≈ {usdMoney(Number(value))} USD</span>}
    </p>
    {currency !== 'USD' && <details className="currency-reference">
      <summary>Demo FX · ECB, {dateLabel(ECB_REFERENCE_RATES.date, true)}</summary>
      <p>Fixed reference rates, not live quotes. Estimates are calculated in USD; changing currency keeps the same budget.</p>
      <p><a href={ECB_REFERENCE_RATES.sourceUrl} target="_blank" rel="noreferrer">European Central Bank reference rates</a> · {ECB_REFERENCE_RATES.date}</p>
    </details>}
  </>
}
