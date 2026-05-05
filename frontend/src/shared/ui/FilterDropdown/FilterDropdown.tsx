import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/shared/ui/Icon';
import { Checkbox } from '@/shared/ui/Checkbox';
import { RadioButton } from '@/shared/ui/RadioButton';
import styles from './FilterDropdown.module.css';

export type FilterDropdownOption = {
  value: string;
  label: string;
};

type BaseProps = {
  label: string;
  disabled?: boolean;
  className?: string;
  active?: boolean;
  menuWidth?: number | string;
};

type MultiSelectProps = BaseProps & {
  mode: 'multi';
  options: FilterDropdownOption[];
  value: string[];
  onChange: (nextValue: string[]) => void;
};

type SingleSelectProps = BaseProps & {
  mode: 'single';
  options: FilterDropdownOption[];
  value: string;
  onChange: (nextValue: string) => void;
};

export type FilterDropdownProps = MultiSelectProps | SingleSelectProps;

function getSingleLabel(
  options: FilterDropdownOption[],
  value: string,
  fallback: string,
): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

export function FilterDropdown(props: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
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
      return props.label;
    }

    if (!props.value || props.value === 'all') {
      return props.label;
    }

    return getSingleLabel(props.options, props.value, props.label);
  }, [props]);

  const isActive =
    props.active ??
    (props.mode === 'multi'
      ? props.value.length > 0
      : Boolean(props.value && props.value !== 'all'));

  const menuStyle =
    props.menuWidth === undefined
      ? undefined
      : {
          width:
            typeof props.menuWidth === 'number'
              ? `${props.menuWidth}px`
              : props.menuWidth,
        };

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
    <div
      ref={rootRef}
      className={[styles.root, props.className || ''].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className={[
          styles.trigger,
          isActive ? styles.triggerActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={props.disabled}
        aria-expanded={isOpen}
      >
        {isActive ? <Icon name="check" size={18} /> : null}
        <span className={styles.triggerLabel}>{buttonLabel}</span>
        <Icon name={isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={18} />
      </button>

      {isOpen ? (
        <div className={styles.menu} style={menuStyle}>
          <div className={styles.optionsList}>
            {props.options.map((option) => {
              const checked =
                props.mode === 'multi'
                  ? props.value.includes(option.value)
                  : props.value === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={styles.optionButton}
                  onClick={() => {
                    if (props.mode === 'multi') {
                      toggleMultiValue(option.value);
                      return;
                    }

                    props.onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={[
                      styles.control,
                      props.mode === 'single' ? styles.radioControl : styles.checkbox,
                      checked ? styles.controlChecked : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-hidden="true"
                  >
                    {props.mode === 'single' ? (
                      <RadioButton checked={checked} />
                    ) : (
                      <Checkbox checked={checked} />
                    )}
                  </span>
                  <span className={styles.optionLabel}>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
