import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import {
  EditionResultsList,
  EditionSearchPanel,
  EditionsPagination,
  useEditionsSearchPageState,
} from '@/features/search-editions';
import styles from './EditionsPage.module.css';

export function EditionsPage() {
  const search = useEditionsSearchPageState();

  return (
    <div className="app-page">
      <Header title="Поиск изданий" />

      <main className="app-main">
        <div className="container app-block-group">
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
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
