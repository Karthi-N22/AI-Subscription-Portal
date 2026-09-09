import { Router, type Request } from 'express'
import multer from 'multer'
import { projects, seats, seedCredentials, subscriptions, users } from './data/store.js'
import { getUsageReport, saveCredential, syncSubscriptionUsage, type Granularity } from './usage/service.js'
import { buildSubscriptionsWorkbook } from './exports/subscriptionsWorkbook.js'
import { getUsdToInrRate } from './exports/fxRate.js'
import { getInvoiceFile, listInvoiceUploads, saveInvoiceUpload } from './invoices/service.js'

export const router = Router()
const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })
const currentUser = (request: Request) => { const token = request.headers.authorization?.replace('Bearer ', ''); const userId = token?.startsWith('dev-token-') ? token.slice('dev-token-'.length) : null; return users.find((item) => item.id === userId) ?? null }
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const projectName = (projectId: string) => projects.find((project) => project.id === projectId)?.name ?? 'Unknown project'
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const monthLabel = (month: string) => { const [year, monthNumber] = month.split('-').map(Number); return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }

router.get('/dashboard', (request, response) => {
  const month = String(request.query.month ?? '2026-09')
  const monthlyItems = subscriptions.filter((item) => item.month === month)
  const monthlySpend = monthlyItems.filter((item) => item.status === 'ACTIVE').reduce((sum, item) => sum + item.usdMonthlyCost, 0)
  const renewals = monthlyItems.filter((item) => item.status === 'ACTIVE').sort((a, b) => a.renewalDate.localeCompare(b.renewalDate)).slice(0, 4)
  response.json({ data: { month, monthlySpend, activeSubscriptions: monthlyItems.filter((item) => item.status === 'ACTIVE').length, activeSeats: seats.length, upcomingRenewals: renewals.length, renewals, projects: projects.map((project) => ({ ...project, spend: monthlyItems.filter((item) => item.projectId === project.id).reduce((sum, item) => sum + item.usdMonthlyCost, 0) })) } })
})
router.get('/projects', (_request, response) => response.json({ data: projects }))
router.get('/subscription-months', (_request, response) => response.json({ data: Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`) }))
router.post('/projects', (request, response) => { const name = String(request.body.name ?? '').trim(); if (!name) return response.status(400).json({ error: 'Project name is required' }); if (projects.some((project) => project.name.toLowerCase() === name.toLowerCase())) return response.status(409).json({ error: 'Project already exists' }); const project = { id: id(), name, monthlyBudget: request.body.monthlyBudget == null || request.body.monthlyBudget === '' ? null : Number(request.body.monthlyBudget), budgetCurrency: String(request.body.budgetCurrency ?? 'USD') }; projects.push(project); return response.status(201).json({ data: project }) })
router.patch('/projects/:id', (request, response) => { const project = projects.find((item) => item.id === request.params.id); if (!project) return response.status(404).json({ error: 'Project not found' }); Object.assign(project, request.body); return response.json({ data: project }) })
router.get('/subscriptions', (request, response) => { const { month = '2026-09', projectId, status, paymentMode, search } = request.query; const data = subscriptions.filter((item) => item.month === month && (!projectId || item.projectId === projectId) && (!status || item.status === status) && (!paymentMode || item.paymentMode === paymentMode) && (!search || `${item.serviceName} ${item.vendor}`.toLowerCase().includes(String(search).toLowerCase()))).map((item) => { const assignedSeats = seats.filter((seat) => seat.subscriptionId === item.id); return { ...item, project: projectName(item.projectId), subscribedUsers: assignedSeats.length, subscribedUserNames: assignedSeats.map((seat) => seat.name) } }); return response.json({ data }) })
router.post('/subscriptions', (request, response) => { const subscription = { id: id(), month: request.body.month ?? '2026-09', ...request.body, status: request.body.status ?? 'ACTIVE' }; subscriptions.push(subscription); return response.status(201).json({ data: subscription }) })
router.patch('/subscriptions/:id', (request, response) => { const subscription = subscriptions.find((item) => item.id === request.params.id); if (!subscription) return response.status(404).json({ error: 'Subscription not found' }); Object.assign(subscription, request.body); return response.json({ data: subscription }) })
router.delete('/subscriptions/:id', (request, response) => { const index = subscriptions.findIndex((item) => item.id === request.params.id); if (index < 0) return response.status(404).json({ error: 'Subscription not found' }); subscriptions.splice(index, 1); return response.status(204).send() })
router.get('/seats', (request, response) => { const data = seats.map((seat) => ({ ...seat, subscription: subscriptions.find((item) => item.id === seat.subscriptionId), project: projectName(subscriptions.find((item) => item.id === seat.subscriptionId)?.projectId ?? '') })); return response.json({ data }) })
router.post('/seats', (request, response) => { const seat = { id: id(), assignedAt: new Date().toISOString(), licenseType: request.body.licenseType ?? 'INDIVIDUAL', ...request.body }; seats.push(seat); return response.status(201).json({ data: seat }) })
router.delete('/seats/:id', (request, response) => { const index = seats.findIndex((item) => item.id === request.params.id); if (index < 0) return response.status(404).json({ error: 'Seat not found' }); seats.splice(index, 1); return response.status(204).send() })
router.get('/invoices', async (request, response) => {
  const month = String(request.query.month ?? '2026-09')
  const monthlySubscriptions = subscriptions.filter((item) => item.month === month && (!request.query.subscriptionId || item.id === request.query.subscriptionId))
  try {
    const uploads = await listInvoiceUploads(month, monthlySubscriptions.map((item) => item.id))
    const apiBase = `${request.protocol}://${request.get('host')}/api`
    const data = monthlySubscriptions.map((subscription) => {
      const uploaded = uploads.find((item) => item.subscriptionId === subscription.id)
      const base = uploaded
        ? { id: uploaded.id, invoiceNumber: `INV-${month}-${subscription.id}`, billingPeriod: monthLabel(month), fileName: uploaded.fileName, fileUrl: `${apiBase}/invoice-uploads/${uploaded.id}/file`, amount: subscription.usdMonthlyCost, invoiceDate: uploaded.createdAt }
        : { id: `auto-${subscription.id}-${month}`, invoiceNumber: `AUTO-${month}-${subscription.id}`, billingPeriod: monthLabel(month), fileName: `${slugify(subscription.serviceName)}-${month}.pdf`, fileUrl: null, amount: subscription.usdMonthlyCost, invoiceDate: subscription.renewalDate }
      return { ...base, subscriptionId: subscription.id, serviceName: subscription.serviceName, project: projectName(subscription.projectId), autoGenerated: !uploaded }
    })
    return response.json({ data })
  } catch (error) { return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load invoices' }) }
})
router.post('/subscriptions/:id/invoices', uploadMiddleware.single('file'), async (request, response) => {
  const subscription = subscriptions.find((item) => item.id === request.params.id)
  if (!subscription) return response.status(404).json({ error: 'Subscription not found' })
  const user = currentUser(request)
  if (!user) return response.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'ADMIN') return response.status(403).json({ error: 'Admin access required' })
  const month = String(request.body.month ?? '').trim()
  if (!month) return response.status(400).json({ error: 'month is required' })
  if (!request.file) return response.status(400).json({ error: 'file is required' })
  if (request.file.mimetype !== 'application/pdf') return response.status(400).json({ error: 'Only PDF files are allowed' })
  try {
    const record = await saveInvoiceUpload(String(request.params.id), month, request.file, user.email)
    return response.status(201).json({ data: record })
  } catch (error) { return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to upload invoice' }) }
})
router.get('/invoice-uploads/:id/file', async (request, response) => {
  try {
    const record = await getInvoiceFile(request.params.id)
    if (!record) return response.status(404).json({ error: 'Invoice file not found' })
    response.setHeader('Content-Type', record.mimeType)
    response.setHeader('Content-Disposition', `inline; filename="${record.fileName}"`)
    return response.send(record.data)
  } catch (error) { return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load invoice file' }) }
})
router.get('/budgets', (request, response) => { const month = String(request.query.month ?? '2026-09'); return response.json({ data: projects.map((project) => ({ ...project, spend: subscriptions.filter((item) => item.projectId === project.id && item.month === month).reduce((sum, item) => sum + item.usdMonthlyCost, 0), history: [420, 510, 390, 580, 640] })) }) })
router.patch('/budgets/:projectId', (request, response) => { const project = projects.find((item) => item.id === request.params.projectId); if (!project) return response.status(404).json({ error: 'Project not found' }); project.monthlyBudget = Number(request.body.monthlyBudget); project.budgetCurrency = request.body.budgetCurrency ?? project.budgetCurrency; return response.json({ data: project }) })
router.get('/users', (_request, response) => response.json({ data: users }))
router.post('/users', (request, response) => { const user = { id: id(), ...request.body }; users.push(user); return response.status(201).json({ data: user }) })
router.post('/auth/login', (request, response) => { const user = users.find((item) => item.email === request.body.email); if (!user || request.body.password !== seedCredentials.password || request.body.email !== seedCredentials.email) return response.status(401).json({ error: 'Invalid credentials' }); return response.json({ data: { token: `dev-token-${user.id}`, user } }) })
router.get('/auth/me', (request, response) => { const token = request.headers.authorization?.replace('Bearer ', ''); const userId = token?.startsWith('dev-token-') ? token.slice('dev-token-'.length) : null; const user = users.find((item) => item.id === userId); if (!user) return response.status(401).json({ error: 'Not authenticated' }); return response.json({ data: user }) })
router.post('/auth/change-password', (request, response) => { const { currentPassword, newPassword } = request.body; if (!currentPassword || !newPassword) return response.status(400).json({ error: 'Current and new password are required' }); if (currentPassword !== seedCredentials.password) return response.status(401).json({ error: 'Current password is incorrect' }); if (String(newPassword).length < 8) return response.status(400).json({ error: 'New password must be at least 8 characters' }); seedCredentials.password = String(newPassword); return response.json({ data: { success: true } }) })
router.get('/export/subscriptions.csv', (_request, response) => { const header = 'Service,Payee,Project,Cost,USD monthly,Payment mode,Renewal date,Status'; const rows = subscriptions.map((item) => [item.serviceName, item.vendor, projectName(item.projectId), `${item.currency} ${item.nativeCost}`, item.usdMonthlyCost, item.paymentMode, item.renewalDate, item.status].join(',')); response.type('text/csv').send([header, ...rows].join('\n')) })
router.get('/export/subscriptions.xlsx', async (request, response) => {
  const month = String(request.query.month ?? '2026-09')
  const currency = String(request.query.currency ?? 'USD').toUpperCase() === 'INR' ? 'INR' : 'USD'
  try {
    const workbook = await buildSubscriptionsWorkbook(month, currency)
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response.setHeader('Content-Disposition', `attachment; filename="ec-labs-subscriptions-${month}-${currency}.xlsx"`)
    await workbook.xlsx.write(response)
    response.end()
  } catch (error) { response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to generate workbook' }) }
})
router.get('/fx-rate', async (_request, response) => {
  try { return response.json({ data: { base: 'USD', quote: 'INR', rate: await getUsdToInrRate() } }) }
  catch (error) { return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch exchange rate' }) }
})
router.post('/subscriptions/:id/api-key', async (request, response) => {
  const subscription = subscriptions.find((item) => item.id === request.params.id)
  if (!subscription) return response.status(404).json({ error: 'Subscription not found' })
  const user = currentUser(request)
  if (!user) return response.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'ADMIN') return response.status(403).json({ error: 'Admin access required' })
  const provider = String(request.body.provider ?? '').toUpperCase()
  if (provider !== 'CURSOR' && provider !== 'ANTHROPIC') return response.status(400).json({ error: 'provider must be CURSOR or ANTHROPIC' })
  const apiKey = String(request.body.apiKey ?? '').trim()
  if (!apiKey) return response.status(400).json({ error: 'apiKey is required' })
  try {
    const credential = await saveCredential(request.params.id, provider, apiKey)
    return response.status(201).json({ data: { id: credential.id, subscriptionId: credential.subscriptionId, provider: credential.provider, createdAt: credential.createdAt, updatedAt: credential.updatedAt } })
  } catch (error) { return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save API key' }) }
})
router.post('/subscriptions/:id/usage/sync', async (request, response) => {
  const subscription = subscriptions.find((item) => item.id === request.params.id)
  if (!subscription) return response.status(404).json({ error: 'Subscription not found' })
  try { return response.status(201).json({ data: await syncSubscriptionUsage(request.params.id) }) }
  catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : 'Usage sync failed' }) }
})
router.get('/subscriptions/:id/usage', async (request, response) => {
  const subscription = subscriptions.find((item) => item.id === request.params.id)
  if (!subscription) return response.status(404).json({ error: 'Subscription not found' })
  const granularity = String(request.query.granularity ?? 'day') as Granularity
  try { return response.json({ data: await getUsageReport(request.params.id, granularity, request.query.from as string | undefined, request.query.to as string | undefined) }) }
  catch (error) { return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load usage report' }) }
})
