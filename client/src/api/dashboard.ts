import { apiRequest } from './client'

export type DashboardData = { month: string; monthlySpend: number; activeSubscriptions: number; activeSeats: number; upcomingRenewals: number; renewals: unknown[]; projects: Array<{ id: string; name: string; monthlyBudget: number | null; budgetCurrency: string; spend: number }> }
export function getDashboard(month: string) { return apiRequest<{ data: DashboardData }>(`/dashboard?month=${encodeURIComponent(month)}`) }
