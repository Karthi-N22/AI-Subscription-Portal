import { apiRequest } from './client'

export type Seat = { id: string; name: string; email: string; subscriptionId: string; assignedAt: string; licenseType: 'INDIVIDUAL' | 'TEAM'; subscription?: { serviceName: string }; project?: string }
export function listSeats() { return apiRequest<{ data: Seat[] }>('/seats') }
export function createSeat(input: Omit<Seat, 'id' | 'assignedAt' | 'subscription' | 'project'>) { return apiRequest<{ data: Seat }>('/seats', { method: 'POST', body: JSON.stringify(input) }) }
export function removeSeat(id: string) { return apiRequest<void>(`/seats/${id}`, { method: 'DELETE' }) }
