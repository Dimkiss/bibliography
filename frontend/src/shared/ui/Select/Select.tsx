import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { Icon } from '@/shared/ui/Icon';
import styles from './Select.module.css';

export type SelectOption = {
  value: string;
  label: string;
  supportingText?: string;
  disabled?: boolean;
  icon?: ReactNode;
};

type SelectVariant = 'tonal' | 'outlined';

type SelectProps = {
  options: SelectOption[];
  value: string;
  onChange: (nextValue: string) => void;
  variant?: SelectVariant;
  width?: number | string;
  menuWidth?: number | string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

function toCssSize(value: number | string | undefined): string | undefined {
  if (typeof value === 'number') {
    return `${value}px`;
  }

  return value;
}

export function Select({
  options,
  value,
  onChange,
  variant = 'tonal',
  width,
  menuWidth,
  placeholder = '',
  disabled = false,
  className = '',
  ariaLabel,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const rootStyle: CSSProperties = {
    '--select-width': toCssSize(width),
    '--select-menu-width': toCssSize(menuWidth ?? width),
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={[
        styles.root,
        variant === 'outlined' ? styles.outlined : styles.tonal,
        disabled ? styles.disabled : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={rootStyle}
    >
      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
      >
        <span className={styles.triggerLabel}>
          {selectedOption?.label ?? placeholder}
        </span>
        <Icon
          name={isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
          size={18}
          className={styles.arrowIcon}
        />
      </button>

      {isOpen ? (
        <div id={listboxId} className={styles.menu} role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={[
                  styles.option,
                  isSelected ? styles.optionSelected : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) {
                    return;
                  }

                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.icon ? (
                  <span className={styles.optionIcon}>{option.icon}</span>
                ) : null}
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.supportingText ? (
                    <span className={styles.supportingText}>
                      {option.supportingText}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
