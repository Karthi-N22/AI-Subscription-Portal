import { apiRequest } from './client'
import type { WorkspaceUser } from './users'

export function login(email: string, password: string) { return apiRequest<{ data: { token: string; user: WorkspaceUser } }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }) }
export function getCurrentUser() { return apiRequest<{ data: WorkspaceUser }>('/auth/me') }
export function changePassword(currentPassword: string, newPassword: string) { return apiRequest<{ data: { success: boolean } }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }) }
