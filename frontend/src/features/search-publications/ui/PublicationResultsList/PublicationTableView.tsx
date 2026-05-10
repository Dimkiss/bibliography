import type { KeyboardEvent } from 'react';

import {
  normalizeJournalName,
  type PublicationListItemDto,
  type PublicationSortOrder,
  type PublicationsSortFieldValue,
} from '@/entities/publication';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Icon } from '@/shared/ui/Icon';
import { DoiValue } from './DoiValue';
import { PublicationQuartileBadge } from './PublicationQuartileBadge';
import { PublicationRowActions } from './PublicationRowActions';
import { stopInteractiveEvent } from './publicationResultsList.lib';
import styles from './PublicationResultsList.module.css';

type PublicationTableViewProps = {
  items: PublicationListItemDto[];
  startIndex: number;
  selectedIdSet: Set<number>;
  pageIds: number[];
  isAllPageSelected: boolean;
  isPageSelectionIndeterminate: boolean;
  isAdmin: boolean;
  openActionMenuId: number | null;
  sortField: PublicationsSortFieldValue;
  sortOrder: PublicationSortOrder;
  onOpenPublication: (articleId: number) => void;
  onOpenPublicationByKeyboard: (
    event: KeyboardEvent<HTMLElement>,
    articleId: number,
  ) => void;
  onToggleItemSelection: (id: number) => void;
  onTogglePageSelection: (ids: number[], shouldSelect: boolean) => void;
  onToggleActionMenu: (id: number) => void;
  onSortFieldChange: (value: PublicationsSortFieldValue) => void;
  onSortOrderChange: (value: PublicationSortOrder) => void;
  onOpenPdf: (item: PublicationListItemDto) => void;
  onOpenDoi: (item: PublicationListItemDto) => void;
  onCopyReference: (item: PublicationListItemDto) => void;
  onEdit: () => void;
  onRequestDelete: (item: PublicationListItemDto) => void;
};

export function PublicationTableView({
  items,
  startIndex,
  selectedIdSet,
  pageIds,
  isAllPageSelected,
  isPageSelectionIndeterminate,
  isAdmin,
  openActionMenuId,
  sortField,
  sortOrder,
  onOpenPublication,
  onOpenPublicationByKeyboard,
  onToggleItemSelection,
  onTogglePageSelection,
  onToggleActionMenu,
  onSortFieldChange,
  onSortOrderChange,
  onOpenPdf,
  onOpenDoi,
  onCopyReference,
  onEdit,
  onRequestDelete,
}: PublicationTableViewProps) {
  const handleTableSort = (field: PublicationsSortFieldValue) => {
    if (field === sortField) {
      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }

    onSortFieldChange(field);
    onSortOrderChange('desc');
  };

  const renderTableHeaderButton = (
    field: PublicationsSortFieldValue,
    label: string,
    className = '',
  ) => {
    const isActive = field === sortField;

    return (
      <button
        type="button"
        className={[styles.tableHeaderButton, className].filter(Boolean).join(' ')}
        onClick={() => handleTableSort(field)}
        aria-label={`Сортировать по полю ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          <Icon
            name={sortOrder === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
            size={20}
            className={styles.tableSortIcon}
          />
        ) : null}
      </button>
    );
  };

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.selectColumn}>
              <button
                type="button"
                className={styles.tableSelectAllButton}
                onClick={() => onTogglePageSelection(pageIds, !isAllPageSelected)}
                disabled={!pageIds.length}
                aria-label="Выбрать все публикации на странице"
                aria-pressed={isAllPageSelected}
              >
                <Checkbox
                  checked={isAllPageSelected}
                  indeterminate={isPageSelectionIndeterminate}
                  disabled={!pageIds.length}
                />
              </button>
            </th>
            <th>{renderTableHeaderButton('authors', 'Авторы')}</th>
            <th>{renderTableHeaderButton('title', 'Название')}</th>
            <th>{renderTableHeaderButton('journal', 'Издание')}</th>
            <th>{renderTableHeaderButton('year', 'Год')}</th>
            <th>{renderTableHeaderButton('doi', 'DOI')}</th>
            <th className={styles.quartileColumn}>
              {renderTableHeaderButton('quartile', 'Q', styles.tableHeaderButtonCenter)}
            </th>
            <th className={styles.actionsColumn} aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const isSelected = selectedIdSet.has(item.id);

            return (
              <tr
                key={item.id}
                className={isSelected ? styles.tableRowSelected : ''}
                onClick={() => onOpenPublication(item.id)}
                onKeyDown={(event) => onOpenPublicationByKeyboard(event, item.id)}
                role="button"
                tabIndex={0}
              >
                <td className={styles.tableNumberCell}>
                  <div className={styles.tableNumberContent}>
                    <span className={styles.tableNumber}>{startIndex + index + 1}</span>
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
                </td>
                <td>{item.authors || 'Авторы не указаны'}</td>
                <td className={styles.tableTitleCell}>
                  {item.title || 'Без названия'}
                </td>
                <td>{normalizeJournalName(item.journal) || 'Издание не указано'}</td>
                <td className={styles.yearCell}>{item.year ?? '—'}</td>
                <td className={styles.tableDoiCell}>
                  <DoiValue doi={item.doi} />
                </td>
                <td className={styles.quartileCell}>
                  <PublicationQuartileBadge item={item} />
                </td>
                <td>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
