import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';

import {
  buildDoiUrl,
  deleteAdminArticle,
  getBibliographicReference,
  type PublicationListItemDto,
  type PublicationSortOrder,
  type PublicationsSortFieldValue,
} from '@/entities/publication';
import { navigateTo } from '@/shared/lib/navigation';
import { useAuth } from '@/features/auth';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { PublicationSelectionActionsPanel } from '../PublicationSelectionActionsPanel';
import { DeletePublicationDialog } from './DeletePublicationDialog';
import { PublicationListView } from './PublicationListView';
import { PublicationResultsToolbar } from './PublicationResultsToolbar';
import { PublicationTableView } from './PublicationTableView';
import type { PublicationResultsViewMode } from './PublicationResultsList.types';
import { openPublicationPdf } from './publicationResultsList.lib';
import styles from './PublicationResultsList.module.css';

export type { PublicationResultsViewMode } from './PublicationResultsList.types';

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
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [publicationToDelete, setPublicationToDelete] =
    useState<PublicationListItemDto | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    const handleClickOutside = () => {
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

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIdSet.has(item.id)),
    [items, selectedIdSet],
  );
  const pageIds = useMemo(() => items.map((item) => item.id), [items]);
  const selectedOnPageCount = pageIds.filter((id) => selectedIdSet.has(id)).length;
  const isAllPageSelected = pageIds.length > 0 && selectedOnPageCount === pageIds.length;
  const isPageSelectionIndeterminate =
    selectedOnPageCount > 0 && selectedOnPageCount < pageIds.length;

  const handleToggleActionMenu = (id: number) => {
    setOpenActionMenuId((prev) => (prev === id ? null : id));
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
    const reference = getBibliographicReference(item);
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

  const resultView =
    viewMode === 'table' ? (
      <PublicationTableView
        items={items}
        startIndex={startIndex}
        selectedIdSet={selectedIdSet}
        pageIds={pageIds}
        isAllPageSelected={isAllPageSelected}
        isPageSelectionIndeterminate={isPageSelectionIndeterminate}
        isAdmin={isAdmin}
        openActionMenuId={openActionMenuId}
        sortField={sortField}
        sortOrder={sortOrder}
        onOpenPublication={handleOpenPublication}
        onOpenPublicationByKeyboard={handleOpenPublicationByKeyboard}
        onToggleItemSelection={onToggleItemSelection}
        onTogglePageSelection={onTogglePageSelection}
        onToggleActionMenu={handleToggleActionMenu}
        onSortFieldChange={onSortFieldChange}
        onSortOrderChange={onSortOrderChange}
        onOpenPdf={handleOpenPdf}
        onOpenDoi={handleOpenDoi}
        onCopyReference={(item) => {
          void handleCopyReference(item);
        }}
        onEdit={handleEditPublication}
        onRequestDelete={handleRequestDeletePublication}
      />
    ) : (
      <PublicationListView
        items={items}
        startIndex={startIndex}
        selectedIdSet={selectedIdSet}
        isAdmin={isAdmin}
        openActionMenuId={openActionMenuId}
        onOpenPublication={handleOpenPublication}
        onOpenPublicationByKeyboard={handleOpenPublicationByKeyboard}
        onToggleItemSelection={onToggleItemSelection}
        onToggleActionMenu={handleToggleActionMenu}
        onOpenPdf={handleOpenPdf}
        onOpenDoi={handleOpenDoi}
        onCopyReference={(item) => {
          void handleCopyReference(item);
        }}
        onEdit={handleEditPublication}
        onRequestDelete={handleRequestDeletePublication}
      />
    );

  return (
    <section className={styles.section}>
      <PublicationResultsToolbar
        total={total}
        selectedCount={selectedIds.length}
        pageIds={pageIds}
        isAllPageSelected={isAllPageSelected}
        isPageSelectionIndeterminate={isPageSelectionIndeterminate}
        viewMode={viewMode}
        sortField={sortField}
        sortOrder={sortOrder}
        onViewModeChange={onViewModeChange}
        onTogglePageSelection={onTogglePageSelection}
        onSortFieldChange={onSortFieldChange}
        onSortOrderChange={onSortOrderChange}
      />

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

      {!isLoading && !error && items.length ? resultView : null}

      <PublicationSelectionActionsPanel
        selectedItems={selectedItems}
        onActionStart={() => setOpenActionMenuId(null)}
        onActionMessage={setActionMessage}
      />

      {publicationToDelete ? (
        <DeletePublicationDialog
          item={publicationToDelete}
          onCancel={() => setPublicationToDelete(null)}
          onConfirm={() => {
            void handleConfirmDeletePublication();
          }}
        />
      ) : null}
    </section>
  );
}
