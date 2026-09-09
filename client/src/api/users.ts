import { apiRequest } from './client'

export type WorkspaceUser = { id: string; name: string; email: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }
export function listUsers() { return apiRequest<{ data: WorkspaceUser[] }>('/users') }
export function inviteUser(input: Omit<WorkspaceUser, 'id'>) { return apiRequest<{ data: WorkspaceUser }>('/users', { method: 'POST', body: JSON.stringify(input) }) }
