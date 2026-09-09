export type Currency = 'USD' | 'INR'

const SYMBOLS: Record<Currency, string> = { USD: '$', INR: '₹' }

export function convertFromUsd(amountUsd: number, currency: Currency, usdToInrRate: number): number {
  return currency === 'INR' ? amountUsd * usdToInrRate : amountUsd
}

export function formatUsd(amountUsd: number, currency: Currency, usdToInrRate: number): string {
  const value = convertFromUsd(amountUsd, currency, usdToInrRate)
  return `${SYMBOLS[currency]}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
