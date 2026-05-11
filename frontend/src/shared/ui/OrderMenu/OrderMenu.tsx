import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Icon } from '@/shared/ui/Icon';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import styles from './OrderMenu.module.css';

export type SortOrder = 'asc' | 'desc';

export type OrderMenuOption<TValue extends string> = {
  value: TValue;
  label: string;
};

type OrderMenuProps<TValue extends string> = {
  options: Array<OrderMenuOption<TValue>>;
  value: TValue;
  order: SortOrder;
  fallbackLabel: string;
  selectAriaLabel: string;
  dividerAfterValues?: TValue[];
  onValueChange: (value: TValue) => void;
  onOrderChange: (value: SortOrder) => void;
  width?: number;
};

export function OrderMenu<TValue extends string>({
  options,
  value,
  order,
  fallbackLabel,
  selectAriaLabel,
  dividerAfterValues = [],
  onValueChange,
  onOrderChange,
  width = 167,
}: OrderMenuProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const rootStyle = {
    '--order-menu-width': `${width}px`,
  } as CSSProperties;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!sortRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const currentSortLabel = useMemo(() => {
    return options.find((item) => item.value === value)?.label ?? fallbackLabel;
  }, [fallbackLabel, options, value]);

  return (
    <div className={styles.sortControls} style={rootStyle}>
      <span className={styles.sortLabel}>Сортировать</span>

      <div ref={sortRef} className={styles.sortSelectWrap}>
        <button
          type="button"
          className={styles.sortSelectButton}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label={selectAriaLabel}
        >
          <span className={styles.sortSelectText}>{currentSortLabel}</span>
          <Icon name={isOpen ? 'arrow_drop_up' : 'arrow_drop_down'} size={18} />
        </button>

        {isOpen ? (
          <div className={styles.sortMenu}>
            {options.map((option) => (
              <div key={option.value} className={styles.sortOptionGroup}>
                <button
                  type="button"
                  className={[
                    styles.sortOption,
                    option.value === value ? styles.sortOptionActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    onValueChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
                {dividerAfterValues.includes(option.value) ? (
                  <div className={styles.sortDivider} />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <OutlineIconButton
        iconName={order === 'asc' ? 'order-asc' : 'order-desc'}
        iconSize={20}
        size="small-x"
        onClick={() => onOrderChange(order === 'asc' ? 'desc' : 'asc')}
        aria-label={
          order === 'asc'
            ? 'Переключить сортировку по убыванию'
            : 'Переключить сортировку по возрастанию'
        }
      />
    </div>
  );
}
