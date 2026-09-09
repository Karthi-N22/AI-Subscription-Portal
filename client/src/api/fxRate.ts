import { apiRequest } from './client'

export function getFxRate() {
  return apiRequest<{ data: { base: string; quote: string; rate: number } }>('/fx-rate')
}
