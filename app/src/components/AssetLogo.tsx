import { useState } from 'react'
import { assetIdentity } from '../lib/assetIdentity'

interface Props {
  symbol: string
  size?: 'small' | 'medium'
}

export default function AssetLogo({ symbol, size = 'medium' }: Props) {
  const identity = assetIdentity(symbol)
  const [failedSources, setFailedSources] = useState<string[]>([])
  const fallback = identity.badge ?? symbol.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()
  function fail(source: string) {
    setFailedSources((current) => current.includes(source) ? current : [...current, source])
  }
  const flagsAvailable = identity.flags && !identity.flags.some((source) => failedSources.includes(source))
  return (
    <span className={'asset-logo asset-logo-' + size + ' ' + identity.className +
      (identity.badge ? ' asset-logo-badge' : '')} aria-hidden="true">
      {flagsAvailable && identity.flags ? <span className="asset-logo-flags">
        {identity.flags.map((source) => <img key={source} src={source} alt="" width={20} height={20}
          onError={() => fail(source)} draggable={false} />)}
      </span> : identity.logo && !failedSources.includes(identity.logo)
        ? <img src={identity.logo} alt="" width={32} height={32} draggable={false}
          onError={() => fail(identity.logo!)} />
        : <span className="asset-logo-letters">{fallback || '?'}</span>}
    </span>
  )
}
