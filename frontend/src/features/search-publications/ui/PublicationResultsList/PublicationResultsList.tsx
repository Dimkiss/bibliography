import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import type {
  PublicationListItemDto,
  PublicationSortOrder,
} from '@/entities/publication';
import {
  buildDoiUrl,
  getPublicationPdfUrl,
  normalizeJournalName,
} from '@/entities/publication';
import { Icon } from '@/shared/ui/Icon';
import { Checkbox } from '@/shared/ui/Checkbox';
import {
  QuartilesDropdown,
  type QuartilesDropdownItem,
} from '@/shared/ui/QuartilesDropdown';
import {
  PUBLICATIONS_SORT_FIELD_OPTIONS,
  type PublicationsSortFieldValue,
} from '@/entities/publication';
import { navigateTo } from '@/shared/lib/navigation';
import styles from './PublicationResultsList.module.css';

export type PublicationResultsViewMode = 'list' | 'table';

type PublicationResultsListProps = {
  items: PublicationListItemDto[];
  total: number;
  startIndex?: number;
  isLoading?: boolean;
  error?: string | null;
  selectedIds: number[];
  viewMode: PublicationResultsViewMode;
  sortField: PublicationsSortFieldValue;
  sortOrder: PublicationSortOrder;
  onViewModeChange: (value: PublicationResultsViewMode) => void;
  onToggleItemSelection: (id: number) => void;
  onTogglePageSelection: (ids: number[], shouldSelect: boolean) => void;
  onSortFieldChange: (value: PublicationsSortFieldValue) => void;
  onSortOrderChange: (value: PublicationSortOrder) => void;
};

function formatRecordsCountLabel(count: number): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return 'запись';
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'записи';
  }

  return 'записей';
}

function downloadPublicationPdf(articleId: number) {
  const link = document.createElement('a');
  link.href = getPublicationPdfUrl(articleId);
  link.download = `article-${articleId}.pdf`;
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadPublicationPdfs(articleIds: number[]) {
  articleIds.forEach((articleId, index) => {
    if (index === 0) {
      downloadPublicationPdf(articleId);
      return;
    }

    window.setTimeout(() => {
      downloadPublicationPdf(articleId);
    }, index * 120);
  });
}

function stopInteractiveEvent(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function DoiValue({ doi }: { doi: string | null }) {
  const doiUrl = buildDoiUrl(doi);

  if (!doi) {
    return <span className={styles.placeholder}>—</span>;
  }

  if (!doiUrl) {
    return <span className={styles.doiText}>{doi}</span>;
  }

  return (
    <a
      className={styles.doiLink}
      href={doiUrl}
      target="_blank"
      rel="noreferrer"
      onClick={stopInteractiveEvent}
    >
      {doi}
    </a>
  );
}

function isQuartileValue(value?: string | null): boolean {
  return Boolean(value?.trim().match(/^q?[1-4]$/i));
}

function buildQuartileItems(item: PublicationListItemDto): QuartilesDropdownItem[] {
  return [
    {
      label: 'Web of Science',
      value: isQuartileValue(item.quartile) ? item.quartile : null,
    },
    {
      label: 'Scopus',
      value: isQuartileValue(item.quartile_scopus) ? item.quartile_scopus : null,
    },
    {
      label: 'Белый список',
      value: null,
    },
  ];
}

function QuartileBadge({ item }: { item: PublicationListItemDto }) {
  const items = buildQuartileItems(item);
  const value = items.find((quartileItem) => quartileItem.value)?.value ?? null;

  return (
    <div onClick={stopInteractiveEvent}>
      <QuartilesDropdown
        value={value}
        items={items}
        menuAlign="right"
        ariaLabel="Показать квартили публикации"
      />
    </div>
  );
}

function RowActions({
  item,
  onCopyStub,
}: {
  item: PublicationListItemDto;
  onCopyStub: () => void;
}) {
  return (
    <div className={styles.rowActions} onClick={stopInteractiveEvent}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Дополнительные действия"
        onClick={stopInteractiveEvent}
      >
        <Icon name="more_horiz" size={20} />
      </button>

      <button
        type="button"
        className={styles.iconButton}
        aria-label="Копировать данные публикации"
        onClick={(event) => {
          stopInteractiveEvent(event);
          onCopyStub();
        }}
      >
        <Icon name="copy" size={20} />
      </button>

      <button
        type="button"
        className={styles.iconButton}
        aria-label="Скачать PDF"
        onClick={(event) => {
          stopInteractiveEvent(event);
          downloadPublicationPdf(item.id);
        }}
      >
        <Icon name="pdf-color" size={20} colored />
      </button>
    </div>
  );
}

export function PublicationResultsList({
  items,
  total,
  startIndex = 0,
  isLoading = false,
  error = null,
  selectedIds,
  viewMode,
  sortField,
  sortOrder,
  onViewModeChange,
  onToggleItemSelection,
  onTogglePageSelection,
  onSortFieldChange,
  onSortOrderChange,
}: PublicationResultsListProps) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
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

  useEffect(() => {
    if (!actionMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActionMessage('');
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionMessage]);

  const currentSortLabel = useMemo(() => {
    return (
      PUBLICATIONS_SORT_FIELD_OPTIONS.find((item) => item.value === sortField)?.label ??
      'Год'
    );
  }, [sortField]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pageIds = useMemo(() => items.map((item) => item.id), [items]);
  const selectedOnPageCount = pageIds.filter((id) => selectedIdSet.has(id)).length;
  const isAllPageSelected = pageIds.length > 0 && selectedOnPageCount === pageIds.length;
  const isPageSelectionIndeterminate =
    selectedOnPageCount > 0 && selectedOnPageCount < pageIds.length;

  const handleCopyStub = () => {
    setActionMessage('Копирование будет добавлено позже.');
  };

  const handleDownloadSelected = () => {
    if (!selectedIds.length) {
      return;
    }

    downloadPublicationPdfs(selectedIds);
    setActionMessage(`Запущено скачивание PDF: ${selectedIds.length}.`);
  };

  const handleOpenPublication = (articleId: number) => {
    navigateTo(`/articles/${articleId}`);
  };

  const handleOpenPublicationByKeyboard = (
    event: KeyboardEvent<HTMLElement>,
    articleId: number,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleOpenPublication(articleId);
  };

  const renderSelectAllButton = (className = '') => (
    <button
      type="button"
      className={[styles.selectAllButton, className].filter(Boolean).join(' ')}
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
  );

  const renderSortControls = () => (
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
  );

  const renderBulkActions = () => (
    <div className={styles.bulkActions}>
      <button
        type="button"
        className={styles.bulkIconButton}
        onClick={handleCopyStub}
        disabled={!selectedIds.length}
        aria-label="Копировать выбранные публикации"
      >
        <Icon name="copy" size={20} />
      </button>

      <button
        type="button"
        className={styles.bulkIconButton}
        onClick={handleDownloadSelected}
        disabled={!selectedIds.length}
        aria-label="Скачать PDF выбранных публикаций"
      >
        <Icon name="pdf-color" size={20} colored />
      </button>
    </div>
  );

  const renderList = () => (
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
            onClick={() => handleOpenPublication(item.id)}
            onKeyDown={(event) => handleOpenPublicationByKeyboard(event, item.id)}
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
              <QuartileBadge item={item} />
            </div>

            <RowActions item={item} onCopyStub={handleCopyStub} />
          </article>
        );
      })}
    </div>
  );

  const renderTable = () => (
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
            <th>Авторы</th>
            <th>Название</th>
            <th>Издание</th>
            <th>Год</th>
            <th>DOI</th>
            <th className={styles.quartileColumn}>Q</th>
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
                onClick={() => handleOpenPublication(item.id)}
                onKeyDown={(event) => handleOpenPublicationByKeyboard(event, item.id)}
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
                  <QuartileBadge item={item} />
                </td>
                <td>
                  <RowActions item={item} onCopyStub={handleCopyStub} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className={styles.section}>
      <div className={styles.summaryRow}>
        <div className={styles.summaryGroup}>
          <span className={styles.summary}>
            Найдено: {total} {formatRecordsCountLabel(total)}
          </span>
          <span className={styles.summary}>
            Выбрано: {selectedIds.length} {formatRecordsCountLabel(selectedIds.length)}
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

      <div className={styles.controlsRow}>
        {renderSelectAllButton()}
        {renderBulkActions()}
        {viewMode === 'list' ? renderSortControls() : null}
      </div>

      {actionMessage ? (
        <div className={styles.actionMessage} role="status">
          {actionMessage}
        </div>
      ) : null}

      {isLoading ? <div className={styles.state}>Загрузка публикаций...</div> : null}

      {!isLoading && error ? <div className={styles.state}>{error}</div> : null}

      {!isLoading && !error && !items.length ? (
        <div className={styles.state}>По вашему запросу публикации не найдены.</div>
      ) : null}

      {!isLoading && !error && items.length ? (
        viewMode === 'table' ? renderTable() : renderList()
      ) : null}
    </section>
  );
}
