export type Project = { id: string; name: string; monthlyBudget: number | null; budgetCurrency: string }
export type Subscription = { id: string; month: string; serviceName: string; vendor: string; projectId: string; billingCycle: 'MONTHLY' | 'ANNUAL' | 'ONE_OFF'; nativeCost: number; currency: string; usdMonthlyCost: number; paymentMode: string; renewalDate: string; status: 'ACTIVE' | 'CANCELLED' }
export type Seat = { id: string; name: string; email: string; subscriptionId: string; assignedAt: string; licenseType: 'INDIVIDUAL' | 'TEAM' }
export type Invoice = { id: string; invoiceNumber: string; billingPeriod: string; fileName: string; filePath: string; amount: number; invoiceDate: string; subscriptionId: string }
export type User = { id: string; email: string; name: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }

export const seedCredentials = { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@eclabs.co', password: process.env.SEED_ADMIN_PASSWORD ?? 'ECLabs@2026' }

export const projects: Project[] = []
export const subscriptions: Subscription[] = []
export const seats: Seat[] = []
export const invoices: Invoice[] = []
// One admin account is required so login works out of the box - everything else starts empty.
export const users: User[] = [{ id: 'user-1', email: seedCredentials.email, name: 'Admin', role: 'ADMIN' }]
