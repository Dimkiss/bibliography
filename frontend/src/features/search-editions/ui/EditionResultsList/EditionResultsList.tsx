import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';

import {
  buildEditionDetailsPath,
  buildNonperiodicalEditionEditPath,
  buildPeriodicalEditionEditPath,
  type EditionKind,
  type EditionListItemDto,
  type EditionSortOrder,
  type EditionsSortFieldValue,
} from '@/entities/edition';
import { navigateTo } from '@/shared/lib/navigation';
import { useAuth } from '@/features/auth';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { EditionListView } from './EditionListView';
import { EditionResultsToolbar } from './EditionResultsToolbar';
import { EditionTableView } from './EditionTableView';
import type { EditionResultsViewMode } from '../../model/editionResultsView';
import styles from './EditionResultsList.module.css';

type SortOption = {
  value: EditionsSortFieldValue;
  label: string;
};

type EditionResultsListProps = {
  kind: EditionKind;
  items: EditionListItemDto[];
  total: number;
  isLoading?: boolean;
  error?: string | null;
  selectedIds: string[];
  viewMode: EditionResultsViewMode;
  sortField: EditionsSortFieldValue;
  sortOrder: EditionSortOrder;
  sortOptions: SortOption[];
  onViewModeChange: (value: EditionResultsViewMode) => void;
  onToggleItemSelection: (id: string) => void;
  onTogglePageSelection: (ids: string[], shouldSelect: boolean) => void;
  onSortFieldChange: (value: EditionsSortFieldValue) => void;
  onSortOrderChange: (value: EditionSortOrder) => void;
};

export function EditionResultsList({
  kind,
  items,
  total,
  isLoading = false,
  error = null,
  selectedIds,
  viewMode,
  sortField,
  sortOrder,
  sortOptions,
  onViewModeChange,
  onToggleItemSelection,
  onTogglePageSelection,
  onSortFieldChange,
  onSortOrderChange,
}: EditionResultsListProps) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = Boolean(isAuthenticated && user?.role_id === ADMIN_ROLE_ID);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pageIds = useMemo(() => items.map((item) => item.id), [items]);
  const selectedOnPageCount = pageIds.filter((id) => selectedIdSet.has(id)).length;
  const isAllPageSelected = pageIds.length > 0 && selectedOnPageCount === pageIds.length;
  const isPageSelectionIndeterminate =
    selectedOnPageCount > 0 && selectedOnPageCount < pageIds.length;

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

  const handleToggleActionMenu = (id: string) => {
    setOpenActionMenuId((prev) => (prev === id ? null : id));
  };

  const handleOpenEdition = (item: EditionListItemDto) => {
    navigateTo(buildEditionDetailsPath(item.kind, item.source_id));
  };

  const handleEditEdition = (item: EditionListItemDto) => {
    setOpenActionMenuId(null);

    if (item.kind === 'nonperiodical') {
      navigateTo(buildNonperiodicalEditionEditPath(item.source_id));
      return;
    }

    navigateTo(buildPeriodicalEditionEditPath(item.source_id));
  };

  const handleDeleteEdition = (item: EditionListItemDto) => {
    setOpenActionMenuId(null);
    setActionMessage(
      item.kind === 'nonperiodical'
        ? 'Удаление непериодических изданий пока недоступно.'
        : 'Удаление периодических изданий пока недоступно.',
    );
  };

  const handleOpenEditionByKeyboard = (
    event: KeyboardEvent<HTMLElement>,
    item: EditionListItemDto,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleOpenEdition(item);
  };

  const resultView =
    viewMode === 'table' ? (
      <EditionTableView
        kind={kind}
        items={items}
        selectedIdSet={selectedIdSet}
        pageIds={pageIds}
        isAllPageSelected={isAllPageSelected}
        isPageSelectionIndeterminate={isPageSelectionIndeterminate}
        isAdmin={isAdmin}
        openActionMenuId={openActionMenuId}
        sortField={sortField}
        sortOrder={sortOrder}
        onOpenEdition={handleOpenEdition}
        onOpenEditionByKeyboard={handleOpenEditionByKeyboard}
        onToggleItemSelection={onToggleItemSelection}
        onTogglePageSelection={onTogglePageSelection}
        onToggleActionMenu={handleToggleActionMenu}
        onSortFieldChange={onSortFieldChange}
        onSortOrderChange={onSortOrderChange}
        onEdit={handleEditEdition}
        onDelete={handleDeleteEdition}
      />
    ) : (
      <EditionListView
        kind={kind}
        items={items}
        selectedIdSet={selectedIdSet}
        isAdmin={isAdmin}
        openActionMenuId={openActionMenuId}
        onOpenEdition={handleOpenEdition}
        onOpenEditionByKeyboard={handleOpenEditionByKeyboard}
        onToggleItemSelection={onToggleItemSelection}
        onToggleActionMenu={handleToggleActionMenu}
        onEdit={handleEditEdition}
        onDelete={handleDeleteEdition}
      />
    );

  return (
    <section className={styles.section}>
      <EditionResultsToolbar
        kind={kind}
        total={total}
        selectedCount={selectedIds.length}
        pageIds={pageIds}
        isAllPageSelected={isAllPageSelected}
        isPageSelectionIndeterminate={isPageSelectionIndeterminate}
        viewMode={viewMode}
        sortField={sortField}
        sortOrder={sortOrder}
        sortOptions={sortOptions}
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

      {isLoading ? <div className={styles.state}>Загрузка изданий...</div> : null}

      {!isLoading && error ? <div className={styles.state}>{error}</div> : null}

      {!isLoading && !error && !items.length ? (
        <div className={styles.state}>По вашему запросу издания не найдены.</div>
      ) : null}

      {!isLoading && !error && items.length ? resultView : null}
    </section>
  );
}
