const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('ec-labs-auth-token')
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } })
  if (!response.ok) {
    // A token can go stale (e.g. its user id no longer exists after a backend data migration) -
    // clear it and bounce back to login instead of leaving the app stuck showing broken pages.
    if (response.status === 401 && token) { localStorage.removeItem('ec-labs-auth-token'); window.location.reload() }
    const payload = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error ?? `API request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}
