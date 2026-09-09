import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getFxRate } from '../api/fxRate'
import { formatUsd, type Currency } from '../utils/currency'

// Fallback used only until the live rate loads (or if the FX endpoint is unreachable) - not a source of truth.
const FALLBACK_RATE = 83

type CurrencyContextValue = { currency: Currency; setCurrency: (value: Currency) => void; rate: number; format: (amountUsd: number) => string }

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(() => { const stored = localStorage.getItem('ec-labs-currency'); return stored === 'INR' ? 'INR' : 'USD' })
  const [rate, setRate] = useState(FALLBACK_RATE)

  useEffect(() => { localStorage.setItem('ec-labs-currency', currency) }, [currency])
  useEffect(() => { getFxRate().then((response) => setRate(response.data.rate)).catch(() => {}) }, [])

  const format = (amountUsd: number) => formatUsd(amountUsd, currency, rate)

  return <CurrencyContext.Provider value={{ currency, setCurrency, rate, format }}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider')
  return context
}
