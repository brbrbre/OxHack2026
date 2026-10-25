export interface AssetIdentity {
  className: string
  color: string
  logo?: string
  flags?: readonly [string, string]
  badge?: string
}

const logoRoot = '/assets/logos/'

function mark(token: string, logo?: string, badge?: string): AssetIdentity {
  return { className: 'asset-color-' + token, color: 'var(--asset-' + token + ')',
    ...(logo ? { logo: logoRoot + logo } : {}), ...(badge ? { badge } : {}) }
}

// Presentation metadata only. The selectable catalogue always comes from /api/assets.
const identities: Readonly<Record<string, AssetIdentity>> = {
  SPY: mark('spy', 'spdr.svg', 'ETF'),
  VOO: mark('voo', 'vanguard.svg'),
  QQQ: mark('qqq', 'invesco-qqq.svg', 'ETF'),
  GLD: mark('gold', 'gold-bar.svg', 'ETF'),
  AAPL: mark('apple', 'apple.svg'),
  MSFT: mark('microsoft', 'microsoft.svg'),
  NVDA: mark('nvidia', 'nvidia-green.svg'),
  'WALMEX.MX': mark('walmart', 'walmart.svg'),
  'AMXB.MX': mark('america-movil', 'america-movil-symbol.svg', 'AM'),
  'FEMSAUBD.MX': mark('femsa', 'femsa.svg', 'F'),
  'VOD.L': mark('vodafone', 'vodafone-red.svg'),
  'HSBA.L': mark('hsbc', 'hsbc-red.svg'),
  'SHEL.L': mark('shell', 'shell-color.svg'),
  '^GSPC': mark('sp500', 'sp500-index.svg', 'IDX'),
  '^FTSE': mark('ftse', 'ftse.svg', 'IDX'),
  '^MXX': mark('ipc', 'ipc-index.svg', 'IDX'),
  'GBPUSD=X': { ...mark('gbp-usd'), flags: [logoRoot + 'gb.svg', logoRoot + 'us.svg'] },
  'MXN=X': { ...mark('usd-mxn'), flags: [logoRoot + 'us.svg', logoRoot + 'mx.svg'] },
  BTCUSDT: mark('bitcoin', 'btc.svg'),
  ETHUSDT: mark('ethereum', 'eth.svg'),
  SOLUSDT: mark('solana', 'sol.svg'),
  // Reserved identities for a future API catalogue; these do not add assets to the form.
  GOOG: mark('google', 'google.svg'),
  GOOGL: mark('google', 'google.svg'),
  TSLA: mark('tesla', 'tesla-red.svg'),
}

export function assetIdentity(symbol: string): AssetIdentity {
  const normalized = symbol.trim().toUpperCase()
  if (Object.hasOwn(identities, normalized)) return identities[normalized]
  // A newly added backend asset still gets a stable identity, independent of portfolio order.
  let hash = 0
  for (const character of normalized) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  const badge = normalized.replace(/[^A-Z0-9]/g, '').slice(0, 2) || '?'
  return mark('fallback-' + hash % 6, undefined, badge)
}
