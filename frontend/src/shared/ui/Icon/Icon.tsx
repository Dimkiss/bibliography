import type { CSSProperties } from 'react'
import styles from './Icon.module.css'

const iconUrls = import.meta.glob('@/shared/assets/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

type IconProps = {
  name: string
  size?: number | string
  color?: string
  className?: string
  colored?: boolean
}

export const Icon = ({
  name,
  size,
  color,
  className,
  colored = false,
}: IconProps) => {
  const src = iconUrls[`/src/shared/assets/icons/${name}.svg`]

  if (!src) {
    return null
  }

  const sizeStyle: CSSProperties = {
    width:
      size !== undefined
        ? typeof size === 'number'
          ? `${size}px`
          : size
        : undefined,
    height:
      size !== undefined
        ? typeof size === 'number'
          ? `${size}px`
          : size
        : undefined,
  }

  if (colored) {
    return (
      <img
        src={src}
        alt={name}
        style={sizeStyle}
        className={`${styles.imageIcon} ${className ?? ''}`}
      />
    )
  }

  const maskStyle: CSSProperties = {
    ...sizeStyle,
    ['--icon-src' as string]: `url("${src}")`,
    ['--icon-color' as string]: color || 'currentColor',
  }

  return (
    <span
      aria-label={name}
      role="img"
      style={maskStyle}
      className={`${styles.icon} ${className ?? ''}`}
    />
  )
}
