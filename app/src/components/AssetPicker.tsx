import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { Asset, AssetsResponse } from '../api/types'
import AssetLogo from './AssetLogo'

interface Props {
  assets: AssetsResponse | null
  symbol: string
  onChange: (symbol: string) => void
  unavailable: boolean
  describedBy?: string
}

interface AssetGroup {
  name: string
  assets: Asset[]
}

function searchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en')
}

export function filterAssetGroups(assets: AssetsResponse | null, query: string): AssetGroup[] {
  const words = searchText(query).trim().split(/\s+/).filter(Boolean)
  return Object.entries(assets ?? {}).map(([name, items]) => ({
    name,
    assets: items.filter((asset) => {
      const searchable = searchText(asset.nombre + ' ' + asset.simbolo)
      return words.every((word) => searchable.includes(word))
    }),
  })).filter((group) => group.assets.length > 0)
}

export function nextAssetIndex(current: number, count: number, key: string): number {
  if (count === 0) return -1
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowUp') return current <= 0 ? count - 1 : current - 1
  return current < 0 || current === count - 1 ? 0 : current + 1
}

export default function AssetPicker({ assets, symbol, onChange, unavailable, describedBy }: Props) {
  const instanceId = useId()
  const listboxId = instanceId + '-assets'
  const instructionsId = instanceId + '-instructions'
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<string, HTMLDivElement>())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const selected = Object.values(assets ?? {}).flat().find((asset) => asset.simbolo === symbol)
  const disabled = !assets || Object.values(assets).every((items) => items.length === 0)
  const groups = filterAssetGroups(assets, query)
  const options = groups.flatMap((group) => group.assets)
  const activeIndex = options.findIndex((asset) => asset.simbolo === activeSymbol)
  const selectedLabel = selected ? selected.nombre + ' (' + selected.simbolo + ')' : ''

  function close() {
    setOpen(false)
    setQuery('')
    setActiveSymbol(null)
  }

  function showOptions() {
    if (disabled) return
    setQuery('')
    setActiveSymbol(selected?.simbolo ?? Object.values(assets ?? {}).flat()[0]?.simbolo ?? null)
    setOpen(true)
  }

  function choose(asset: Asset) {
    onChange(asset.simbolo)
    close()
  }

  useEffect(() => {
    if (!open) return
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  useEffect(() => {
    const menu = menuRef.current
    const option = activeSymbol ? optionRefs.current.get(activeSymbol) : null
    if (!open || !menu || !option) return
    const menuBounds = menu.getBoundingClientRect()
    const optionBounds = option.getBoundingClientRect()
    if (optionBounds.top < menuBounds.top) menu.scrollTop -= menuBounds.top - optionBounds.top
    else if (optionBounds.bottom > menuBounds.bottom) menu.scrollTop += optionBounds.bottom - menuBounds.bottom
  }, [open, activeSymbol, query])

  useEffect(() => {
    if (disabled) close()
  }, [disabled])

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || (open && (event.key === 'Home' || event.key === 'End'))) {
      event.preventDefault()
      if (!open) {
        showOptions()
        return
      }
      setActiveSymbol(options[nextAssetIndex(activeIndex, options.length, event.key)]?.simbolo ?? null)
    } else if (event.key === 'Enter' && open) {
      event.preventDefault()
      const active = options[activeIndex]
      if (active) choose(active)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      close()
    } else if (!open && !event.ctrlKey && !event.metaKey && !event.altKey
      && (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')) {
      event.preventDefault()
      const nextQuery = event.key.length === 1 ? event.key : ''
      setQuery(nextQuery)
      setActiveSymbol(filterAssetGroups(assets, nextQuery)[0]?.assets[0]?.simbolo ?? null)
      setOpen(true)
    }
  }

  return (
    <div className="asset-picker" ref={rootRef}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}>
      <div className={'asset-picker-control' + (disabled ? ' is-disabled' : '')}>
        <span className="asset-picker-leading" aria-hidden="true">
          {open ? <Search size={20} /> : selected ? <AssetLogo symbol={selected.simbolo} size="small" /> : <Search size={20} />}
        </span>
        <input id="asset" ref={inputRef} className="asset-picker-input" type="text" role="combobox"
          value={open ? query : selectedLabel} disabled={disabled} autoComplete="off" spellCheck={false}
          placeholder={disabled ? unavailable ? 'Assets unavailable' : 'Loading assets…' : 'Search name or symbol'}
          aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? listboxId + '-option-' + activeIndex : undefined}
          aria-describedby={[describedBy, instructionsId].filter(Boolean).join(' ')}
          onFocus={showOptions} onClick={() => { if (!open) showOptions() }}
          onChange={(event) => {
            const value = event.target.value
            const nextQuery = !open && selectedLabel && value.startsWith(selectedLabel) ? value.slice(selectedLabel.length) : value
            setQuery(nextQuery)
            setOpen(true)
            setActiveSymbol(filterAssetGroups(assets, nextQuery)[0]?.assets[0]?.simbolo ?? null)
          }}
          onKeyDown={handleKeyDown} />
        <button type="button" className="asset-picker-toggle" tabIndex={-1} disabled={disabled}
          aria-label={open ? 'Close asset options' : 'Show asset options'} aria-expanded={open} aria-controls={open ? listboxId : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) close()
            else {
              inputRef.current?.focus({ preventScroll: true })
              showOptions()
            }
          }}><ChevronDown size={16} aria-hidden="true" /></button>
      </div>
      <input type="hidden" name="asset" value={selected?.simbolo ?? ''} />
      <span id={instructionsId} className="sr-only">Type a name or symbol. Use the arrow keys to browse, Enter to choose, and Escape to close.</span>
      {open && <div className="asset-picker-menu" ref={menuRef} id={listboxId} role="listbox" aria-label="Available assets">
        {groups.length ? groups.map((group) => <div className="asset-picker-group" key={group.name} role="group" aria-label={group.name}>
          <div className="asset-picker-group-label" aria-hidden="true">{group.name}</div>
          {group.assets.map((asset) => {
            const index = options.findIndex((item) => item.simbolo === asset.simbolo)
            return <div className="asset-picker-option" id={listboxId + '-option-' + index}
              key={asset.simbolo} role="option" aria-selected={asset.simbolo === symbol}
              data-active={asset.simbolo === activeSymbol}
              ref={(element) => { if (element) optionRefs.current.set(asset.simbolo, element); else optionRefs.current.delete(asset.simbolo) }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveSymbol(asset.simbolo)}
              onClick={() => choose(asset)}>
              <AssetLogo symbol={asset.simbolo} size="small" />
              <span className="asset-picker-copy"><strong>{asset.nombre}</strong><small>{asset.simbolo}</small></span>
              {asset.simbolo === symbol && <Check size={16} className="asset-picker-check" aria-hidden="true" />}
            </div>
          })}
        </div>) : <p className="asset-picker-empty" role="status">No assets match “{query}”. Try a name or symbol.</p>}
      </div>}
    </div>
  )
}
