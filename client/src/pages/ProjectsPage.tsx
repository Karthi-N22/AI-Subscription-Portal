import { useState } from 'react'
import type { Budget } from '../api/budgets'
import { Status } from '../components/ui'
import { useCurrency } from '../contexts/CurrencyContext'

type Props = { projects: Budget[]; monthLabel: string; onSaveBudget: (projectId: string, monthlyBudget: number) => Promise<void> }

export function ProjectsPage({ projects, monthLabel, onSaveBudget }: Props) {
  return <section className="panel table-panel"><div className="panel-title"><div><h2>Projects</h2><p>Cost centers, monthly budgets, and spend across the subscription workspace.</p></div></div><div className="project-grid">{projects.map((project) => <ProjectCard project={project} monthLabel={monthLabel} onSaveBudget={onSaveBudget} key={project.id} />)}</div></section>
}

function ProjectCard({ project, monthLabel, onSaveBudget }: { project: Budget; monthLabel: string; onSaveBudget: Props['onSaveBudget'] }) {
  const { format } = useCurrency()
  const [editing, setEditing] = useState(false)
  const percent = project.monthlyBudget ? Math.round((project.spend / project.monthlyBudget) * 100) : 0
  const tone = !project.monthlyBudget ? 'amber' : percent > 100 ? 'red' : 'green'
  const statusLabel = !project.monthlyBudget ? 'Needs budget' : percent > 100 ? 'Over budget' : 'On budget'
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(new FormData(event.currentTarget).get('monthlyBudget'))
    if (value > 0) { void onSaveBudget(project.id, value); setEditing(false) }
  }
  return <article className="project-card">
    <div className="project-card-top"><span className="project-icon purple">{project.name.slice(0, 2).toUpperCase()}</span><Status tone={tone}>{statusLabel}</Status></div>
    <h3>{project.name}</h3>
    <p>{project.budgetCurrency} monthly budget</p>
    <div className="project-card-value">{format(project.spend)}<small>Spent in {monthLabel}</small></div>
    <div className="bar"><i className={tone === 'amber' ? 'amber-bar' : ''} style={{ width: `${Math.min(percent || 8, 100)}%` }} /></div>
    {editing
      ? <form className="budget-edit" onSubmit={submit}><label>Monthly budget<input name="monthlyBudget" type="number" min="0" step="0.01" defaultValue={project.monthlyBudget ?? ''} placeholder="Set a budget" autoFocus /></label><div className="budget-edit-actions"><button className="button secondary" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="button primary" type="submit">Save</button></div></form>
      : <div className="budget-display"><div><span className="budget-display-label">Monthly budget</span><strong className="budget-display-value">{project.monthlyBudget ? format(project.monthlyBudget) : 'Not set'}</strong></div><button className="link" onClick={() => setEditing(true)}>{project.monthlyBudget ? 'Edit' : '+ Set budget'}</button></div>}
    <div className="card-footer"><button className="link">View subscriptions →</button></div>
  </article>
}
