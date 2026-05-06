import type { ButtonHTMLAttributes, CSSProperties } from 'react';

import { Icon } from '@/shared/ui/Icon';
import styles from './TextButton.module.css';

type TextButtonSize = 'normal' | 'small';

type TextButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  iconName?: string;
  iconSize?: number;
  size?: TextButtonSize;
  width?: number | string;
  active?: boolean;
  className?: string;
};

const sizeClassMap: Record<TextButtonSize, string> = {
  normal: styles.normal,
  small: styles.small,
};

export const TextButton = ({
  label,
  iconName,
  iconSize,
  size = 'normal',
  width,
  active = false,
  className = '',
  type = 'button',
  disabled = false,
  style,
  ...props
}: TextButtonProps) => {
  const resolvedIconSize = iconSize ?? (size === 'normal' ? 20 : 18);
  const rootStyle: CSSProperties | undefined =
    width === undefined
      ? style
      : {
          ...style,
          width: typeof width === 'number' ? `${width}px` : width,
        };

  return (
    <button
      type={type}
      className={[
        styles.button,
        sizeClassMap[size],
        active ? styles.active : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      style={rootStyle}
      {...props}
    >
      {iconName ? (
        <Icon
          name={iconName}
          size={resolvedIconSize}
          className={styles.icon}
        />
      ) : null}

      <span className={styles.label}>{label}</span>
    </button>
  );
};
