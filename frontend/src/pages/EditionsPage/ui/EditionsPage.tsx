import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import { buildPeriodicalEditionCreatePath } from '@/entities/edition';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { useAuth } from '@/features/auth';
import {
  EditionResultsList,
  EditionSearchPanel,
  EditionsPagination,
  useEditionsSearchPageState,
} from '@/features/search-editions';
import { navigateTo } from '@/shared/lib/navigation';
import { Button } from '@/shared/ui/Button';
import styles from './EditionsPage.module.css';

export function EditionsPage() {
  const { user, isAuthenticated } = useAuth();
  const search = useEditionsSearchPageState();
  const canCreateEdition = Boolean(isAuthenticated && user?.role_id === ADMIN_ROLE_ID);
  const createButtonLabel =
    search.kind === 'periodical'
      ? 'Добавить периодическое издание'
      : 'Добавить непериодическое издание';
  const createPath =
    search.kind === 'periodical'
      ? buildPeriodicalEditionCreatePath()
      : '/articles/create?scenario=book-monograph';

  return (
    <div className="app-page">
      <Header title="Поиск изданий" />

      <main className="app-main">
        <div className="container app-block-group">
          {canCreateEdition ? (
            <div className={styles.actionsRow}>
              <Button
                label={createButtonLabel}
                iconName="add"
                size="normal"
                onClick={() => navigateTo(createPath)}
              />
            </div>
          ) : null}

          <div className={styles.content}>
            <EditionSearchPanel
              kind={search.kind}
              value={search.form}
              yearMin={search.filters.year_min}
              yearMax={search.filters.year_max}
              metricLevels={search.filters.metric_levels}
              editionTypes={search.filters.edition_types}
              isLoading={search.isFiltersLoading || search.isResultsLoading}
              onKindChange={search.handleKindChange}
              onQueryChange={search.handleQueryChange}
              onYearRangeChange={search.handleYearRangeChange}
              onMetricLevelsChange={search.handleMetricLevelsChange}
              onEditionTypesChange={search.handleEditionTypesChange}
              onSubmit={search.handleSearch}
            />

            {search.hasSearched ? (
              <div className={`app-surface ${styles.resultsBlock}`}>
                <EditionResultsList
                  kind={search.kind}
                  items={search.items}
                  total={search.pagination.total}
                  isLoading={search.isResultsLoading}
                  error={search.error}
                  selectedIds={search.selectedEditionIds}
                  viewMode={search.viewMode}
                  sortField={search.sortField}
                  sortOrder={search.sortOrder}
                  sortOptions={search.sortOptions}
                  onViewModeChange={search.setViewMode}
                  onToggleItemSelection={search.handleToggleItemSelection}
                  onTogglePageSelection={search.handleTogglePageSelection}
                  onSortFieldChange={search.handleSortFieldChange}
                  onSortOrderChange={search.handleSortOrderChange}
                />

                <EditionsPagination
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
                  Введите название, ISSN для периодических изданий, ISBN для
                  непериодических или выберите фильтры, чтобы увидеть подходящие
                  издания.
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
