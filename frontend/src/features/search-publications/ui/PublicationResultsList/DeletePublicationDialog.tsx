import type { PublicationListItemDto } from '@/entities/publication';
import styles from './PublicationResultsList.module.css';

type DeletePublicationDialogProps = {
  item: PublicationListItemDto;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeletePublicationDialog({
  item,
  onCancel,
  onConfirm,
}: DeletePublicationDialogProps) {
  return (
    <div
      className={styles.confirmOverlay}
      role="presentation"
      onMouseDown={onCancel}
    >
      <div
        className={styles.confirmDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-publication-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="delete-publication-title" className={styles.confirmTitle}>
          Удалить публикацию?
        </h2>
        <p className={styles.confirmText}>
          Вы точно хотите удалить публикацию «{item.title || `#${item.id}`}»? Это
          действие нельзя отменить.
        </p>
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.confirmCancelButton}
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            type="button"
            className={styles.confirmDeleteButton}
            onClick={onConfirm}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
