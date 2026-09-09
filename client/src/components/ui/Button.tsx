import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & { variant?: 'primary' | 'secondary' | 'ghost' }

export function Button({ children, variant = 'secondary', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`button ${variant} ${className}`.trim()} {...props}>{children}</button>
}
