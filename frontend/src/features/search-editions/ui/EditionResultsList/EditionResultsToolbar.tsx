import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type EditionSortOrder,
  type EditionsSortFieldValue,
} from '@/entities/edition';
import { formatRecordsCountLabel } from '@/shared/lib/formatRecordsCountLabel';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Icon } from '@/shared/ui/Icon';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import { ViewModeToggle } from '@/shared/ui/ViewModeToggle';
import type { EditionResultsViewMode } from '../../model/editionResultsView';
import styles from './EditionResultsList.module.css';

type SortOption = {
  value: EditionsSortFieldValue;
  label: string;
};

type EditionResultsToolbarProps = {
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
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!sortRef.current?.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const currentSortLabel = useMemo(() => {
    return sortOptions.find((item) => item.value === sortField)?.label ?? 'Название';
  }, [sortField, sortOptions]);

  return (
    <>
      <div className={styles.summaryRow}>
        <div className={styles.summaryGroup}>
          <span className={styles.summary}>
            Найдено: {total} {formatRecordsCountLabel(total)}
          </span>
          {selectedCount > 0 ? (
            <span className={styles.summary}>
              Выбрано: {selectedCount} {formatRecordsCountLabel(selectedCount)}
            </span>
          ) : null}
        </div>

        <ViewModeToggle
          value={viewMode}
          onChange={onViewModeChange}
          ariaLabel="Тип вывода изданий"
          listIconName="journal-outline"
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

          <div className={styles.sortControls}>
            <span className={styles.sortLabel}>Сортировать</span>

            <div ref={sortRef} className={styles.sortSelectWrap}>
              <button
                type="button"
                className={styles.sortSelectButton}
                onClick={() => setIsSortOpen((prev) => !prev)}
                aria-expanded={isSortOpen}
                aria-label="Выбрать поле сортировки"
              >
                <span className={styles.sortSelectText}>{currentSortLabel}</span>
                <Icon
                  name={isSortOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
                  size={18}
                />
              </button>

              {isSortOpen ? (
                <div className={styles.sortMenu}>
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={[
                        styles.sortOption,
                        option.value === sortField ? styles.sortOptionActive : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        onSortFieldChange(option.value);
                        setIsSortOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <OutlineIconButton
              iconName={sortOrder === 'asc' ? 'order-asc' : 'order-desc'}
              iconSize={20}
              size="small-x"
              onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
              aria-label={
                sortOrder === 'asc'
                  ? 'Переключить сортировку по убыванию'
                  : 'Переключить сортировку по возрастанию'
              }
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
