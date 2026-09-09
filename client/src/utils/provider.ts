export type UsageProvider = 'CURSOR' | 'ANTHROPIC'

export function detectProvider(serviceName: string): UsageProvider | null {
  const value = serviceName.toLowerCase()
  if (value.includes('cursor')) return 'CURSOR'
  if (value.includes('claude') || value.includes('anthropic')) return 'ANTHROPIC'
  return null
}
