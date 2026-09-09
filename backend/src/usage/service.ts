import type { ApiProvider } from '@prisma/client'
import { prisma } from '../prisma.js'
import { decrypt, encrypt } from '../crypto.js'
import { fetchAnthropicUsage, fetchCursorUsage } from './providers.js'

export type Granularity = 'day' | 'week' | 'month'

const DEFAULT_WINDOW_DAYS: Record<Granularity, number> = { day: 30, week: 84, month: 365 }

export function saveCredential(subscriptionId: string, provider: ApiProvider, apiKey: string) {
  const apiKeyEncrypted = encrypt(apiKey)
  return prisma.apiCredential.upsert({
    where: { subscriptionId },
    create: { subscriptionId, provider, apiKeyEncrypted },
    update: { provider, apiKeyEncrypted },
  })
}

export async function syncSubscriptionUsage(subscriptionId: string) {
  const credential = await prisma.apiCredential.findUnique({ where: { subscriptionId } })
  if (!credential) throw new Error('No API credential saved for this subscription')
  const apiKey = decrypt(credential.apiKeyEncrypted)
  const date = new Date().toISOString().slice(0, 10)
  const usage = credential.provider === 'CURSOR' ? await fetchCursorUsage(apiKey, date) : await fetchAnthropicUsage(apiKey, date)
  return prisma.usageRecord.upsert({
    where: { subscriptionId_date: { subscriptionId, date: new Date(date) } },
    create: { subscriptionId, date: new Date(date), ...usage },
    update: { ...usage },
  })
}

type UsageBucket = { bucket: Date; promptTokens: bigint | number; completionTokens: bigint | number; totalTokens: bigint | number; requestCount: bigint | number; costUsd: string | null }

export async function getUsageReport(subscriptionId: string, granularity: Granularity, from?: string, to?: string) {
  const unit = (['day', 'week', 'month'] as Granularity[]).includes(granularity) ? granularity : 'day'
  const to_ = to ? new Date(to) : new Date()
  const from_ = from ? new Date(from) : new Date(to_.getTime() - DEFAULT_WINDOW_DAYS[unit] * 24 * 60 * 60 * 1000)

  const rows = await prisma.$queryRaw<UsageBucket[]>`
    SELECT date_trunc(${unit}, "date") AS bucket,
           SUM("promptTokens") AS "promptTokens",
           SUM("completionTokens") AS "completionTokens",
           SUM("totalTokens") AS "totalTokens",
           SUM("requestCount") AS "requestCount",
           SUM("costUsd") AS "costUsd"
    FROM "UsageRecord"
    WHERE "subscriptionId" = ${subscriptionId} AND "date" >= ${from_} AND "date" <= ${to_}
    GROUP BY bucket
    ORDER BY bucket ASC
  `

  return rows.map((row) => ({
    bucketStart: row.bucket.toISOString().slice(0, 10),
    promptTokens: Number(row.promptTokens),
    completionTokens: Number(row.completionTokens),
    totalTokens: Number(row.totalTokens),
    requestCount: Number(row.requestCount),
    costUsd: row.costUsd == null ? null : Number(row.costUsd),
  }))
}
