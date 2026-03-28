import { Icon } from '../Icon'
import styles from './OutlineButton.module.css'

type OutlineButtonProps = {
  iconName: string
  label: string
  onClick?: () => void
  className?: string
  iconSize?: number | string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

export const OutlineButton = ({
  iconName,
  label,
  onClick,
  className = '',
  iconSize = 20,
  type = 'button',
  disabled = false,
}: OutlineButtonProps) => {
  const buttonClassName = [styles.button, className].filter(Boolean).join(' ')

  return (
    <button
      type={type}
      onClick={onClick}
      className={buttonClassName}
      disabled={disabled}
    >
      <Icon
        name={iconName}
        size={iconSize}
        className={styles.icon}
      />
      <span className={styles.label}>{label}</span>
    </button>
  )
}