import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  PublicationListItemDto,
  PublicationSortOrder,
} from '@/shared/api/publications';
import { PublicationResultCard } from '@/components/PublicationResultCard';
import { Icon } from '@/shared/ui/Icon';
import {
  PUBLICATIONS_SORT_FIELD_OPTIONS,
  type PublicationsSortFieldValue,
} from '@/shared/lib/publications';
import { navigateTo } from '@/shared/lib/navigation';
import styles from './PublicationResultsList.module.css';

type PublicationResultsListProps = {
  items: PublicationListItemDto[];
  total: number;
  isLoading?: boolean;
  error?: string | null;
  sortField: PublicationsSortFieldValue;
  sortOrder: PublicationSortOrder;
  onSortFieldChange: (value: PublicationsSortFieldValue) => void;
  onSortOrderChange: (value: PublicationSortOrder) => void;
};

export function PublicationResultsList({
  items,
  total,
  isLoading = false,
  error = null,
  sortField,
  sortOrder,
  onSortFieldChange,
  onSortOrderChange,
}: PublicationResultsListProps) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!sortRef.current) {
        return;
      }

      if (!sortRef.current.contains(event.target as Node)) {
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
    <section className={styles.section}>
      <div className={styles.summaryRow}>
        <div className={styles.summary}>
          Найдено: {total} записей
        </div>

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
                name={isSortOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                size={20}
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

          <button
            type="button"
            className={styles.orderButton}
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
            aria-label={
              sortOrder === 'asc'
                ? 'Переключить сортировку по убыванию'
                : 'Переключить сортировку по возрастанию'
            }
          >
            <Icon
              name={sortOrder === 'asc' ? 'order-asc' : 'order-desc'}
              size={20}
            />
          </button>
        </div>
      </div>

      {isLoading ? <div className={styles.state}>Загрузка публикаций...</div> : null}

      {!isLoading && error ? <div className={styles.state}>{error}</div> : null}

      {!isLoading && !error && !items.length ? (
        <div className={styles.state}>По вашему запросу публикации не найдены.</div>
      ) : null}

      {!isLoading && !error && items.length ? (
        <div className={styles.list}>
          {items.map((item) => (
            <PublicationResultCard
              key={item.id}
              item={item}
              onClick={() => navigateTo(`/articles/${item.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigateTo(`/articles/${item.id}`);
                }
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
