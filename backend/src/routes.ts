import { Router, type Request } from 'express'
import multer from 'multer'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import { seedCredentials } from './data/store.js'
import { getUsageReport, saveCredential, syncSubscriptionUsage, type Granularity } from './usage/service.js'
import { buildSubscriptionsWorkbook } from './exports/subscriptionsWorkbook.js'
import { getUsdToInrRate } from './exports/fxRate.js'
import { getInvoiceFile, listInvoiceUploads, saveInvoiceUpload } from './invoices/service.js'

export const router = Router()
const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })
const currentUser = async (request: Request) => { const token = request.headers.authorization?.replace('Bearer ', ''); const userId = token?.startsWith('dev-token-') ? token.slice('dev-token-'.length) : null; return userId ? prisma.user.findUnique({ where: { id: userId } }) : null }
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const monthLabel = (month: string) => { const [year, monthNumber] = month.split('-').map(Number); return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }

const toNumber = (value: Prisma.Decimal | number | null | undefined) => value == null ? null : Number(value)
const toDateOnly = (value: Date | null) => value ? value.toISOString().slice(0, 10) : ''
const serializeProject = (project: { id: string; name: string; monthlyBudget: Prisma.Decimal | null; budgetCurrency: string }) => ({ id: project.id, name: project.name, monthlyBudget: toNumber(project.monthlyBudget), budgetCurrency: project.budgetCurrency })
const serializeSubscription = <T extends { nativeCost: Prisma.Decimal; usdMonthlyCost: Prisma.Decimal; renewalDate: Date | null }>(item: T) => ({ ...item, nativeCost: Number(item.nativeCost), usdMonthlyCost: Number(item.usdMonthlyCost), renewalDate: toDateOnly(item.renewalDate) })
const serializeSeat = <T extends { assignedAt: Date }>(seat: T) => ({ ...seat, assignedAt: seat.assignedAt.toISOString() })

router.get('/dashboard', async (request, response) => {
  const month = String(request.query.month ?? '2026-09')
  const [monthlyItems, activeSeats, allProjects] = await Promise.all([
    prisma.subscription.findMany({ where: { month } }),
    prisma.seat.count(),
    prisma.project.findMany(),
  ])
  const activeItems = monthlyItems.filter((item) => item.status === 'ACTIVE')
  const monthlySpend = activeItems.reduce((sum, item) => sum + Number(item.usdMonthlyCost), 0)
  const renewals = activeItems.filter((item) => item.renewalDate).sort((a, b) => a.renewalDate!.getTime() - b.renewalDate!.getTime()).slice(0, 4).map(serializeSubscription)
  response.json({ data: { month, monthlySpend, activeSubscriptions: activeItems.length, activeSeats, upcomingRenewals: renewals.length, renewals, projects: allProjects.map((project) => ({ ...serializeProject(project), spend: monthlyItems.filter((item) => item.projectId === project.id).reduce((sum, item) => sum + Number(item.usdMonthlyCost), 0) })) } })
})
router.get('/projects', async (_request, response) => response.json({ data: (await prisma.project.findMany({ orderBy: { createdAt: 'asc' } })).map(serializeProject) }))
router.get('/subscription-months', (_request, response) => response.json({ data: Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`) }))
router.post('/projects', async (request, response) => {
  const name = String(request.body.name ?? '').trim()
  if (!name) return response.status(400).json({ error: 'Project name is required' })
  const existing = await prisma.project.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
  if (existing) return response.status(409).json({ error: 'Project already exists' })
  const monthlyBudget = request.body.monthlyBudget == null || request.body.monthlyBudget === '' ? null : Number(request.body.monthlyBudget)
  const project = await prisma.project.create({ data: { name, monthlyBudget, budgetCurrency: String(request.body.budgetCurrency ?? 'USD') } })
  return response.status(201).json({ data: serializeProject(project) })
})
router.patch('/projects/:id', async (request, response) => {
  try {
    const { name, monthlyBudget, budgetCurrency } = request.body
    const project = await prisma.project.update({ where: { id: request.params.id }, data: { name, monthlyBudget: monthlyBudget == null || monthlyBudget === '' ? undefined : Number(monthlyBudget), budgetCurrency } })
    return response.json({ data: serializeProject(project) })
  } catch { return response.status(404).json({ error: 'Project not found' }) }
})
router.get('/subscriptions', async (request, response) => {
  const month = String(request.query.month ?? '2026-09')
  const { projectId, status, paymentMode, search } = request.query
  const where: Prisma.SubscriptionWhereInput = { month }
  if (projectId) where.projectId = String(projectId)
  if (status) where.status = status as Prisma.EnumSubscriptionStatusFilter['equals']
  if (paymentMode) where.paymentMode = String(paymentMode)
  if (search) { const term = String(search); where.OR = [{ serviceName: { contains: term, mode: 'insensitive' } }, { vendor: { contains: term, mode: 'insensitive' } }] }
  const rows = await prisma.subscription.findMany({ where, include: { project: true, seats: true }, orderBy: { createdAt: 'asc' } })
  const data = rows.map(({ project, seats, ...item }) => ({ ...serializeSubscription(item), project: project.name, subscribedUsers: seats.length, subscribedUserNames: seats.map((seat) => seat.name) }))
  return response.json({ data })
})
router.post('/subscriptions', async (request, response) => {
  const body = request.body
  try {
    const created = await prisma.subscription.create({ data: {
      month: String(body.month ?? '2026-09'),
      serviceName: String(body.serviceName ?? ''),
      vendor: String(body.vendor ?? ''),
      projectId: String(body.projectId ?? ''),
      billingCycle: body.billingCycle,
      nativeCost: Number(body.nativeCost ?? 0),
      currency: String(body.currency ?? 'USD'),
      usdMonthlyCost: Number(body.usdMonthlyCost ?? body.nativeCost ?? 0),
      paymentMode: String(body.paymentMode ?? ''),
      renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
      status: body.status ?? 'ACTIVE',
    } })
    return response.status(201).json({ data: serializeSubscription(created) })
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create subscription' }) }
})
router.patch('/subscriptions/:id', async (request, response) => {
  try {
    const body = request.body
    const data: Prisma.SubscriptionUpdateInput = { ...body }
    if ('renewalDate' in body) data.renewalDate = body.renewalDate ? new Date(body.renewalDate) : null
    if ('nativeCost' in body) data.nativeCost = Number(body.nativeCost)
    if ('usdMonthlyCost' in body) data.usdMonthlyCost = Number(body.usdMonthlyCost)
    const updated = await prisma.subscription.update({ where: { id: request.params.id }, data })
    return response.json({ data: serializeSubscription(updated) })
  } catch { return response.status(404).json({ error: 'Subscription not found' }) }
})
router.delete('/subscriptions/:id', async (request, response) => {
  try { await prisma.subscription.delete({ where: { id: request.params.id } }); return response.status(204).send() }
  catch { return response.status(404).json({ error: 'Subscription not found' }) }
})
router.get('/seats', async (_request, response) => {
  const rows = await prisma.seat.findMany({ include: { subscription: { include: { project: true } } }, orderBy: { assignedAt: 'desc' } })
  const data = rows.map(({ subscription, ...seat }) => ({ ...serializeSeat(seat), subscription: { serviceName: subscription.serviceName }, project: subscription.project.name }))
  return response.json({ data })
})
router.post('/seats', async (request, response) => {
  const body = request.body
  try {
    const seat = await prisma.seat.create({ data: { name: String(body.name ?? ''), email: String(body.email ?? ''), subscriptionId: String(body.subscriptionId ?? ''), licenseType: body.licenseType ?? 'INDIVIDUAL' } })
    return response.status(201).json({ data: serializeSeat(seat) })
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create seat' }) }
})
router.delete('/seats/:id', async (request, response) => {
  try { await prisma.seat.delete({ where: { id: request.params.id } }); return response.status(204).send() }
  catch { return response.status(404).json({ error: 'Seat not found' }) }
})
router.get('/invoices', async (request, response) => {
  const month = String(request.query.month ?? '2026-09')
  const where: Prisma.SubscriptionWhereInput = { month }
  if (request.query.subscriptionId) where.id = String(request.query.subscriptionId)
  try {
    const monthlySubscriptions = await prisma.subscription.findMany({ where, include: { project: true } })
    const uploads = await listInvoiceUploads(month, monthlySubscriptions.map((item) => item.id))
    const apiBase = `${request.protocol}://${request.get('host')}/api`
    const data = monthlySubscriptions.map((subscription) => {
      const uploaded = uploads.find((item) => item.subscriptionId === subscription.id)
      const base = uploaded
        ? { id: uploaded.id, invoiceNumber: `INV-${month}-${subscription.id}`, billingPeriod: monthLabel(month), fileName: uploaded.fileName, fileUrl: `${apiBase}/invoice-uploads/${uploaded.id}/file`, amount: Number(subscription.usdMonthlyCost), invoiceDate: uploaded.createdAt }
        : { id: `auto-${subscription.id}-${month}`, invoiceNumber: `AUTO-${month}-${subscription.id}`, billingPeriod: monthLabel(month), fileName: `${slugify(subscription.serviceName)}-${month}.pdf`, fileUrl: null, amount: Number(subscription.usdMonthlyCost), invoiceDate: subscription.renewalDate ?? subscription.createdAt }
      return { ...base, subscriptionId: subscription.id, serviceName: subscription.serviceName, project: subscription.project.name, autoGenerated: !uploaded }
    })
    return response.json({ data })
  } catch (error) { return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load invoices' }) }
})
router.post('/subscriptions/:id/invoices', uploadMiddleware.single('file'), async (request, response) => {
  const subscription = await prisma.subscription.findUnique({ where: { id: String(request.params.id) } })
  if (!subscription) return response.status(404).json({ error: 'Subscription not found' })
  const user = await currentUser(request)
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
router.get('/budgets', async (request, response) => {
  const month = String(request.query.month ?? '2026-09')
  const [allProjects, monthlyItems] = await Promise.all([prisma.project.findMany(), prisma.subscription.findMany({ where: { month } })])
  const data = allProjects.map((project) => ({ ...serializeProject(project), spend: monthlyItems.filter((item) => item.projectId === project.id).reduce((sum, item) => sum + Number(item.usdMonthlyCost), 0), history: [420, 510, 390, 580, 640] }))
  return response.json({ data })
})
router.patch('/budgets/:projectId', async (request, response) => {
  try {
    const project = await prisma.project.update({ where: { id: request.params.projectId }, data: { monthlyBudget: Number(request.body.monthlyBudget), budgetCurrency: request.body.budgetCurrency ?? undefined } })
    return response.json({ data: serializeProject(project) })
  } catch { return response.status(404).json({ error: 'Project not found' }) }
})
router.get('/users', async (_request, response) => response.json({ data: await prisma.user.findMany({ orderBy: { createdAt: 'asc' } }) }))
router.post('/users', async (request, response) => {
  try {
    const user = await prisma.user.create({ data: { email: String(request.body.email ?? ''), name: String(request.body.name ?? ''), role: request.body.role ?? 'MEMBER' } })
    return response.status(201).json({ data: user })
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create user' }) }
})
router.post('/auth/login', async (request, response) => {
  const { email, password } = request.body
  if (password !== seedCredentials.password || email !== seedCredentials.email) return response.status(401).json({ error: 'Invalid credentials' })
  const user = await prisma.user.upsert({ where: { email: seedCredentials.email }, update: {}, create: { email: seedCredentials.email, name: 'Admin', role: 'ADMIN' } })
  return response.json({ data: { token: `dev-token-${user.id}`, user } })
})
router.get('/auth/me', async (request, response) => { const user = await currentUser(request); if (!user) return response.status(401).json({ error: 'Not authenticated' }); return response.json({ data: user }) })
router.post('/auth/change-password', (request, response) => { const { currentPassword, newPassword } = request.body; if (!currentPassword || !newPassword) return response.status(400).json({ error: 'Current and new password are required' }); if (currentPassword !== seedCredentials.password) return response.status(401).json({ error: 'Current password is incorrect' }); if (String(newPassword).length < 8) return response.status(400).json({ error: 'New password must be at least 8 characters' }); seedCredentials.password = String(newPassword); return response.json({ data: { success: true } }) })
router.get('/export/subscriptions.csv', async (_request, response) => {
  const rows = await prisma.subscription.findMany({ include: { project: true }, orderBy: { createdAt: 'asc' } })
  const header = 'Service,Payee,Project,Cost,USD monthly,Payment mode,Renewal date,Status'
  const lines = rows.map((item) => [item.serviceName, item.vendor, item.project.name, `${item.currency} ${item.nativeCost}`, Number(item.usdMonthlyCost), item.paymentMode, toDateOnly(item.renewalDate), item.status].join(','))
  response.type('text/csv').send([header, ...lines].join('\n'))
})
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
  const subscription = await prisma.subscription.findUnique({ where: { id: request.params.id } })
  if (!subscription) return response.status(404).json({ error: 'Subscription not found' })
  const user = await currentUser(request)
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
  const subscription = await prisma.subscription.findUnique({ where: { id: request.params.id } })
  if (!subscription) return response.status(404).json({ error: 'Subscription not found' })
  try { return response.status(201).json({ data: await syncSubscriptionUsage(request.params.id) }) }
  catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : 'Usage sync failed' }) }
})
router.get('/subscriptions/:id/usage', async (request, response) => {
  const subscription = await prisma.subscription.findUnique({ where: { id: request.params.id } })
  if (!subscription) return response.status(404).json({ error: 'Subscription not found' })
  const granularity = String(request.query.granularity ?? 'day') as Granularity
  try { return response.json({ data: await getUsageReport(request.params.id, granularity, request.query.from as string | undefined, request.query.to as string | undefined) }) }
  catch (error) { return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load usage report' }) }
})
