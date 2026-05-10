import type { KeyboardEvent } from 'react';

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
  onEdit: () => void;
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
              <h3 className={styles.cardTitle}>{item.title || 'Без названия'}</h3>
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
              onEdit={onEdit}
              onDelete={() => onRequestDelete(item)}
            />
          </article>
        );
      })}
    </div>
  );
}
