import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { formatMoney } from './currency'
import type { CurrencyCode } from './currency'

interface CurrencyContextValue {
  currency: CurrencyCode
  setCurrency: (currency: CurrencyCode) => void
  money: (usdValue: number, signed?: boolean) => string
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  setCurrency: () => {},
  money: (value, signed = false) => formatMoney(value, 'USD', signed),
})

export function CurrencyProvider({ children, initialCurrency = 'USD' }: {
  children: ReactNode
  initialCurrency?: CurrencyCode
}) {
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency)
  const money = useCallback((value: number, signed = false) => formatMoney(value, currency, signed), [currency])
  const value = useMemo(() => ({ currency, setCurrency, money }), [currency, money])
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
