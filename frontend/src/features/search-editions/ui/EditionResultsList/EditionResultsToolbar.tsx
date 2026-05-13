import {
  type EditionKind,
  type EditionSortOrder,
  type EditionsSortFieldValue,
} from '@/entities/edition';
import { formatRecordsCountLabel } from '@/shared/lib/formatRecordsCountLabel';
import { Checkbox } from '@/shared/ui/Checkbox';
import { OrderMenu } from '@/shared/ui/OrderMenu';
import { ViewModeToggle } from '@/shared/ui/ViewModeToggle';
import type { EditionResultsViewMode } from '../../model/editionResultsView';
import styles from './EditionResultsList.module.css';

type SortOption = {
  value: EditionsSortFieldValue;
  label: string;
};

type EditionResultsToolbarProps = {
  kind: EditionKind;
  total: number;
  selectedCount: number;
  pageIds: string[];
  isAllPageSelected: boolean;
  isPageSelectionIndeterminate: boolean;
  viewMode: EditionResultsViewMode;
  sortField: EditionsSortFieldValue;
  sortOrder: EditionSortOrder;
  sortOptions: SortOption[];
  onViewModeChange: (value: EditionResultsViewMode) => void;
  onTogglePageSelection: (ids: string[], shouldSelect: boolean) => void;
  onSortFieldChange: (value: EditionsSortFieldValue) => void;
  onSortOrderChange: (value: EditionSortOrder) => void;
};

export function EditionResultsToolbar({
  kind,
  total,
  selectedCount,
  pageIds,
  isAllPageSelected,
  isPageSelectionIndeterminate,
  viewMode,
  sortField,
  sortOrder,
  sortOptions,
  onViewModeChange,
  onTogglePageSelection,
  onSortFieldChange,
  onSortOrderChange,
}: EditionResultsToolbarProps) {
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
          ariaLabel="Тип вывода изданий"
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
            options={sortOptions}
            value={sortField}
            order={sortOrder}
            fallbackLabel="Название"
            selectAriaLabel="Выбрать поле сортировки"
            dividerAfterValues={kind === 'periodical' ? ['issn'] : []}
            onValueChange={onSortFieldChange}
            onOrderChange={onSortOrderChange}
          />
        </div>
      ) : null}
    </>
  );
}
