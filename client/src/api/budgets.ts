import { apiRequest } from './client'
import type { Project } from '../types'

export type Budget = Project & { id: string; spend: number; history: number[] }
export function listBudgets(month: string) { return apiRequest<{ data: Budget[] }>(`/budgets?month=${encodeURIComponent(month)}`) }
export function updateBudget(projectId: string, monthlyBudget: number, budgetCurrency = 'USD') { return apiRequest<{ data: Project }>(`/budgets/${projectId}`, { method: 'PATCH', body: JSON.stringify({ monthlyBudget, budgetCurrency }) }) }
