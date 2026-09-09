export type IconName = 'grid' | 'card' | 'users' | 'file' | 'chart' | 'person' | 'sun' | 'moon' | 'bell' | 'search' | 'upload'

type IconProps = { name: IconName; label?: string }

export function Icon({ name, label }: IconProps) {
  return <span className={`icon icon-${name}`} aria-hidden={label ? undefined : true} aria-label={label} />
}
