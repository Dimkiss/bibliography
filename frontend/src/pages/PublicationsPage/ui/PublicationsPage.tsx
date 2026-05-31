import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import {
  PublicationAiSearchChat,
  PublicationResultsList,
  PublicationSearchPanel,
  PublicationsPagination,
  usePublicationsSearchPageState,
} from '@/features/search-publications';
import { Button } from '@/shared/ui/Button';
import { navigateTo } from '@/shared/lib/navigation';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { useAuth } from '@/features/auth';
import styles from './PublicationsPage.module.css';

export function PublicationsPage() {
  const { user, isAuthenticated } = useAuth();
  const search = usePublicationsSearchPageState();

  const canCreatePublication = Boolean(
    isAuthenticated && user?.role_id === ADMIN_ROLE_ID,
  );

  return (
    <div className="app-page">
      <Header title="Поиск публикаций" />

      <main className="app-main">
        <div className="container app-block-group">
          {canCreatePublication ? (
            <div className={styles.actionsRow}>
              <Button
                label="Добавить публикацию"
                iconName="add"
                size="normal"
                onClick={() => navigateTo('/articles/create')}
              />
            </div>
          ) : null}
          <div className={styles.content}>
            <PublicationSearchPanel
              value={search.form}
              activeFields={search.activeFields}
              yearMin={search.filters.year_min}
              yearMax={search.filters.year_max}
              publicationTypes={search.filters.publication_types}
              databases={search.filters.databases}
              originalTranslationModes={search.filters.original_translation_modes}
              isLoading={search.isFiltersLoading || search.isResultsLoading}
              onFieldChange={search.handleFieldChange}
              onYearRangeChange={search.handleYearRangeChange}
              onPublicationTypesChange={search.handlePublicationTypesChange}
              onDatabasesChange={search.handleDatabasesChange}
              onOriginalTranslationModeChange={
                search.handleOriginalTranslationModeChange
              }
              onActiveFieldsChange={search.handleActiveFieldsChange}
              onSubmit={search.handleSearch}
              onReset={search.handleReset}
            />

            {isAuthenticated ? (
              <PublicationAiSearchChat
                isPlanning={search.isAiPlanning}
                resetRevision={search.aiResetRevision}
                items={search.items}
                onSubmit={search.handleAiSearch}
                onReset={search.handleReset}
              />
            ) : null}

            {search.hasSearched ? (
              <div className={`app-surface ${styles.resultsBlock}`}>
                <PublicationResultsList
                  items={search.items}
                  total={search.pagination.total}
                  hasTextQuery={Boolean(
                    search.appliedForm.textQuery.trim(),
                  )}
                  startIndex={
                    (search.pagination.page - 1) * search.pagination.page_size
                  }
                  isLoading={search.isResultsLoading}
                  error={search.error}
                  selectedIds={search.selectedPublicationIds}
                  viewMode={search.viewMode}
                  sortField={search.sortField}
                  sortOrder={search.sortOrder}
                  onViewModeChange={search.setViewMode}
                  onToggleItemSelection={search.handleToggleItemSelection}
                  onTogglePageSelection={search.handleTogglePageSelection}
                  onSortFieldChange={search.handleSortFieldChange}
                  onSortOrderChange={search.handleSortOrderChange}
                  onPublicationDeleted={search.handlePublicationDeleted}
                />

                <PublicationsPagination
                  page={search.pagination.page}
                  pageSize={search.pagination.page_size}
                  totalPages={search.pagination.total_pages}
                  total={search.pagination.total}
                  onPageChange={search.handlePageChange}
                  onPageSizeChange={search.handlePageSizeChange}
                />
              </div>
            ) : (
              <div className={styles.emptySearchState}>
                <h2 className={styles.emptySearchTitle}>Задайте параметры поиска</h2>
                <p className={styles.emptySearchText}>
                  Введите автора, название, ключевые слова или выберите фильтры, чтобы
                  увидеть подходящие публикации.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
