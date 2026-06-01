import type { KeyboardEvent, MouseEvent } from 'react';

import {
  normalizeJournalName,
  type PublicationListItemDto,
} from '@/entities/publication';
import { Checkbox } from '@/shared/ui/Checkbox';
import { DoiValue } from './DoiValue';
import { PublicationQuartileBadge } from './PublicationQuartileBadge';
import { PublicationRowActions } from './PublicationRowActions';
import { stopInteractiveEvent } from './publicationResultsList.lib';
import styles from './PublicationResultsList.module.css';

type PublicationListViewProps = {
  items: PublicationListItemDto[];
  startIndex: number;
  selectedIdSet: Set<number>;
  isAdmin: boolean;
  openActionMenuId: number | null;
  onOpenPublication: (articleId: number) => void;
  onOpenPublicationByKeyboard: (
    event: KeyboardEvent<HTMLElement>,
    articleId: number,
  ) => void;
  onToggleItemSelection: (id: number) => void;
  onToggleActionMenu: (id: number) => void;
  onOpenPdf: (item: PublicationListItemDto) => void;
  onOpenDoi: (item: PublicationListItemDto) => void;
  onCopyReference: (item: PublicationListItemDto) => void;
  onEdit: (item: PublicationListItemDto) => void;
  onRequestDelete: (item: PublicationListItemDto) => void;
};

export function PublicationListView({
  items,
  startIndex,
  selectedIdSet,
  isAdmin,
  openActionMenuId,
  onOpenPublication,
  onOpenPublicationByKeyboard,
  onToggleItemSelection,
  onToggleActionMenu,
  onOpenPdf,
  onOpenDoi,
  onCopyReference,
  onEdit,
  onRequestDelete,
}: PublicationListViewProps) {
  const handlePublicationLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    articleId: number,
  ) => {
    event.stopPropagation();

    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onOpenPublication(articleId);
  };

  return (
    <div className={styles.list}>
      {items.map((item, index) => {
        const isSelected = selectedIdSet.has(item.id);

        return (
          <article
            key={item.id}
            className={[
              styles.publicationCard,
              isSelected ? styles.publicationCardSelected : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onOpenPublication(item.id)}
            onKeyDown={(event) => onOpenPublicationByKeyboard(event, item.id)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.cardNumberCell}>
              <span className={styles.cardNumber}>{startIndex + index + 1}</span>
              <button
                type="button"
                className={styles.checkboxButton}
                onClick={(event) => {
                  stopInteractiveEvent(event);
                  onToggleItemSelection(item.id);
                }}
                aria-label={
                  isSelected
                    ? 'Снять выбор с публикации'
                    : 'Выбрать публикацию'
                }
                aria-pressed={isSelected}
              >
                <Checkbox checked={isSelected} />
              </button>
            </div>

            <div className={styles.cardMain}>
              <h3 className={styles.cardTitle}>
                <a
                  className={styles.publicationLink}
                  href={`/articles/${item.id}`}
                  onClick={(event) => handlePublicationLinkClick(event, item.id)}
                >
                  {item.title || 'Без названия'}
                </a>
              </h3>
              <p className={styles.authors}>{item.authors || 'Авторы не указаны'}</p>
              <div className={styles.cardDoi}>
                <span>DOI:</span>
                <DoiValue doi={item.doi} />
              </div>
            </div>

            <div className={styles.cardJournal}>
              <div>{normalizeJournalName(item.journal) || 'Издание не указано'}</div>
              <div className={styles.yearValue}>{item.year ?? '—'}</div>
            </div>

            <div className={styles.cardQuartile}>
              <PublicationQuartileBadge item={item} />
            </div>

            <PublicationRowActions
              item={item}
              isAdmin={isAdmin}
              isMenuOpen={openActionMenuId === item.id}
              onToggleMenu={() => onToggleActionMenu(item.id)}
              onOpenPdf={() => onOpenPdf(item)}
              onOpenDoi={() => onOpenDoi(item)}
              onCopyReference={() => onCopyReference(item)}
              onEdit={() => onEdit(item)}
              onDelete={() => onRequestDelete(item)}
            />
          </article>
        );
      })}
    </div>
  );
}
