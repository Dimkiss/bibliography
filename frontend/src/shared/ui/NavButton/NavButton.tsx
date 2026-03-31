import { Icon } from '../Icon'
import styles from './NavButton.module.css'

type NavButtonProps = {
  iconName: string
  label: string
  selected?: boolean
  onClick?: () => void
  className?: string
  iconSize?: number | string
  type?: 'button' | 'submit' | 'reset'
}

export const NavButton = ({
  iconName,
  label,
  selected = false,
  onClick,
  className = '',
  iconSize = 20,
  type = 'button',
}: NavButtonProps) => {
  const buttonClassName = [
    styles.navButton,
    selected ? styles.selected : styles.default,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      onClick={onClick}
      className={buttonClassName}
    >
      <span className={styles.container}>
        <span className={styles.stateLayer}>
          <Icon
            name={iconName}
            size={iconSize}
            className={styles.icon}
          />
          <span className={styles.label}>{label}</span>
        </span>
      </span>
    </button>
  )
}