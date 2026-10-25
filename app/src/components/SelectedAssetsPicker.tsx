import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { AssetsResponse } from '../api/types'
import { useI18n } from '../i18n/I18nContext'
import AssetLogo from './AssetLogo'
import AssetPicker from './AssetPicker'
import '../selected-assets.css'

interface Props {
  assets: AssetsResponse | null
  symbols: string[]
  onChange: (symbols: string[]) => void
  unavailable: boolean
  describedBy?: string
}

export function uniqueAssetSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.filter((symbol) => symbol.trim() !== ''))]
}

export function selectedDraftSymbols(draft: { simbolo: string; simbolos?: string[] }): string[] {
  return uniqueAssetSymbols(draft.simbolos ?? [draft.simbolo])
}

export function SelectedAssetsSplit({ count }: { count: number; amount: string }) {
  const { t } = useI18n()
  if (count < 2) return null
  return <p className="selected-assets-split" role="note">
    <strong>{t('Selected assets: {count}', { count })}</strong>
    <span>{t('Horizon will build a plan using only your selected assets. Amounts may differ, and some money may stay in cash.')}</span>
  </p>
}

export default function SelectedAssetsPicker({ assets, symbols, onChange, unavailable, describedBy }: Props) {
  const { t } = useI18n()
  const selected = uniqueAssetSymbols(symbols)
  const catalogue = Object.values(assets ?? {}).flat()
  const available: AssetsResponse | null = assets ? Object.fromEntries(Object.entries(assets).flatMap(([group, items]) => {
    const remaining = items.filter((asset) => !selected.includes(asset.simbolo))
    return remaining.length ? [[group, remaining] as const] : []
  })) : null
  const allSelected = catalogue.length > 0 && Object.values(available ?? {}).every((items) => items.length === 0)
  const root = useRef<HTMLDivElement>(null)
  const focusAfterRemoval = useRef(false)

  useEffect(() => {
    if (!focusAfterRemoval.current) return
    focusAfterRemoval.current = false
    root.current?.querySelector<HTMLInputElement>('[role="combobox"]')?.focus({ preventScroll: true })
  }, [symbols])

  return <div className="selected-assets-picker" ref={root}>
    {selected.length > 0 && <ul className="selected-assets-list" aria-label={t('Selected assets')}>
      {selected.map((symbol) => {
        const asset = catalogue.find((item) => item.simbolo === symbol)
        return <li className="selected-asset" key={symbol}>
          <AssetLogo symbol={symbol} size="small" />
          <span className="selected-asset-copy"><strong>{asset?.nombre ?? symbol}</strong><small>{symbol}</small></span>
          <button type="button" className="selected-asset-remove"
            aria-label={t('Remove {asset}', { asset: asset ? asset.nombre + ' (' + symbol + ')' : symbol })}
            onClick={() => {
              focusAfterRemoval.current = true
              onChange(selected.filter((item) => item !== symbol))
            }}><X size={15} aria-hidden="true" /></button>
          <input type="hidden" name="selected-assets" value={symbol} />
        </li>
      })}
    </ul>}
    {allSelected ? <div className="asset-picker-control is-disabled">
      <input id="asset" className="asset-picker-input" type="text" value={t('All available assets selected')}
        readOnly disabled aria-describedby={describedBy} />
    </div> : <AssetPicker assets={available} symbol="" unavailable={unavailable} describedBy={describedBy}
      onChange={(symbol) => {
        if (!selected.includes(symbol)) onChange([...selected, symbol])
      }} />}
    <p className="field-hint selected-assets-help" role="status">{t(selected.length === 0 ? 'Choose at least one asset.'
      : allSelected ? 'Remove an asset to change your selection.' : 'Search again to add another asset.')}</p>
  </div>
}
