export type Page = 'Dashboard' | 'Projects' | 'Subscriptions' | 'Seats' | 'Invoices' | 'Users' | 'Account'

export type Subscription = {
  id: string
  month: string
  subscribedUsers: number
  subscribedUserNames: string[]
  service: string
  vendor: string
  project: string
  cycle: string
  nativeCost: number
  usd: number
  currency: string
  payment: string
  renewal: string
  seats: number
  status: 'Active' | 'Cancelled'
  tone: string
}

export type Seat = [string, string, string, string, string, string]
export type Invoice = [string, string, string, string, string, string, string]
