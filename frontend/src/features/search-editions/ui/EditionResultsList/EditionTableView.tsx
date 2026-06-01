import type { KeyboardEvent } from 'react';

import {
  formatEditionPresence,
  type EditionKind,
  type EditionListItemDto,
  type EditionSortOrder,
  type EditionsSortFieldValue,
} from '@/entities/edition';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Icon } from '@/shared/ui/Icon';
import {
  EditionScopusQuartileBadge,
  EditionWhiteListLevelBadge,
  EditionWosQuartileBadge,
} from './EditionQuartileBadge';
import { EditionRowActions } from './EditionRowActions';
import { stopInteractiveEvent } from './editionResultsList.lib';
import styles from './EditionResultsList.module.css';

type EditionTableViewProps = {
  kind: EditionKind;
  items: EditionListItemDto[];
  selectedIdSet: Set<string>;
  pageIds: string[];
  isAllPageSelected: boolean;
  isPageSelectionIndeterminate: boolean;
  isAdmin: boolean;
  openActionMenuId: string | null;
  sortField: EditionsSortFieldValue;
  sortOrder: EditionSortOrder;
  onOpenEdition: (item: EditionListItemDto) => void;
  onOpenEditionByKeyboard: (
    event: KeyboardEvent<HTMLElement>,
    item: EditionListItemDto,
  ) => void;
  onToggleItemSelection: (id: string) => void;
  onTogglePageSelection: (ids: string[], shouldSelect: boolean) => void;
  onToggleActionMenu: (id: string) => void;
  onSortFieldChange: (value: EditionsSortFieldValue) => void;
  onSortOrderChange: (value: EditionSortOrder) => void;
  onEdit: (item: EditionListItemDto) => void;
  onDelete: (item: EditionListItemDto) => void;
};

export function EditionTableView({
  kind,
  items,
  selectedIdSet,
  pageIds,
  isAllPageSelected,
  isPageSelectionIndeterminate,
  isAdmin,
  openActionMenuId,
  sortField,
  sortOrder,
  onOpenEdition,
  onOpenEditionByKeyboard,
  onToggleItemSelection,
  onTogglePageSelection,
  onToggleActionMenu,
  onSortFieldChange,
  onSortOrderChange,
  onEdit,
  onDelete,
}: EditionTableViewProps) {
  const handleTableSort = (field: EditionsSortFieldValue) => {
    if (field === sortField) {
      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }

    onSortFieldChange(field);
    onSortOrderChange(field === 'year' ? 'desc' : 'asc');
  };

  const renderTableHeaderButton = (
    field: EditionsSortFieldValue,
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
      <table
        className={[
          styles.table,
          kind === 'periodical' ? styles.periodicalTable : styles.nonperiodicalTable,
        ].join(' ')}
      >
        <thead>
          {kind === 'periodical' ? (
            <tr>
              <th className={styles.selectColumn}>
                <button
                  type="button"
                  className={styles.tableSelectAllButton}
                  onClick={() => onTogglePageSelection(pageIds, !isAllPageSelected)}
                  disabled={!pageIds.length}
                  aria-label="Выбрать все издания на странице"
                  aria-pressed={isAllPageSelected}
                >
                  <Checkbox
                    checked={isAllPageSelected}
                    indeterminate={isPageSelectionIndeterminate}
                    disabled={!pageIds.length}
                  />
                </button>
              </th>
              <th>{renderTableHeaderButton('title', 'Название')}</th>
              <th>{renderTableHeaderButton('issn', 'ISSN')}</th>
              <th>{renderTableHeaderButton('white_list', 'УБС')}</th>
              <th>{renderTableHeaderButton('wos', 'Q WoS')}</th>
              <th>{renderTableHeaderButton('scopus', 'Q Scopus')}</th>
              <th>{renderTableHeaderButton('rinc', 'РИНЦ')}</th>
              <th>{renderTableHeaderButton('vak', 'ВАК')}</th>
              <th className={styles.actionsColumn} aria-label="Действия" />
            </tr>
          ) : (
            <tr>
              <th className={styles.selectColumn}>
                <button
                  type="button"
                  className={styles.tableSelectAllButton}
                  onClick={() => onTogglePageSelection(pageIds, !isAllPageSelected)}
                  disabled={!pageIds.length}
                  aria-label="Выбрать все издания на странице"
                  aria-pressed={isAllPageSelected}
                >
                  <Checkbox
                    checked={isAllPageSelected}
                    indeterminate={isPageSelectionIndeterminate}
                    disabled={!pageIds.length}
                  />
                </button>
              </th>
              <th>{renderTableHeaderButton('title', 'Название')}</th>
              <th>Редакторы/Авторы</th>
              <th>{renderTableHeaderButton('type', 'Тип')}</th>
              <th>{renderTableHeaderButton('year', 'Год')}</th>
              <th>ISBN</th>
              <th>Тираж</th>
              <th className={styles.actionsColumn} aria-label="Действия" />
            </tr>
          )}
        </thead>
        <tbody>
          {items.map((item) => {
            const isSelected = selectedIdSet.has(item.id);

            return (
              <tr
                key={item.id}
                className={isSelected ? styles.tableRowSelected : ''}
                onClick={() => onOpenEdition(item)}
                onKeyDown={(event) => onOpenEditionByKeyboard(event, item)}
                role="button"
                tabIndex={0}
              >
                <td className={styles.tableSelectCell}>
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
                </td>

                {kind === 'periodical' ? (
                  <>
                    <td className={styles.tableTitleCell}>{item.title || 'Без названия'}</td>
                    <td>{item.identifier || '—'}</td>
                    <td className={styles.centerCell}>
                      <EditionWhiteListLevelBadge item={item} />
                    </td>
                    <td className={styles.centerCell}>
                      <EditionWosQuartileBadge item={item} />
                    </td>
                    <td className={styles.centerCell}>
                      <EditionScopusQuartileBadge item={item} />
                    </td>
                    <td className={styles.centerCell}>
                      <span className={styles.inlineBadge}>
                        {formatEditionPresence(item.rinc)}
                      </span>
                    </td>
                    <td className={styles.centerCell}>
                      <span className={styles.inlineBadge}>
                        {formatEditionPresence(item.vak)}
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={styles.tableTitleCell}>{item.title || 'Без названия'}</td>
                    <td>{item.contributors || '—'}</td>
                    <td>{item.publication_type || '—'}</td>
                    <td>{item.year ?? '—'}</td>
                    <td>{item.identifier || '—'}</td>
                    <td>{item.tirage || '—'}</td>
                  </>
                )}

                <td className={styles.actionsCell}>
                  {isAdmin ? (
                    <EditionRowActions
                      isMenuOpen={openActionMenuId === item.id}
                      onToggleMenu={() => onToggleActionMenu(item.id)}
                      onEdit={() => onEdit(item)}
                      onDelete={() => onDelete(item)}
                    />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
