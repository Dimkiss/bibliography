import { useEffect, useId, useRef, useState } from 'react';

import styles from './YearSelect.module.css';

export type YearSelectProps = {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  ariaLabel: string;
};

export function YearSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: YearSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(0, options.indexOf(value)),
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    setFocusedIndex(Math.max(0, options.indexOf(value)));
  }, [options, value]);

  function commitValue(nextValue: number) {
    onChange(nextValue);
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        commitValue(options[focusedIndex] ?? value);
      } else {
        setIsOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setFocusedIndex((currentIndex) => {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = currentIndex + direction;
        return Math.min(Math.max(nextIndex, 0), options.length - 1);
      });
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        onKeyDown={handleKeyDown}
      >
        <span>{value}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen ? (
        <ul className={styles.menu} id={listboxId} role="listbox">
          {options.map((option, index) => (
            <li
              key={option}
              className={[
                styles.option,
                option === value ? styles.optionSelected : '',
                index === focusedIndex ? styles.optionFocused : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="option"
              aria-selected={option === value}
              onMouseEnter={() => setFocusedIndex(index)}
              onClick={() => commitValue(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
