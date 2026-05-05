import styles from './Checkbox.module.css';

type CheckboxState = 'default' | 'hovered' | 'pressed';
type CheckboxTone = 'primary' | 'error';

export type CheckboxProps = {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  state?: CheckboxState;
  tone?: CheckboxTone;
  className?: string;
};

const stateClassMap: Record<CheckboxState, string> = {
  default: '',
  hovered: styles.hovered,
  pressed: styles.pressed,
};

const toneClassMap: Record<CheckboxTone, string> = {
  primary: styles.primary,
  error: styles.error,
};

export function Checkbox({
  checked = false,
  indeterminate = false,
  disabled = false,
  state = 'default',
  tone = 'primary',
  className = '',
}: CheckboxProps) {
  const isSelected = checked || indeterminate;

  return (
    <span
      className={[
        styles.root,
        toneClassMap[tone],
        isSelected ? styles.selected : '',
        disabled ? styles.disabled : '',
        stateClassMap[state],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <span className={styles.stateLayer}>
        <span className={styles.box}>
          {checked ? (
            <svg
              className={styles.checkIcon}
              width="12"
              height="10"
              viewBox="0 0 12 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              focusable="false"
            >
              <path
                d="M4.125 9.25L0.25 5.375L1.3375 4.2875L4.125 7.075L10.6625 0.5375L11.75 1.625L4.125 9.25Z"
                fill="currentColor"
              />
            </svg>
          ) : null}

          {indeterminate && !checked ? (
            <span className={styles.indeterminateIcon} />
          ) : null}
        </span>
      </span>
    </span>
  );
}
