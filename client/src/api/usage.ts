import { apiRequest } from './client'
import type { UsageProvider } from '../utils/provider'

export type Granularity = 'day' | 'week' | 'month'
export type UsagePoint = { bucketStart: string; promptTokens: number; completionTokens: number; totalTokens: number; requestCount: number; costUsd: number | null }

export function saveApiKey(subscriptionId: string, provider: UsageProvider, apiKey: string) {
  return apiRequest<{ data: { id: string; provider: UsageProvider } }>(`/subscriptions/${subscriptionId}/api-key`, { method: 'POST', body: JSON.stringify({ provider, apiKey }) })
}

export function syncUsage(subscriptionId: string) {
  return apiRequest<{ data: UsagePoint }>(`/subscriptions/${subscriptionId}/usage/sync`, { method: 'POST' })
}

export function getUsage(subscriptionId: string, granularity: Granularity, from?: string, to?: string) {
  const params = new URLSearchParams({ granularity, ...(from ? { from } : {}), ...(to ? { to } : {}) })
  return apiRequest<{ data: UsagePoint[] }>(`/subscriptions/${subscriptionId}/usage?${params.toString()}`)
}
