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
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import {
  QuartilesDropdown,
  type QuartilesDropdownItem,
} from '@/shared/ui/QuartilesDropdown';
import {
  PUBLICATIONS_SORT_FIELD_OPTIONS,
  type PublicationsSortFieldValue,
} from '@/entities/publication';
import { navigateTo } from '@/shared/lib/navigation';
import { deleteAdminArticle } from '@/features/create-publication';
import { useAuth } from '@/features/auth';
import { ADMIN_ROLE_ID } from '@/entities/role';
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
  onPublicationDeleted?: (id: number) => void;
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

function openPublicationPdf(articleId: number) {
  window.open(getPublicationPdfUrl(articleId), '_blank', 'noopener,noreferrer');
}

function openPublicationPdfs(articleIds: number[]) {
  articleIds.forEach((articleId, index) => {
    if (index === 0) {
      openPublicationPdf(articleId);
      return;
    }

    window.setTimeout(() => {
      openPublicationPdf(articleId);
    }, index * 120);
  });
}

function buildBibliographicReference(item: PublicationListItemDto): string {
  const parts = [
    item.authors,
    item.title,
    normalizeJournalName(item.journal),
    item.year ? String(item.year) : null,
    item.doi ? `DOI: ${item.doi}` : null,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);

  return parts.join('. ');
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
  isAdmin,
  isMenuOpen,
  onToggleMenu,
  onOpenPdf,
  onOpenDoi,
  onCopyReference,
  onEdit,
  onDelete,
}: {
  item: PublicationListItemDto;
  isAdmin: boolean;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onOpenPdf: () => void;
  onOpenDoi: () => void;
  onCopyReference: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasDoiUrl = Boolean(buildDoiUrl(item.doi));

  return (
    <div
      className={styles.rowActions}
      onClick={stopInteractiveEvent}
      onMouseDown={stopInteractiveEvent}
    >
      <OutlineIconButton
        iconName="more_horiz"
        iconSize={20}
        size="small-x"
        aria-label="Дополнительные действия"
        aria-expanded={isMenuOpen}
        onClick={(event) => {
          stopInteractiveEvent(event);
          onToggleMenu();
        }}
      />

      {isMenuOpen ? (
        <div className={styles.publicationMenu} role="menu">
          <button
            type="button"
            className={styles.publicationMenuItem}
            onClick={onOpenPdf}
            disabled={!item.has_pdf}
            role="menuitem"
          >
            <Icon
              name={item.has_pdf ? 'pdf-color' : 'pdf-mono'}
              size={24}
              colored={item.has_pdf}
            />
            <span>Открыть PDF</span>
          </button>

          <button
            type="button"
            className={styles.publicationMenuItem}
            onClick={onOpenDoi}
            disabled={!hasDoiUrl}
            role="menuitem"
          >
            <Icon name="doi" size={24} />
            <span>Открыть по DOI</span>
          </button>

          <button
            type="button"
            className={styles.publicationMenuItem}
            onClick={onCopyReference}
            role="menuitem"
          >
            <Icon name="copy" size={24} />
            <span>Копировать библ. ссылку</span>
          </button>

          {isAdmin ? (
            <>
              <div className={styles.publicationMenuDivider} />

              <button
                type="button"
                className={styles.publicationMenuItem}
                onClick={onEdit}
                role="menuitem"
              >
                <Icon name="edit" size={24} />
                <span>Редактировать</span>
              </button>

              <button
                type="button"
                className={styles.publicationMenuItem}
                onClick={onDelete}
                role="menuitem"
              >
                <Icon name="delete" size={24} />
                <span>Удалить</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <OutlineIconButton
        iconName="copy"
        iconSize={20}
        size="small-x"
        aria-label="Копировать данные публикации"
        onClick={(event) => {
          stopInteractiveEvent(event);
          onCopyReference();
        }}
      />

      <OutlineIconButton
        iconName={item.has_pdf ? 'pdf-color' : 'pdf-mono'}
        iconSize={20}
        iconColored={item.has_pdf}
        size="small-x"
        disabled={!item.has_pdf}
        aria-label="Скачать PDF"
        onClick={(event) => {
          stopInteractiveEvent(event);
          if (!item.has_pdf) {
            return;
          }
          onOpenPdf();
        }}
      />
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
  onPublicationDeleted,
}: PublicationResultsListProps) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = Boolean(isAuthenticated && user?.role_id === ADMIN_ROLE_ID);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [publicationToDelete, setPublicationToDelete] =
    useState<PublicationListItemDto | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (!sortRef.current) {
        setOpenActionMenuId(null);
        return;
      }

      if (!sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }

      setOpenActionMenuId(null);
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
  const selectedPdfIds = useMemo(
    () =>
      items
        .filter((item) => selectedIdSet.has(item.id) && item.has_pdf)
        .map((item) => item.id),
    [items, selectedIdSet],
  );
  const selectedOnPageCount = pageIds.filter((id) => selectedIdSet.has(id)).length;
  const isAllPageSelected = pageIds.length > 0 && selectedOnPageCount === pageIds.length;
  const isPageSelectionIndeterminate =
    selectedOnPageCount > 0 && selectedOnPageCount < pageIds.length;

  const handleCopyStub = () => {
    const selectedReferences = items
      .filter((item) => selectedIdSet.has(item.id))
      .map(buildBibliographicReference)
      .filter(Boolean);

    if (!selectedReferences.length) {
      return;
    }

    void navigator.clipboard.writeText(selectedReferences.join('\n'));
    setActionMessage(`Скопировано библиографических ссылок: ${selectedReferences.length}.`);
  };

  const handleDownloadSelected = () => {
    if (!selectedPdfIds.length) {
      return;
    }

    openPublicationPdfs(selectedPdfIds);
    setActionMessage(`Открыто PDF: ${selectedPdfIds.length}.`);
  };

  const handleOpenPdf = (item: PublicationListItemDto) => {
    if (!item.has_pdf) {
      return;
    }

    setOpenActionMenuId(null);
    openPublicationPdf(item.id);
  };

  const handleOpenDoi = (item: PublicationListItemDto) => {
    const doiUrl = buildDoiUrl(item.doi);
    if (!doiUrl) {
      return;
    }

    setOpenActionMenuId(null);
    window.open(doiUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyReference = async (item: PublicationListItemDto) => {
    const reference = buildBibliographicReference(item);
    if (!reference) {
      return;
    }

    await navigator.clipboard.writeText(reference);
    setOpenActionMenuId(null);
    setActionMessage('Библиографическая ссылка скопирована.');
  };

  const handleEditPublication = () => {
    setOpenActionMenuId(null);
    setActionMessage('Редактирование будет доступно после обновления формы публикации.');
  };

  const handleRequestDeletePublication = (item: PublicationListItemDto) => {
    setOpenActionMenuId(null);
    setPublicationToDelete(item);
  };

  const handleConfirmDeletePublication = async () => {
    if (!publicationToDelete) {
      return;
    }

    const item = publicationToDelete;

    try {
      await deleteAdminArticle(item.id);
      onPublicationDeleted?.(item.id);
      setPublicationToDelete(null);
      setActionMessage('Публикация удалена.');
    } catch (caughtError) {
      setActionMessage(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось удалить публикацию.',
      );
    }
  };

  const handleTableSort = (field: PublicationsSortFieldValue) => {
    if (field === sortField) {
      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }

    onSortFieldChange(field);
    onSortOrderChange('desc');
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
  );

  const renderBulkActions = () => (
    <div className={styles.bulkActions}>
      <OutlineIconButton
        iconName="copy"
        iconSize={20}
        size="small-x"
        onClick={handleCopyStub}
        disabled={!selectedIds.length}
        aria-label="Копировать выбранные публикации"
      />

      <OutlineIconButton
        iconName={selectedPdfIds.length ? 'pdf-color' : 'pdf-mono'}
        iconSize={20}
        iconColored={selectedPdfIds.length > 0}
        size="small-x"
        onClick={handleDownloadSelected}
        disabled={!selectedPdfIds.length}
        aria-label="Скачать PDF выбранных публикаций"
      />
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

            <RowActions
              item={item}
              isAdmin={isAdmin}
              isMenuOpen={openActionMenuId === item.id}
              onToggleMenu={() =>
                setOpenActionMenuId((prev) => (prev === item.id ? null : item.id))
              }
              onOpenPdf={() => handleOpenPdf(item)}
              onOpenDoi={() => handleOpenDoi(item)}
              onCopyReference={() => {
                void handleCopyReference(item);
              }}
              onEdit={handleEditPublication}
              onDelete={() => {
                handleRequestDeletePublication(item);
              }}
            />
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
                  <RowActions
                    item={item}
                    isAdmin={isAdmin}
                    isMenuOpen={openActionMenuId === item.id}
                    onToggleMenu={() =>
                      setOpenActionMenuId((prev) => (prev === item.id ? null : item.id))
                    }
                    onOpenPdf={() => handleOpenPdf(item)}
                    onOpenDoi={() => handleOpenDoi(item)}
                    onCopyReference={() => {
                      void handleCopyReference(item);
                    }}
                    onEdit={handleEditPublication}
                    onDelete={() => {
                      handleRequestDeletePublication(item);
                    }}
                  />
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

      {publicationToDelete ? (
        <div
          className={styles.confirmOverlay}
          role="presentation"
          onMouseDown={() => setPublicationToDelete(null)}
        >
          <div
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-publication-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="delete-publication-title" className={styles.confirmTitle}>
              Удалить публикацию?
            </h2>
            <p className={styles.confirmText}>
              Вы точно хотите удалить публикацию «
              {publicationToDelete.title || `#${publicationToDelete.id}`}»? Это действие нельзя
              отменить.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={() => setPublicationToDelete(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={() => {
                  void handleConfirmDeletePublication();
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
