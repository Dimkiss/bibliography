import { useEffect, useRef, useState } from 'react';

import { Quartile } from '@/shared/ui/Quartile';
import styles from './QuartilesDropdown.module.css';

export type QuartilesDropdownItem = {
  label: string;
  value?: string | number | null;
};

export type QuartilesDropdownProps = {
  value?: string | number | null;
  items: QuartilesDropdownItem[];
  className?: string;
  menuAlign?: 'left' | 'right';
  variant?: 'default' | 'compact';
  ariaLabel?: string;
};

export function QuartilesDropdown({
  value,
  items,
  className = '',
  menuAlign = 'left',
  variant = 'default',
  ariaLabel = 'Показать квартили',
}: QuartilesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Quartile value={value} />
      </button>

      {isOpen ? (
        <div
          className={[
            styles.menu,
            menuAlign === 'right' ? styles.menuRight : '',
            variant === 'compact' ? styles.menuCompact : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="menu"
        >
          {items.map((item) => (
            <div key={item.label} className={styles.menuItem} role="menuitem">
              <span className={styles.menuLabel}>{item.label}</span>
              <Quartile value={item.value} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
