import type { KeyboardEvent } from 'react';

import {
  type EditionKind,
  type EditionListItemDto,
} from '@/entities/edition';
import { Checkbox } from '@/shared/ui/Checkbox';
import { EditionMetrics } from './EditionMetricBadge';
import { EditionRowActions } from './EditionRowActions';
import { stopInteractiveEvent } from './editionResultsList.lib';
import styles from './EditionResultsList.module.css';

type EditionListViewProps = {
  kind: EditionKind;
  items: EditionListItemDto[];
  selectedIdSet: Set<string>;
  openActionMenuId: string | null;
  onOpenEdition: (item: EditionListItemDto) => void;
  onOpenEditionByKeyboard: (
    event: KeyboardEvent<HTMLElement>,
    item: EditionListItemDto,
  ) => void;
  onToggleItemSelection: (id: string) => void;
  onToggleActionMenu: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function EditionListView({
  kind,
  items,
  selectedIdSet,
  openActionMenuId,
  onOpenEdition,
  onOpenEditionByKeyboard,
  onToggleItemSelection,
  onToggleActionMenu,
  onEdit,
  onDelete,
}: EditionListViewProps) {
  return (
    <div className={styles.list}>
      {items.map((item) => {
        const isSelected = selectedIdSet.has(item.id);

        return (
          <article
            key={item.id}
            className={[
              styles.editionCard,
              kind === 'periodical' ? styles.periodicalCard : styles.nonperiodicalCard,
              isSelected ? styles.editionCardSelected : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onOpenEdition(item)}
            onKeyDown={(event) => onOpenEditionByKeyboard(event, item)}
            role="button"
            tabIndex={0}
          >
            <button
              type="button"
              className={styles.checkboxButton}
              onClick={(event) => {
                stopInteractiveEvent(event);
                onToggleItemSelection(item.id);
              }}
              aria-label={isSelected ? 'Снять выбор с издания' : 'Выбрать издание'}
              aria-pressed={isSelected}
            >
              <Checkbox checked={isSelected} />
            </button>

            <div className={styles.cardMain}>
              <h3 className={styles.cardTitle}>{item.title || 'Без названия'}</h3>

              {kind === 'periodical' ? (
                <p className={styles.cardMeta}>ISSN: {item.identifier || '—'}</p>
              ) : (
                <>
                  {item.contributors ? (
                    <p className={styles.cardMeta}>
                      {item.contributors_label || 'Авторы'}: {item.contributors}
                    </p>
                  ) : null}
                  {item.identifier || item.tirage ? (
                    <p className={styles.cardMeta}>
                      {item.identifier ? `ISBN: ${item.identifier}` : null}
                      {item.identifier && item.tirage ? '    ' : null}
                      {item.tirage ? `Тираж: ${item.tirage}` : null}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {kind === 'periodical' ? (
              <EditionMetrics item={item} />
            ) : (
              <div className={styles.cardType}>
                <div>{item.publication_type || '—'}</div>
                <div>{item.year ?? '—'}</div>
              </div>
            )}

            <EditionRowActions
              isMenuOpen={openActionMenuId === item.id}
              onToggleMenu={() => onToggleActionMenu(item.id)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </article>
        );
      })}
    </div>
  );
}
