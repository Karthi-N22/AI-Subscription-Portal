import { useEffect, useRef, useState } from 'react'
import { Button, Icon, type IconName } from '../components/ui'
import { getUsage, saveApiKey, syncUsage, type Granularity, type UsagePoint } from '../api/usage'
import { detectProvider } from '../utils/provider'
import { chipTone } from '../utils/chip'
import { useCurrency } from '../contexts/CurrencyContext'
import type { Subscription } from '../types/portal'

type Tab = 'Overview' | 'Usage'

function PersonIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>
}

export function SubscriptionDetailPage({ subscription, onBack }: { subscription: Subscription; onBack: () => void }) {
  const provider = detectProvider(subscription.service)
  const [tab, setTab] = useState<Tab>('Overview')

  return <section className="subscription-detail">
    <div className="detail-head">
      <button className="detail-back" onClick={onBack}><span aria-hidden="true">←</span> All subscriptions</button>
      <div>
        <div className="eyebrow">{subscription.project}</div>
        <h1>{subscription.service}</h1>
      </div>
    </div>
    <div className="detail-tabs">
      <button className={tab === 'Overview' ? 'active' : ''} onClick={() => setTab('Overview')}>Overview</button>
      {provider && <button className={tab === 'Usage' ? 'active' : ''} onClick={() => setTab('Usage')}>Usage</button>}
    </div>
    {tab === 'Overview' && <OverviewTab subscription={subscription} />}
    {tab === 'Usage' && provider && <UsageTab subscription={subscription} provider={provider} />}
  </section>
}

function OverviewTab({ subscription }: { subscription: Subscription }) {
  const { format } = useCurrency()
  const tiles: { icon: IconName; tone: string; label: string; value: string }[] = [
    { icon: 'person', tone: 'coral', label: 'Payee', value: subscription.vendor },
    { icon: 'card', tone: 'violet', label: 'Monthly cost', value: format(subscription.usd) },
    { icon: 'chart', tone: 'orange', label: 'Renewal date', value: subscription.renewal },
    { icon: 'file', tone: 'blue', label: 'Billing cycle', value: subscription.cycle },
    { icon: 'upload', tone: 'mint', label: 'Payment mode', value: subscription.payment },
  ]
  return <section className="panel detail-overview">
    <div className="info-tiles">{tiles.map((tile) => <div className="info-tile" key={tile.label}><span className={`service-mark ${tile.tone}`}><Icon name={tile.icon} /></span><div><span>{tile.label}</span><strong>{tile.value}</strong></div></div>)}</div>
    <div className="detail-divider" />
    <div className="detail-field full-width">
      <span>Subscribed users ({subscription.subscribedUsers})</span>
      {subscription.subscribedUserNames.length ? <div className="user-avatar-list">{subscription.subscribedUserNames.map((name) => <div className="user-avatar-item" key={name}><span className={`service-mark round mark-sm ${chipTone(name)}`}><PersonIcon /></span><strong>{name}</strong></div>)}</div> : <p className="cell-muted">No users assigned yet.</p>}
    </div>
  </section>
}

const GRANULARITIES: Granularity[] = ['day', 'week', 'month']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index)

function UsageTab({ subscription, provider }: { subscription: Subscription; provider: 'CURSOR' | 'ANTHROPIC' }) {
  const { format } = useCurrency()
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [customRange, setCustomRange] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [points, setPoints] = useState<UsagePoint[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().slice(0, 10)
  const from = customRange && customFrom ? customFrom : `${year}-01-01`
  const to = customRange && customTo ? customTo : year === CURRENT_YEAR ? today : `${year}-12-31`

  const loadUsage = () => {
    setLoading(true)
    getUsage(subscription.id, granularity, from, to).then((response) => setPoints(response.data)).catch(() => setMessage('Unable to load usage data.')).finally(() => setLoading(false))
  }

  useEffect(() => { loadUsage() }, [subscription.id, granularity, from, to])

  const submitApiKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true)
    try { await saveApiKey(subscription.id, provider, apiKey.trim()); setApiKey(''); setMessage('API key saved.') }
    catch { setMessage('Unable to save API key — admin access is required.') }
    finally { setSaving(false) }
  }

  const runSync = async () => {
    setSyncing(true)
    try { await syncUsage(subscription.id); setMessage('Usage synced.'); loadUsage() }
    catch { setMessage('Sync failed — check the saved API key.') }
    finally { setSyncing(false) }
  }

  const metricLabel = provider === 'CURSOR' ? 'Requests' : 'Tokens'
  const metricValue = (point: UsagePoint) => provider === 'CURSOR' ? point.requestCount : point.totalTokens
  const rangeLabel = customRange && (customFrom || customTo) ? `Viewing ${customFrom || '…'} to ${customTo || '…'}` : `Viewing usage for ${year}`

  return <section className="panel detail-usage">
    <form className="usage-key-form" onSubmit={submitApiKey}>
      <label>{provider === 'CURSOR' ? 'Cursor' : 'Anthropic'} API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste API key" autoComplete="off" /></label>
      <Button variant="primary" type="submit" disabled={saving || !apiKey.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
      <Button onClick={runSync} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync now'}</Button>
    </form>
    {message && <p className="usage-message">{message}</p>}

    <div className="usage-toolbar">
      <div className="usage-range-label">{rangeLabel}</div>
      <div className="usage-controls">
        {!customRange && <label className="year-select">Year<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{YEARS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
        <div className="granularity-toggle">{GRANULARITIES.map((value) => <button key={value} className={granularity === value ? 'active' : ''} onClick={() => setGranularity(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
        <button className="link" onClick={() => { setCustomRange(!customRange); setCustomFrom(''); setCustomTo('') }}>{customRange ? 'Use year picker' : 'Custom date range'}</button>
      </div>
    </div>
    {customRange && <div className="usage-range">
      <label>From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
      <label>To<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
    </div>}

    {loading ? <p className="account-info-loading">Loading usage…</p> : points.length === 0 ? <p className="cell-muted">No usage synced yet for this range. Save an API key and hit "Sync now".</p> : <>
      <UsageChart points={points} label={metricLabel} value={metricValue} />
      <div className="table-wrap"><table><thead><tr><th>DATE</th><th>TOKENS</th><th>REQUESTS</th><th>COST</th></tr></thead><tbody>{points.map((point) => <tr key={point.bucketStart}><td>{point.bucketStart}</td><td>{point.totalTokens.toLocaleString()}</td><td>{point.requestCount.toLocaleString()}</td><td>{point.costUsd == null ? '—' : format(point.costUsd)}</td></tr>)}</tbody></table></div>
    </>}
  </section>
}

function UsageChart({ points, label, value }: { points: UsagePoint[]; label: string; value: (point: UsagePoint) => number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const width = 640
  const height = 200
  const padding = { top: 16, right: 16, bottom: 28, left: 44 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const values = points.map(value)
  const maxValue = Math.max(1, ...values)
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const coords = points.map((point, index) => ({ x: padding.left + stepX * index, y: padding.top + plotHeight - (value(point) / maxValue) * plotHeight }))
  const pathD = coords.map((c, index) => `${index === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relativeX = ((event.clientX - rect.left) / rect.width) * width
    const index = stepX > 0 ? Math.round((relativeX - padding.left) / stepX) : 0
    setHover(Math.min(Math.max(index, 0), points.length - 1))
  }

  const hoverPoint = hover != null ? points[hover] : null
  const hoverCoord = hover != null ? coords[hover] : null

  return <div className="usage-chart">
    <div className="usage-chart-title">{label} over time</div>
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="chart-axis" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="chart-axis" />
      <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" className="chart-axis-label">{maxValue.toLocaleString()}</text>
      <text x={padding.left - 8} y={height - padding.bottom} textAnchor="end" className="chart-axis-label">0</text>
      <path d={pathD} fill="none" className="chart-line" strokeLinecap="round" strokeLinejoin="round" />
      {hoverCoord && <line x1={hoverCoord.x} y1={padding.top} x2={hoverCoord.x} y2={height - padding.bottom} className="chart-crosshair" />}
      {hoverCoord && <circle cx={hoverCoord.x} cy={hoverCoord.y} r="4" className="chart-dot" />}
    </svg>
    {hoverPoint && hoverCoord && <div className="chart-tooltip" style={{ left: `${(hoverCoord.x / width) * 100}%`, top: `${(hoverCoord.y / height) * 100}%` }}><strong>{value(hoverPoint).toLocaleString()}</strong><span>{hoverPoint.bucketStart}</span></div>}
  </div>
}
