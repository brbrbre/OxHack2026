import type { AssetsResponse } from '../api/types'

export const assets: AssetsResponse = {
  'ETFs': [
    { simbolo: 'SPY', nombre: 'S&P 500 (SPDR)' },
    { simbolo: 'VOO', nombre: 'S&P 500 (Vanguard)' },
    { simbolo: 'QQQ', nombre: 'Nasdaq 100' },
    { simbolo: 'GLD', nombre: 'Gold' },
  ],
  'US stocks': [
    { simbolo: 'AAPL', nombre: 'Apple' },
    { simbolo: 'MSFT', nombre: 'Microsoft' },
    { simbolo: 'NVDA', nombre: 'NVIDIA' },
  ],
  'Mexican stocks (BMV)': [
    { simbolo: 'WALMEX.MX', nombre: 'Walmart de México' },
    { simbolo: 'AMXB.MX', nombre: 'América Móvil' },
    { simbolo: 'FEMSAUBD.MX', nombre: 'FEMSA' },
  ],
  'UK stocks': [
    { simbolo: 'VOD.L', nombre: 'Vodafone' },
    { simbolo: 'HSBA.L', nombre: 'HSBC' },
    { simbolo: 'SHEL.L', nombre: 'Shell' },
  ],
  'Indices': [
    { simbolo: '^GSPC', nombre: 'S&P 500' },
    { simbolo: '^FTSE', nombre: 'FTSE 100' },
    { simbolo: '^MXX', nombre: 'S&P/BMV IPC' },
  ],
  'Currencies': [
    { simbolo: 'GBPUSD=X', nombre: 'British pound / US dollar' },
    { simbolo: 'MXN=X', nombre: 'US dollar / Mexican peso' },
  ],
  'Crypto': [
    { simbolo: 'BTCUSDT', nombre: 'Bitcoin' },
    { simbolo: 'ETHUSDT', nombre: 'Ethereum' },
    { simbolo: 'SOLUSDT', nombre: 'Solana' },
  ],
}

export function findAsset(symbol: string) {
  return Object.values(assets).flat().find((asset) => asset.simbolo === symbol)
}
