import { useEffect, useMemo, useState } from 'react'
import './App.css'
import './month.css'
import { Button, Icon } from './components/ui'
import { getDashboard, type DashboardData } from './api/dashboard'
import { changePassword, login } from './api/auth'
import { listInvoices } from './api/invoices'
import { listSeats, createSeat, type Seat } from './api/seats'
import { createSubscription, listSubscriptions } from './api/subscriptions'
import { listUsers, type WorkspaceUser } from './api/users'
import { listBudgets, updateBudget, type Budget } from './api/budgets'
import { createProject, listProjects } from './api/projects'
import { InvoicesPage, SeatsPage, UsersPage } from './pages/DataPages'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { SubscriptionDetailPage } from './pages/SubscriptionDetailPage'
import { AccountPage } from './pages/AccountPage'
import type { Page, Subscription } from './types/portal'
import type { Project } from './types'
import logoLight from './assets/logo-light.svg'
import { useCurrency } from './contexts/CurrencyContext'
import type { Currency } from './utils/currency'

type ScreenData = { seats: Seat[]; invoices: Awaited<ReturnType<typeof listInvoices>>['data']; budgets: Budget[]; users: WorkspaceUser[] }
type Modal = 'subscription' | 'seat' | 'project' | null
type NavItem = [Page, 'grid' | 'card' | 'users' | 'file' | 'chart' | 'person']
const navItems: NavItem[] = [['Dashboard', 'grid'], ['Projects', 'chart'], ['Subscriptions', 'card'], ['Seats', 'users'], ['Invoices', 'file'], ['Users', 'person']]
const PAGES: Page[] = ['Dashboard', 'Projects', 'Subscriptions', 'Seats', 'Invoices', 'Users', 'Account']
const emptyDashboard: DashboardData = { month: '2026-09', monthlySpend: 0, activeSubscriptions: 0, activeSeats: 0, upcomingRenewals: 0, renewals: [], projects: [] }
const months = Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`)
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export default function App() {
  const [page, setPage] = useState<Page>(() => { const stored = localStorage.getItem('ec-labs-page'); return PAGES.includes(stored as Page) ? (stored as Page) : 'Dashboard' })
  const [month, setMonth] = useState('2026-09')
  const [dark, setDark] = useState(false)
  const [projectFilter, setProjectFilter] = useState('All projects')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState('')
  const { currency, setCurrency } = useCurrency()
  const [loggedIn, setLoggedIn] = useState(() => Boolean(localStorage.getItem('ec-labs-auth-token')))
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(() => localStorage.getItem('ec-labs-subscription-id'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Subscription[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [screenData, setScreenData] = useState<ScreenData>({ seats: [], invoices: [], budgets: [], users: [] })
  const filtered = useMemo(() => items.filter((item) => (projectFilter === 'All projects' || item.project === projectFilter) && `${item.service} ${item.vendor}`.toLowerCase().includes(query.toLowerCase())), [items, projectFilter, query])
  useEffect(() => { localStorage.setItem('ec-labs-page', page) }, [page])
  useEffect(() => { if (selectedSubscriptionId) localStorage.setItem('ec-labs-subscription-id', selectedSubscriptionId); else localStorage.removeItem('ec-labs-subscription-id') }, [selectedSubscriptionId])
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200) }
  async function loadData(selectedMonth = month) { try { setLoading(true); setError(''); const [subscriptionResponse, dashboardResponse, seatResponse, invoiceResponse, budgetResponse, userResponse, projectResponse] = await Promise.all([listSubscriptions(selectedMonth), getDashboard(selectedMonth), listSeats(), listInvoices(selectedMonth), listBudgets(selectedMonth), listUsers(), listProjects()]); setItems(subscriptionResponse.data); setDashboard(dashboardResponse.data); setScreenData({ seats: seatResponse.data, invoices: invoiceResponse.data, budgets: budgetResponse.data, users: userResponse.data }); setUsers(userResponse.data); setProjects(projectResponse.data) } catch { setError('The API is unavailable. Start the backend on port 4000 and try again.') } finally { setLoading(false) } }
  useEffect(() => { void loadData(month) }, [month])
  async function saveSubscription(input: Record<string, unknown>) { try { const selectedUserIds = Array.isArray(input.selectedUserIds) ? input.selectedUserIds.map(String) : []; const response = await createSubscription({ ...input, selectedUserIds: undefined, month }); await Promise.all(users.filter((user) => selectedUserIds.includes(user.id)).map((user) => createSeat({ name: user.name, email: user.email, subscriptionId: response.data.id, licenseType: 'INDIVIDUAL' }))); setModal(null); await loadData(month); notify('Subscription and users saved') } catch { notify('Unable to save subscription') } }
  async function saveSeat(input: { name: string; email: string; subscriptionId: string; licenseType: 'INDIVIDUAL' | 'TEAM' }) { try { await createSeat(input); setModal(null); await loadData(month); notify('Seat assigned') } catch { notify('Unable to assign seat') } }
  async function saveProject(input: { name: string; monthlyBudget: number | null; budgetCurrency: string }) { try { await createProject(input); setModal(null); await loadData(month); notify('Project created') } catch { notify('Unable to create project') } }
  async function saveBudget(projectId: string, monthlyBudget: number) { try { await updateBudget(projectId, monthlyBudget); await loadData(month); notify('Budget updated') } catch { notify('Unable to update budget') } }
  async function changeAccountPassword(currentPassword: string, newPassword: string) { try { await changePassword(currentPassword, newPassword); notify('Password updated'); return true } catch { notify('Unable to update password — check your current password'); return false } }
  const exportExcel = () => { window.open(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'}/export/subscriptions.xlsx?month=${month}&currency=${currency}`, '_blank'); notify('Excel export opened') }
  if (!loggedIn) return <Login onLogin={async (email, password) => { const response = await login(email, password); localStorage.setItem('ec-labs-auth-token', response.data.token); setLoggedIn(true) }} />
  return <div className={dark ? 'app dark' : 'app'}><aside className="sidebar"><div className="brand"><span className="brand-logo-wrap"><img src={logoLight} alt="EC LABS" className="brand-logo" /></span></div><nav><small>WORKSPACE</small>{navItems.map(([label, icon]) => <button className={page === label ? 'nav active' : 'nav'} key={label} onClick={() => { setPage(label); setSelectedSubscriptionId(null) }}><Icon name={icon} />{label}</button>)}</nav></aside><main><header><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{page}</strong></div><div className="header-actions"><div className="currency-toggle">{(['USD', 'INR'] as Currency[]).map((value) => <button key={value} className={currency === value ? 'active' : ''} onClick={() => setCurrency(value)}>{value}</button>)}</div><button className="round" onClick={() => setDark(!dark)} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}><Icon name={dark ? 'moon' : 'sun'} /></button><button className="round" onClick={() => notify('You are all caught up')}><Icon name="bell" /></button><button className="top-avatar" onClick={() => { setPage('Account'); setSelectedSubscriptionId(null) }} title="Account settings" aria-label="Account settings">AM</button></div></header><div className="content">{page === 'Subscriptions' && selectedSubscriptionId && items.find((item) => item.id === selectedSubscriptionId) ? <SubscriptionDetailPage subscription={items.find((item) => item.id === selectedSubscriptionId)!} onBack={() => setSelectedSubscriptionId(null)} /> : <><section className="page-heading"><div><div className="eyebrow">{page === 'Account' ? 'ACCOUNT SETTINGS' : 'MONTHLY SUBSCRIPTION LEDGER'}</div><h1>{page === 'Dashboard' ? 'Good morning, Alex' : page}</h1><p>{page === 'Dashboard' ? 'Review spend, budgets, and renewals for the selected month.' : page === 'Account' ? 'Manage your profile and security settings.' : `Manage your ${page.toLowerCase()} workspace data.`}</p></div>{page !== 'Account' && <div className="heading-actions"><label className="month-switcher">Reporting month<select value={month} onChange={(event) => setMonth(event.target.value)}>{months.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}</select></label><Button variant="primary" onClick={() => setModal(page === 'Projects' ? 'project' : page === 'Seats' ? 'seat' : 'subscription')}>＋ {page === 'Projects' ? 'Create project' : page === 'Seats' ? 'Assign seat' : 'Add subscription'}</Button></div>}</section>{page !== 'Account' && loading && <div className="panel loading-state">Loading {monthLabel(month)} data…</div>}{page !== 'Account' && error && <div className="panel error-state">{error} <button className="link" onClick={() => void loadData(month)}>Retry</button></div>}{page === 'Account' ? <AccountPage onChangePassword={changeAccountPassword} onSignOut={() => { localStorage.removeItem('ec-labs-auth-token'); localStorage.removeItem('ec-labs-page'); localStorage.removeItem('ec-labs-subscription-id'); setLoggedIn(false) }} /> : !loading && !error && <Screen page={page} month={month} items={filtered} projects={projects} dashboard={dashboard} project={projectFilter} setProject={setProjectFilter} query={query} setQuery={setQuery} screenData={screenData} onBudgets={() => setPage('Projects')} onExportExcel={exportExcel} onSaveBudget={saveBudget} onOpenSubscription={setSelectedSubscriptionId} />}</>}</div></main>{modal === 'subscription' && <SubscriptionModal projects={projects} users={users} seats={screenData.seats} month={month} close={() => setModal(null)} save={saveSubscription} />}{modal === 'seat' && <SeatModal items={items} close={() => setModal(null)} save={saveSeat} />}{modal === 'project' && <ProjectModal close={() => setModal(null)} save={saveProject} />}{toast && <div className="toast">✓ {toast}</div>}</div>
}
function Screen({ page, month, items, projects, dashboard, project, setProject, query, setQuery, screenData, onBudgets, onExportExcel, onSaveBudget, onOpenSubscription }: { page: Page; month: string; items: Subscription[]; projects: Project[]; dashboard: DashboardData; project: string; setProject: (value: string) => void; query: string; setQuery: (value: string) => void; screenData: ScreenData; onBudgets: () => void; onExportExcel: () => void; onSaveBudget: (projectId: string, monthlyBudget: number) => Promise<void>; onOpenSubscription: (id: string) => void }) { if (page === 'Dashboard') return <DashboardPage items={items} dashboard={dashboard} onBudgets={onBudgets} />; if (page === 'Projects') return <ProjectsPage projects={screenData.budgets} monthLabel={monthLabel(month)} onSaveBudget={onSaveBudget} />; if (page === 'Subscriptions') return <SubscriptionsPage items={items} projects={projects} month={month} project={project} setProject={setProject} query={query} setQuery={setQuery} onExportExcel={onExportExcel} onOpen={onOpenSubscription} />; if (page === 'Seats') return <SeatsPage data={screenData.seats} />; if (page === 'Invoices') return <InvoicesPage data={screenData.invoices} />; return <UsersPage data={screenData.users} /> }
function SubscriptionModal({ projects, users, seats, month, close, save }: { projects: Project[]; users: WorkspaceUser[]; seats: Seat[]; month: string; close: () => void; save: (input: Record<string, unknown>) => Promise<void> }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const selectedProject = projects.find((item) => item.id === projectId)
  const projectEmails = new Set(seats.filter((seat) => seat.project === selectedProject?.name).map((seat) => seat.email))
  const projectUsers = users.filter((user) => projectEmails.has(user.email))
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void save({ serviceName: data.get('serviceName'), vendor: data.get('vendor'), projectId: data.get('projectId'), billingCycle: data.get('billingCycle'), nativeCost: Number(data.get('nativeCost')), usdMonthlyCost: Number(data.get('nativeCost')), currency: data.get('currency'), paymentMode: data.get('paymentMode'), renewalDate: data.get('renewalDate'), selectedUserIds: projectUsers.map((user) => user.id) }) }
  return <div className="backdrop" onClick={close}><form className="modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">MONTHLY LEDGER ENTRY</div><h2>Add subscription</h2><p>This entry will be recorded for {monthLabel(month)}.</p></div><button type="button" className="close" onClick={close}>×</button></div><div className="form-grid"><label>Service name<input name="serviceName" required placeholder="e.g. Notion AI" /></label><label>Payee / vendor<input name="vendor" required placeholder="Company name" /></label><label>Project<select name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Billing cycle<select name="billingCycle"><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option><option value="ONE_OFF">One-off</option></select></label><label>Cost<input name="nativeCost" required type="number" placeholder="0.00" /></label><label>Currency<select name="currency"><option>USD</option><option>EUR</option><option>GBP</option></select></label><label>Payment mode<select name="paymentMode"><option>Company card</option><option>Bank transfer</option></select></label><label>Renewal date<input name="renewalDate" required type="date" /></label><label className="full-field">Subscribed users<div className="user-fetch-list">{projectUsers.length ? projectUsers.map((user) => <span className="chip chip-accent" key={user.id}>{user.name}</span>) : <span className="user-fetch-empty">No existing team members found for {selectedProject?.name ?? 'this project'} yet.</span>}</div><small>Automatically fetched from {selectedProject?.name ?? 'the selected project'}'s existing team — they'll be given access to this subscription too.</small></label></div><div className="modal-actions"><Button onClick={close}>Cancel</Button><Button variant="primary" type="submit">Save {monthLabel(month)} entry</Button></div></form></div>
}
function SeatModal({ items, close, save }: { items: Subscription[]; close: () => void; save: (input: { name: string; email: string; subscriptionId: string; licenseType: 'INDIVIDUAL' | 'TEAM' }) => Promise<void> }) { const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void save({ name: String(data.get('name')), email: String(data.get('email')), subscriptionId: String(data.get('subscriptionId')), licenseType: data.get('licenseType') as 'INDIVIDUAL' | 'TEAM' }) }; return <div className="backdrop" onClick={close}><form className="modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">LICENSE MANAGEMENT</div><h2>Assign a seat</h2><p>Give a team member access to an existing subscription.</p></div><button type="button" className="close" onClick={close}>×</button></div><div className="form-grid"><label>Team member name<input name="name" required placeholder="e.g. Jamie Lee" /></label><label>Work email<input name="email" required type="email" placeholder="name@eclabs.co" /></label><label>Subscription<select name="subscriptionId">{items.map((item) => <option key={item.id} value={item.id}>{item.service} · {item.project}</option>)}</select></label><label>License type<select name="licenseType"><option value="INDIVIDUAL">Individual license</option><option value="TEAM">Team license</option></select></label></div><div className="modal-actions"><Button onClick={close}>Cancel</Button><Button variant="primary" type="submit">Assign seat</Button></div></form></div> }
function ProjectModal({ close, save }: { close: () => void; save: (input: { name: string; monthlyBudget: number | null; budgetCurrency: string }) => Promise<void> }) { const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const budget = String(data.get('monthlyBudget')); void save({ name: String(data.get('name')), monthlyBudget: budget ? Number(budget) : null, budgetCurrency: String(data.get('budgetCurrency')) }) }; return <div className="backdrop" onClick={close}><form className="modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">NEW COST CENTER</div><h2>Create project</h2><p>New projects will be available in subscription forms immediately.</p></div><button type="button" className="close" onClick={close}>×</button></div><div className="form-grid"><label>Project name<input name="name" required placeholder="e.g. Research Lab" /></label><label>Monthly budget<input name="monthlyBudget" type="number" min="0" step="0.01" placeholder="Optional" /></label><label>Budget currency<select name="budgetCurrency"><option>USD</option><option>EUR</option><option>GBP</option></select></label></div><div className="modal-actions"><Button onClick={close}>Cancel</Button><Button variant="primary" type="submit">Create project</Button></div></form></div> }
function Login({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await onLogin(String(data.get('email')), String(data.get('password'))) } catch { setError('Unable to sign in with those credentials.') } }
  return <div className="login-page">
   <div className="login-shell">
    <div className="login-hero">
      <div className="login-hero-glow" />
      <div className="login-hero-content">
        <span className="login-hero-logo-wrap"><img src={logoLight} alt="EC LABS" className="login-hero-logo" /></span>
        <h2>Every AI and software subscription, in one dashboard.</h2>
        <p>Track spend, manage seats, and stay ahead of renewals across your entire workspace — without digging through inboxes and spreadsheets.</p>
        <ul className="login-hero-points">
          <li><Icon name="chart" />Live monthly spend and budget tracking</li>
          <li><Icon name="users" />Seat and license management</li>
          <li><Icon name="file" />Invoices synced automatically</li>
        </ul>
        <div className="login-hero-stats">
          <div className="login-hero-card"><span>MONTHLY SPEND</span><strong>$984.99</strong></div>
          <div className="login-hero-card"><span>BUDGET USED</span><strong>65%</strong></div>
        </div>
      </div>
    </div>
    <div className="login-form-side">
      <form className="login-card" onSubmit={submit}>
        <div className="eyebrow">INTERNAL WORKSPACE</div>
        <h1>Welcome back</h1>
        <p>Sign in to manage your AI and software subscriptions.</p>
        <label>Work email<input name="email" type="email" placeholder="you@eclabs.co" required /></label>
        <label>Password<input name="password" type="password" placeholder="Enter your password" required /></label>
        {error && <p className="error-state">{error}</p>}
        <Button variant="primary" type="submit">Sign in</Button>
        <small>Access is restricted to invited EC LABS team members.</small>
      </form>
    </div>
   </div>
  </div>
}
