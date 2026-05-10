import type { MouseEvent as ReactMouseEvent } from 'react';

import {
  getPublicationPdfUrl,
  type PublicationListItemDto,
} from '@/entities/publication';
import type { QuartilesDropdownItem } from '@/shared/ui/QuartilesDropdown';
export { formatRecordsCountLabel } from '@/shared/lib/formatRecordsCountLabel';

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
