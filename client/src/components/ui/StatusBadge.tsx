type StatusBadgeProps = { children: string; tone?: 'green' | 'amber' | 'red' }

export function Status({ children, tone = 'green' }: StatusBadgeProps) {
  return <span className={`status ${tone}`}>{children}</span>
}
