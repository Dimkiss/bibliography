import { useEffect, useMemo, useRef, useState } from 'react';

import {
  PUBLICATIONS_SORT_FIELD_OPTIONS,
  type PublicationSortOrder,
  type PublicationsSortFieldValue,
} from '@/entities/publication';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Icon } from '@/shared/ui/Icon';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
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
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
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
    return (
      PUBLICATIONS_SORT_FIELD_OPTIONS.find((item) => item.value === sortField)?.label ??
      'Год'
    );
  }, [sortField]);

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

        <div className={styles.viewToggle} role="group" aria-label="Тип вывода публикаций">
          <button
            type="button"
            className={[
              styles.viewToggleButton,
              viewMode === 'list' ? styles.viewToggleButtonActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onViewModeChange('list')}
            aria-label="Показать списком"
            aria-pressed={viewMode === 'list'}
          >
            <Icon name="article-outline" size={20} />
          </button>
          <button
            type="button"
            className={[
              styles.viewToggleButton,
              viewMode === 'table' ? styles.viewToggleButtonActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onViewModeChange('table')}
            aria-label="Показать таблицей"
            aria-pressed={viewMode === 'table'}
          >
            <Icon name="check" size={20} />
          </button>
        </div>
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
                  {PUBLICATIONS_SORT_FIELD_OPTIONS.map((option) => (
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
