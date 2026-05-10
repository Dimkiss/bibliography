import type { MouseEvent as ReactMouseEvent } from 'react';

import {
  getPublicationPdfUrl,
  type PublicationListItemDto,
} from '@/entities/publication';
import type { QuartilesDropdownItem } from '@/shared/ui/QuartilesDropdown';

export function formatRecordsCountLabel(count: number): string {
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

export function openPublicationPdf(articleId: number) {
  window.open(getPublicationPdfUrl(articleId), '_blank', 'noopener,noreferrer');
}

export function stopInteractiveEvent(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export function isQuartileValue(value?: string | null): boolean {
  return Boolean(value?.trim().match(/^q?[1-4]$/i));
}

export function buildQuartileItems(
  item: PublicationListItemDto,
): QuartilesDropdownItem[] {
  return [
    {
      label: 'Web of Science',
      value: isQuartileValue(item.quartile) ? item.quartile : null,
    },
    {
      label: 'Scopus',
      value: isQuartileValue(item.quartile_scopus) ? item.quartile_scopus : null,
    },
    {
      label: 'Белый список',
      value: null,
    },
  ];
}
