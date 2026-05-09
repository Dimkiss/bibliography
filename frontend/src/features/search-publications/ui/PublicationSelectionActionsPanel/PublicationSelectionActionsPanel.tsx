import type { PublicationListItemDto } from '@/entities/publication';
import {
  getBibliographicReference,
  getPublicationPdfUrl,
} from '@/entities/publication';
import { Icon } from '@/shared/ui/Icon';
import styles from './PublicationSelectionActionsPanel.module.css';

type PublicationSelectionActionsPanelProps = {
  selectedItems: PublicationListItemDto[];
  onActionStart?: () => void;
  onActionMessage: (message: string) => void;
};

function formatRecordsCountLabel(count: number): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return 'запись';
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'записи';
  }

  return 'записей';
}

function openPublicationPdf(articleId: number) {
  window.open(getPublicationPdfUrl(articleId), '_blank', 'noopener,noreferrer');
}

export function PublicationSelectionActionsPanel({
  selectedItems,
  onActionStart,
  onActionMessage,
}: PublicationSelectionActionsPanelProps) {
  const selectedCount = selectedItems.length;
  const selectedPdfCount = selectedItems.filter((item) => item.has_pdf).length;
  const selectedReferenceCount = selectedItems.filter((item) =>
    Boolean(getBibliographicReference(item)),
  ).length;

  if (!selectedCount) {
    return null;
  }

  const handleOpenPdfs = () => {
    const itemsWithPdf = selectedItems.filter((item) => item.has_pdf);

    if (!itemsWithPdf.length) {
      return;
    }

    onActionStart?.();
    itemsWithPdf.forEach((item) => openPublicationPdf(item.id));
    onActionMessage(
      itemsWithPdf.length === selectedItems.length
        ? `Открыто PDF: ${itemsWithPdf.length}.`
        : `Открыто PDF: ${itemsWithPdf.length} из ${selectedItems.length} выбранных.`,
    );
  };

  const handleCopyReferences = async () => {
    const references = selectedItems
      .map((item) => getBibliographicReference(item))
      .filter(Boolean);

    if (!references.length) {
      return;
    }

    onActionStart?.();

    try {
      await navigator.clipboard.writeText(references.join('\n\n'));
      onActionMessage(
        references.length === 1
          ? 'Библиографическая ссылка скопирована.'
          : `Скопировано библиографических ссылок: ${references.length}.`,
      );
    } catch {
      onActionMessage('Не удалось скопировать библиографические ссылки.');
    }
  };

  return (
    <div
      className={styles.panel}
      role="region"
      aria-label="Действия с выбранными публикациями"
    >
      <div className={styles.info}>
        <span className={styles.title}>
          Выбрано: {selectedCount} {formatRecordsCountLabel(selectedCount)}
        </span>
      </div>

      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={handleOpenPdfs}
          disabled={!selectedPdfCount}
        >
          <Icon
            name={selectedPdfCount ? 'pdf-color' : 'pdf-mono'}
            size={20}
            colored={Boolean(selectedPdfCount)}
          />
          <span>Открыть PDF</span>
        </button>

        <button
          type="button"
          className={styles.actionButton}
          onClick={() => {
            void handleCopyReferences();
          }}
          disabled={!selectedReferenceCount}
        >
          <Icon name="copy" size={20} />
          <span>Копировать библ. ссылку</span>
        </button>
      </div>
    </div>
  );
}
