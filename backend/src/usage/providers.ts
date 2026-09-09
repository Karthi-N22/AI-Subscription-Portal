export type ProviderUsage = { promptTokens: number; completionTokens: number; totalTokens: number; requestCount: number; costUsd: number | null }

function dayRangeUtc(dateISO: string) {
  const start = new Date(`${dateISO}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

type CursorUsageRow = { composerRequests?: number; chatRequests?: number; agentRequests?: number }
type CursorUsageResponse = { data?: CursorUsageRow[]; pagination?: { hasNextPage?: boolean } }

// Cursor's Admin API exposes per-day request counts and lines-of-code metrics, not token counts,
// and its /teams/spend endpoint is a current balance snapshot with no date range - not a historical
// daily cost series. So promptTokens/completionTokens/totalTokens/costUsd are unavailable here.
export async function fetchCursorUsage(apiKey: string, dateISO: string): Promise<ProviderUsage> {
  const { start, end } = dayRangeUtc(dateISO)
  const auth = Buffer.from(`${apiKey}:`).toString('base64')
  let requestCount = 0
  let page = 1
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const response = await fetch('https://api.cursor.com/teams/daily-usage-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ startDate: start.getTime(), endDate: end.getTime(), page, pageSize: 1000 }),
    })
    if (!response.ok) throw new Error(`Cursor usage request failed: ${response.status}`)
    const json = (await response.json()) as CursorUsageResponse
    for (const row of json.data ?? []) requestCount += (row.composerRequests ?? 0) + (row.chatRequests ?? 0) + (row.agentRequests ?? 0)
    if (!json.pagination?.hasNextPage) break
    page += 1
  }
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, requestCount, costUsd: null }
}

type AnthropicUsageResult = { uncached_input_tokens: number; cache_read_input_tokens: number; cache_creation: { ephemeral_1h_input_tokens: number; ephemeral_5m_input_tokens: number }; output_tokens: number }
type AnthropicUsageResponse = { data?: Array<{ results?: AnthropicUsageResult[] }> }
type AnthropicCostResponse = { data?: Array<{ results?: Array<{ amount: string }> }> }

// Anthropic's usage report is organization-wide (not scoped to one subscription) and has no
// per-bucket request count - see plan doc for both limitations.
export async function fetchAnthropicUsage(apiKey: string, dateISO: string): Promise<ProviderUsage> {
  const { start, end } = dayRangeUtc(dateISO)
  const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }

  const usageResponse = await fetch(`https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${start.toISOString()}&ending_at=${end.toISOString()}&bucket_width=1d`, { headers })
  if (!usageResponse.ok) throw new Error(`Anthropic usage request failed: ${usageResponse.status}`)
  const usageJson = (await usageResponse.json()) as AnthropicUsageResponse
  let promptTokens = 0
  let completionTokens = 0
  for (const bucket of usageJson.data ?? []) {
    for (const result of bucket.results ?? []) {
      promptTokens += result.uncached_input_tokens + result.cache_read_input_tokens + result.cache_creation.ephemeral_1h_input_tokens + result.cache_creation.ephemeral_5m_input_tokens
      completionTokens += result.output_tokens
    }
  }

  const costResponse = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?starting_at=${start.toISOString()}&ending_at=${end.toISOString()}`, { headers })
  if (!costResponse.ok) throw new Error(`Anthropic cost request failed: ${costResponse.status}`)
  const costJson = (await costResponse.json()) as AnthropicCostResponse
  let costCents = 0
  for (const bucket of costJson.data ?? []) for (const result of bucket.results ?? []) costCents += Number(result.amount)

  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, requestCount: 0, costUsd: costCents / 100 }
}
