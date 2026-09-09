import { apiRequest } from './client'
import type { Project } from '../types'

export function listProjects() {
  return apiRequest<{ data: Project[] }>('/projects')
}
export function createProject(input: { name: string; monthlyBudget: number | null; budgetCurrency: string }) {
  return apiRequest<{ data: Project }>('/projects', { method: 'POST', body: JSON.stringify(input) })
}
