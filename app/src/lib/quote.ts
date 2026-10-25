export interface AssetQuote {
  currency: 'USD' | 'MXN' | 'GBp' | 'USDT' | 'FX'
  divisor: number
  unit: string
  note: string
}

export function quoteForSymbol(symbol: string): AssetQuote {
  if (symbol.endsWith('.MX')) {
    return { currency: 'MXN', divisor: 1, unit: 'MXN', note: 'Prices in MXN (Mexican pesos).' }
  }
  if (symbol.endsWith('.L')) {
    return {
      currency: 'GBp', divisor: 100, unit: 'GBP',
      note: 'Prices in GBP (£), converted from GBp (100 pence = £1).',
    }
  }
  if (symbol.endsWith('USDT')) {
    return { currency: 'USDT', divisor: 1, unit: 'USDT', note: 'Prices in USDT.' }
  }
  if (symbol.endsWith('=X')) {
    const pair = /^([A-Z]{3})([A-Z]{3})=X$/.exec(symbol)
    const unit = symbol === 'MXN=X' ? 'MXN per USD' : pair ? pair[2] + ' per ' + pair[1] : ''
    return {
      currency: 'FX', divisor: 1, unit,
      note: unit ? 'Exchange rate: ' + unit + '.' : 'Exchange rate.',
    }
  }
  return { currency: 'USD', divisor: 1, unit: 'USD', note: 'Prices in USD (US dollars).' }
}

function formatQuote(symbol: string, rawValue: number, compact: boolean, locale = 'en-GB'): string {
  const quote = quoteForSymbol(symbol)
  const digits = quote.currency === 'FX' ? 4 : 2
  const number = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale, {
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(rawValue / quote.divisor)

  if (quote.currency === 'GBp') return '£' + number
  if (quote.currency === 'MXN') return 'MX$' + number
  if (quote.currency === 'USD') return '$' + number
  if (compact) return number
  const separators: Record<string, string> = { 'es-419': 'por', 'zh-CN': '/', fr: 'pour', it: 'per' }
  const unit = quote.unit.replace(' per ', ' ' + (separators[locale] ?? 'per') + ' ')
  return unit ? number + ' ' + unit : number
}

export function formatQuotePrice(symbol: string, rawValue: number, locale = 'en-GB'): string {
  return formatQuote(symbol, rawValue, false, locale)
}

export function formatQuoteTick(symbol: string, rawValue: number, locale = 'en-GB'): string {
  return formatQuote(symbol, rawValue, true, locale)
}
