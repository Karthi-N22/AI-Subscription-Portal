import { useEffect, useState } from 'react'
import { getCurrentUser } from '../api/auth'
import type { WorkspaceUser } from '../api/users'
import { Button } from '../components/ui'
import { chipTone } from '../utils/chip'

type Props = { onChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>; onSignOut: () => void }

export function AccountPage({ onChangePassword, onSignOut }: Props) {
  const [user, setUser] = useState<WorkspaceUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    getCurrentUser().then((response) => { if (active) { setUser(response.data); setError('') } }).catch(() => { if (active) setError('Unable to load account details.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const [formError, setFormError] = useState('')
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('currentPassword'))
    const newPassword = String(data.get('newPassword'))
    const confirmPassword = String(data.get('confirmPassword'))
    if (newPassword !== confirmPassword) { setFormError('New password and confirmation do not match.'); return }
    if (newPassword.length < 8) { setFormError('New password must be at least 8 characters.'); return }
    setFormError('')
    const success = await onChangePassword(currentPassword, newPassword)
    if (success) form.reset()
  }

  const initials = user ? user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() : ''

  return <section className="panel account-page">
    {loading && <p className="account-info-loading">Loading account details…</p>}
    {error && <p className="error-state">{error}</p>}
    {user && <div className="account-header">
      <div className="account-avatar">{initials}</div>
      <div><h2>{user.name}</h2><p>{user.email}</p></div>
      <span className={`chip ${chipTone(user.role)}`}>{user.role}</span>
      <Button onClick={onSignOut}>Sign out</Button>
    </div>}
    <div className="account-tab-intro"><h3>Change password</h3><p>Choose a strong password you don't use anywhere else.</p></div>
    <form className="form-grid account-password-form" onSubmit={submit}>
      <label className="full-field">Current password<input name="currentPassword" type="password" required placeholder="Enter current password" /></label>
      <label>New password<input name="newPassword" type="password" required minLength={8} placeholder="At least 8 characters" /></label>
      <label>Confirm new password<input name="confirmPassword" type="password" required minLength={8} placeholder="Re-enter new password" /></label>
      {formError && <p className="full-field error-state">{formError}</p>}
      <div className="full-field form-actions"><Button variant="primary" type="submit">Update password</Button></div>
    </form>
  </section>
}
