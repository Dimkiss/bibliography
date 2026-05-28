import { useState } from 'react';

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
  onDownloadReport?: () => Promise<void>;
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
  onDownloadReport,
}: PublicationSelectionActionsPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
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

  const handleDownloadReport = async () => {
    if (!onDownloadReport) return;
    setIsDownloading(true);
    onActionStart?.();
    try {
      await onDownloadReport();
    } catch {
      onActionMessage('Не удалось сформировать отчёт.');
    } finally {
      setIsDownloading(false);
    }
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

        {onDownloadReport ? (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => {
              void handleDownloadReport();
            }}
            disabled={isDownloading}
          >
            <Icon name="download" size={20} />
            <span>{isDownloading ? 'Формирование...' : 'Отчёт (.xlsx)'}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
