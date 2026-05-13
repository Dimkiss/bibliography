import { Icon } from '@/shared/ui/Icon';
import styles from './ViewModeToggle.module.css';

export type ViewModeToggleValue = 'list' | 'table';

type ViewModeToggleProps = {
  value: ViewModeToggleValue;
  onChange: (value: ViewModeToggleValue) => void;
  ariaLabel: string;
  listIconName?: string;
  tableIconName?: string;
  listLabel?: string;
  tableLabel?: string;
  className?: string;
};

export function ViewModeToggle({
  value,
  onChange,
  ariaLabel,
  listIconName = 'view_list',
  tableIconName = 'table',
  listLabel = 'Показать списком',
  tableLabel = 'Показать таблицей',
  className = '',
}: ViewModeToggleProps) {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={[
          styles.button,
          value === 'list' ? styles.buttonActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onChange('list')}
        aria-label={listLabel}
        aria-pressed={value === 'list'}
      >
        <Icon name={listIconName} size={20} />
      </button>
      <button
        type="button"
        className={[
          styles.button,
          value === 'table' ? styles.buttonActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onChange('table')}
        aria-label={tableLabel}
        aria-pressed={value === 'table'}
      >
        <Icon name={tableIconName} size={20} />
      </button>
    </div>
  );
}
