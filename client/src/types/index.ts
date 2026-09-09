export type Project = { id?: string; name: string; monthlyBudget: number | null; budgetCurrency: string }
export type Subscription = { id: string; serviceName: string; vendor: string; projectId: string; billingCycle: 'MONTHLY' | 'ANNUAL' | 'ONE_OFF'; nativeCost: number; currency: string; usdMonthlyCost: number; paymentMode: string; renewalDate: string; status: 'ACTIVE' | 'CANCELLED' }
