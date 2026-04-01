import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/shared/ui/Icon';
import styles from './PublicationsFilterDropdown.module.css';

export type PublicationsFilterOption = {
  value: string;
  label: string;
};

type BaseProps = {
  label: string;
  disabled?: boolean;
  className?: string;
};

type MultiSelectProps = BaseProps & {
  mode: 'multi';
  options: PublicationsFilterOption[];
  value: string[];
  onChange: (nextValue: string[]) => void;
};

type SingleSelectProps = BaseProps & {
  mode: 'single';
  options: PublicationsFilterOption[];
  value: string;
  onChange: (nextValue: string) => void;
};

type YearRangeProps = BaseProps & {
  mode: 'year-range';
  value: {
    from: string;
    to: string;
  };
  minYear?: number | null;
  maxYear?: number | null;
  onChange: (nextValue: { from: string; to: string }) => void;
};

export type PublicationsFilterDropdownProps =
  | MultiSelectProps
  | SingleSelectProps
  | YearRangeProps;

function getSingleLabel(
  options: PublicationsFilterOption[],
  value: string,
  fallback: string,
): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

export function PublicationsFilterDropdown(
  props: PublicationsFilterDropdownProps,
) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }

      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const buttonLabel = useMemo(() => {
    if (props.mode === 'multi') {
      if (!props.value.length) {
        return props.label;
      }

      if (props.value.length === 1) {
        return getSingleLabel(props.options, props.value[0], props.label);
      }

      return `${props.label} · ${props.value.length}`;
    }

    if (props.mode === 'single') {
      if (!props.value || props.value === 'all') {
        return props.label;
      }

      return getSingleLabel(props.options, props.value, props.label);
    }

    const fallbackFrom = props.minYear ? String(props.minYear) : 'Год от';
    const fallbackTo = props.maxYear ? String(props.maxYear) : 'Год до';

    return `${props.value.from || fallbackFrom}–${props.value.to || fallbackTo}`;
  }, [props]);

  const toggleMultiValue = (value: string) => {
    if (props.mode !== 'multi') {
      return;
    }

    props.onChange(
      props.value.includes(value)
        ? props.value.filter((item) => item !== value)
        : [...props.value, value],
    );
  };

  return (
    <div ref={rootRef} className={[styles.root, props.className || ''].join(' ')}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={props.disabled}
      >
        <span className={styles.triggerLabel}>{buttonLabel}</span>
        <Icon name={isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={18} />
      </button>

      {isOpen ? (
        <div className={styles.menu}>
          {props.mode === 'multi' ? (
            <div className={styles.optionsList}>
              {props.options.map((option) => {
                const checked = props.value.includes(option.value);

                return (
                  <label key={option.value} className={styles.optionRow}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMultiValue(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {props.mode === 'single' ? (
            <div className={styles.optionsList}>
              {props.options.map((option) => (
                <label key={option.value} className={styles.optionRow}>
                  <input
                    type="radio"
                    name={props.label}
                    checked={props.value === option.value}
                    onChange={() => {
                      props.onChange(option.value);
                      setIsOpen(false);
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          ) : null}

          {props.mode === 'year-range' ? (
            <div className={styles.yearPanel}>
              <div className={styles.yearInputs}>
                <input
                  className={styles.yearInput}
                  type="number"
                  inputMode="numeric"
                  placeholder={props.minYear ? String(props.minYear) : 'От'}
                  value={props.value.from}
                  onChange={(event) =>
                    props.onChange({
                      ...props.value,
                      from: event.target.value,
                    })
                  }
                />
                <span className={styles.yearSeparator}>—</span>
                <input
                  className={styles.yearInput}
                  type="number"
                  inputMode="numeric"
                  placeholder={props.maxYear ? String(props.maxYear) : 'До'}
                  value={props.value.to}
                  onChange={(event) =>
                    props.onChange({
                      ...props.value,
                      to: event.target.value,
                    })
                  }
                />
              </div>

              <div className={styles.quickActions}>
                <button
                  type="button"
                  className={styles.quickAction}
                  onClick={() => {
                    const year = props.maxYear ?? new Date().getFullYear();
                    props.onChange({ from: String(year), to: String(year) });
                    setIsOpen(false);
                  }}
                >
                  Последний год
                </button>
                <button
                  type="button"
                  className={styles.quickAction}
                  onClick={() => {
                    const year = props.maxYear ?? new Date().getFullYear();
                    props.onChange({ from: String(year - 2), to: String(year) });
                    setIsOpen(false);
                  }}
                >
                  Последние 3 года
                </button>
                <button
                  type="button"
                  className={styles.quickAction}
                  onClick={() => {
                    const year = props.maxYear ?? new Date().getFullYear();
                    props.onChange({ from: String(year - 4), to: String(year) });
                    setIsOpen(false);
                  }}
                >
                  Последние 5 лет
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}