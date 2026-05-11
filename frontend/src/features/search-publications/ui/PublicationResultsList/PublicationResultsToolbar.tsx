import {
  PUBLICATIONS_SORT_FIELD_OPTIONS,
  type PublicationSortOrder,
  type PublicationsSortFieldValue,
} from '@/entities/publication';
import { Checkbox } from '@/shared/ui/Checkbox';
import { OrderMenu } from '@/shared/ui/OrderMenu';
import { ViewModeToggle } from '@/shared/ui/ViewModeToggle';
import type { PublicationResultsViewMode } from './PublicationResultsList.types';
import { formatRecordsCountLabel } from './publicationResultsList.lib';
import styles from './PublicationResultsList.module.css';

type PublicationResultsToolbarProps = {
  total: number;
  selectedCount: number;
  pageIds: number[];
  isAllPageSelected: boolean;
  isPageSelectionIndeterminate: boolean;
  viewMode: PublicationResultsViewMode;
  sortField: PublicationsSortFieldValue;
  sortOrder: PublicationSortOrder;
  onViewModeChange: (value: PublicationResultsViewMode) => void;
  onTogglePageSelection: (ids: number[], shouldSelect: boolean) => void;
  onSortFieldChange: (value: PublicationsSortFieldValue) => void;
  onSortOrderChange: (value: PublicationSortOrder) => void;
};

export function PublicationResultsToolbar({
  total,
  selectedCount,
  pageIds,
  isAllPageSelected,
  isPageSelectionIndeterminate,
  viewMode,
  sortField,
  sortOrder,
  onViewModeChange,
  onTogglePageSelection,
  onSortFieldChange,
  onSortOrderChange,
}: PublicationResultsToolbarProps) {
  return (
    <>
      <div className={styles.summaryRow}>
        <div className={styles.summaryGroup}>
          <span className={styles.summary}>
            Найдено: {total} {formatRecordsCountLabel(total)}
          </span>
          <span className={styles.summary}>
            Выбрано: {selectedCount} {formatRecordsCountLabel(selectedCount)}
          </span>
        </div>

        <ViewModeToggle
          value={viewMode}
          onChange={onViewModeChange}
          ariaLabel="Тип вывода публикаций"
        />
      </div>

      {viewMode === 'list' ? (
        <div className={styles.controlsRow}>
          <button
            type="button"
            className={styles.selectAllButton}
            onClick={() => onTogglePageSelection(pageIds, !isAllPageSelected)}
            disabled={!pageIds.length}
            aria-pressed={isAllPageSelected}
          >
            <Checkbox
              checked={isAllPageSelected}
              indeterminate={isPageSelectionIndeterminate}
              disabled={!pageIds.length}
            />
            <span>Выбрать все</span>
          </button>

          <OrderMenu
            options={PUBLICATIONS_SORT_FIELD_OPTIONS}
            value={sortField}
            order={sortOrder}
            fallbackLabel="Год"
            selectAriaLabel="Выбрать поле сортировки"
            onValueChange={onSortFieldChange}
            onOrderChange={onSortOrderChange}
          />
        </div>
      ) : null}
    </>
  );
}
