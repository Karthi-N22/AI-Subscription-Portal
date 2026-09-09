import { useState } from 'react'
import { Icon } from '../components/ui'
import type { Subscription } from '../types/portal'
import type { Project } from '../types'
import type { Invoice } from '../api/invoices'
import { chipTone } from '../utils/chip'
import { useCurrency } from '../contexts/CurrencyContext'

type Props = { items: Subscription[]; projects: Project[]; invoices: Invoice[]; month: string; project: string; setProject: (value: string) => void; query: string; setQuery: (value: string) => void; onExportExcel: () => void; onOpen: (id: string) => void; onUploadInvoice: (subscriptionId: string, file: File) => Promise<void> }

export function SubscriptionsPage({ items, projects, invoices, month, project, setProject, query, setQuery, onExportExcel, onOpen, onUploadInvoice }: Props) {
  const { format } = useCurrency()
  const totalSpend = items.reduce((sum, item) => sum + item.usd, 0)
  const totalBudget = projects.reduce((sum, item) => sum + (item.monthlyBudget ?? 0), 0)
  const subscribedUsers = items.reduce((sum, item) => sum + item.subscribedUsers, 0)
  const budgetRemaining = totalBudget - totalSpend
  const displayMonth = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return <section className="subscription-ledger"><div className="ledger-summary"><Metric label="MONTHLY SPEND" value={format(totalSpend)} detail={displayMonth} /><Metric label="BUDGET USED" value={totalBudget ? `${Math.round((totalSpend / totalBudget) * 100)}%` : '—'} detail={totalBudget ? `${format(totalSpend)} of ${format(totalBudget)}` : 'No budgets set'} /><Metric label="REMAINING BUDGET" value={totalBudget ? format(Math.max(budgetRemaining, 0)) : '—'} detail={budgetRemaining < 0 ? 'Over budget' : 'Across selected projects'} /><Metric label="SUBSCRIBED USERS" value={String(subscribedUsers)} detail="Assigned users in this ledger" /></div><section className="panel table-panel"><div className="panel-title"><div><h2>{displayMonth} subscriptions</h2><p>{items.length} entries maintained across {projects.length} projects</p></div><div className="title-actions"><button className="button primary" onClick={onExportExcel}>⇩ Export Excel</button></div></div><div className="filters"><label><Icon name="search" /><input placeholder="Search services or payees" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select value={project} onChange={(event) => setProject(event.target.value)}><option>All projects</option>{projects.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><select><option>All statuses</option><option>Active</option><option>Cancelled</option></select><select><option>All payment modes</option><option>Company card</option><option>Bank transfer</option></select></div><div className="table-wrap"><table><thead><tr><th>SERVICE</th><th>BILLING CYCLE</th><th>PROJECT</th><th>PAYEE</th><th>COST</th><th>PAYMENT MODE</th><th>SUBSCRIBED USERS</th><th>RENEWAL DATE</th><th>INVOICE</th></tr></thead><tbody>{items.map((item) => { const [firstUser, ...otherUsers] = item.subscribedUserNames; return <tr key={item.id}><td><button className="link-cell" onClick={() => onOpen(item.id)}><strong>{item.service}</strong></button></td><td>{item.cycle}</td><td><span className={`chip ${chipTone(item.project)}`}>{item.project}</span></td><td>{item.vendor}</td><td><strong>{format(item.usd)}</strong>{item.currency !== 'USD' && <small>{item.currency} {item.nativeCost.toFixed(2)}</small>}</td><td><span className={`chip ${chipTone(item.payment)}`}>{item.payment}</span></td><td>{firstUser ? <span className="user-cell"><span>{firstUser}</span>{otherUsers.length > 0 && <span className="chip-more" title={otherUsers.join(', ')}>+{otherUsers.length}</span>}</span> : <span className="cell-muted">No users assigned</span>}</td><td>{item.renewal}</td><td><InvoiceCell invoice={invoices.find((invoice) => invoice.subscriptionId === item.id)} onUpload={(file) => onUploadInvoice(item.id, file)} /></td></tr> })}</tbody></table></div></section></section>
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="ledger-summary-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }
function InvoiceCell({ invoice, onUpload }: { invoice: Invoice | undefined; onUpload: (file: File) => Promise<void> }) {
  const [uploading, setUploading] = useState(false)
  if (invoice?.fileUrl) return <a className="invoice-link has-file" href={invoice.fileUrl} target="_blank" rel="noreferrer" title={`Download ${invoice.fileName}`}><Icon name="file" /></a>
  const submit = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try { await onUpload(file) } finally { setUploading(false) }
  }
  return <label className={uploading ? 'invoice-link uploading' : 'invoice-link'} title="Attach invoice (PDF, max 2MB, optional)">
    {uploading ? '…' : <Icon name="file" />}
    <input type="file" accept="application/pdf" hidden disabled={uploading} onChange={submit} />
  </label>
}
