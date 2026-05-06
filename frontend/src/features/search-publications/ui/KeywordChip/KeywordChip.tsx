import { Icon } from '@/shared/ui/Icon';
import styles from './KeywordChip.module.css';

type KeywordChipProps = {
  value: string;
  onRemove: (value: string) => void;
};

export function KeywordChip({ value, onRemove }: KeywordChipProps) {
  return (
    <span className={styles.chip}>
      <span className={styles.text}>{value}</span>
      <button
        type="button"
        className={styles.removeButton}
        onClick={() => onRemove(value)}
        aria-label={`Удалить ключевое слово ${value}`}
      >
        <Icon name="close" size={18} />
      </button>
    </span>
  );
}
