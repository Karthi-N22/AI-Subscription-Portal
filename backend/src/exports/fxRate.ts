let cachedRate: number | null = null
let cachedAt = 0
const CACHE_TTL_MS = 30 * 60 * 1000

async function fetchFromPrimary(): Promise<number> {
  const response = await fetch('https://open.er-api.com/v6/latest/USD')
  if (!response.ok) throw new Error(`Primary FX source failed: ${response.status}`)
  const json = (await response.json()) as { rates?: Record<string, number> }
  const rate = json.rates?.INR
  if (!rate) throw new Error('Primary FX source did not return an INR rate')
  return rate
}

async function fetchFromFallback(): Promise<number> {
  const response = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=INR')
  if (!response.ok) throw new Error(`Fallback FX source failed: ${response.status}`)
  const json = (await response.json()) as { rates?: Record<string, number> }
  const rate = json.rates?.INR
  if (!rate) throw new Error('Fallback FX source did not return an INR rate')
  return rate
}

// Live USD->INR rate, cached briefly so repeated exports don't hammer the free FX APIs.
// Falls back to a second independent source, then to the last known-good rate, before giving up.
export async function getUsdToInrRate(): Promise<number> {
  const now = Date.now()
  if (cachedRate != null && now - cachedAt < CACHE_TTL_MS) return cachedRate
  try {
    const rate = await fetchFromPrimary()
    cachedRate = rate
    cachedAt = now
    return rate
  } catch {
    try {
      const rate = await fetchFromFallback()
      cachedRate = rate
      cachedAt = now
      return rate
    } catch {
      if (cachedRate != null) return cachedRate
      throw new Error('Unable to fetch a live USD to INR rate and no cached rate is available')
    }
  }
}
