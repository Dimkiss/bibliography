import type {
  ButtonHTMLAttributes,
  CSSProperties,
  MouseEventHandler,
  ReactNode,
} from 'react';
import { Icon } from '@/shared/ui/Icon';
import styles from './DropdownButton.module.css';

type DropdownButtonSize = 'normal' | 'small';
type DropdownButtonVariant = 'filled' | 'tonal';

type DropdownButtonProps = {
  label: string;
  icon?: ReactNode;
  isOpen?: boolean;
  size?: DropdownButtonSize;
  variant?: DropdownButtonVariant;
  width?: number | string;
  disabled?: boolean;
  className?: string;
  leftButtonProps?: Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'type' | 'disabled'
  >;
  rightButtonProps?: Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'type' | 'disabled'
  >;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onArrowClick?: MouseEventHandler<HTMLButtonElement>;
};

const sizeClassMap: Record<DropdownButtonSize, string> = {
  normal: styles.normal,
  small: styles.small,
};

const variantClassMap: Record<DropdownButtonVariant, string> = {
  filled: styles.filled,
  tonal: styles.tonal,
};

export const DropdownButton = ({
  label,
  icon,
  isOpen = false,
  size = 'normal',
  variant = 'filled',
  width,
  disabled = false,
  className = '',
  leftButtonProps,
  rightButtonProps,
  onClick,
  onArrowClick,
}: DropdownButtonProps) => {
  const arrowIconName = isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  const rootStyle: CSSProperties | undefined =
    width === undefined
      ? undefined
      : {
          width: typeof width === 'number' ? `${width}px` : width,
        };

  return (
    <div
      className={[
        styles.root,
        sizeClassMap[size],
        variantClassMap[variant],
        isOpen ? styles.opened : '',
        disabled ? styles.disabled : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={rootStyle}
    >
      <button
        type="button"
        className={[styles.buttonPart, styles.leftPart].join(' ')}
        disabled={disabled}
        onClick={onClick}
        {...leftButtonProps}
      >
        {icon ? <span className={styles.leadingIcon}>{icon}</span> : null}
        <span className={styles.label}>{label}</span>
      </button>

      <button
        type="button"
        className={[styles.buttonPart, styles.rightPart].join(' ')}
        disabled={disabled}
        onClick={onArrowClick ?? onClick}
        aria-label={isOpen ? 'Свернуть список' : 'Развернуть список'}
        {...rightButtonProps}
      >
        <Icon name={arrowIconName} className={styles.arrowIcon} />
      </button>
    </div>
  );
};
