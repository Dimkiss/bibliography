import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  getProfilePublications,
  getProfileStats,
  downloadProfileReport,
  type ProfileStatsDto,
  type ProfilePublicationsSortField,
} from '../../api/profileApi';
import {
  type PublicationListItemDto,
  type PublicationSortOrder,
  getPublicationFilters,
} from '@/entities/publication';
import { PublicationResultsList } from '@/features/search-publications/ui/PublicationResultsList/PublicationResultsList';
import { PublicationsPagination } from '@/features/search-publications/ui/PublicationsPagination/PublicationsPagination';
import {
  PublicationsFilterDropdown,
  type PublicationsFilterOption,
} from '@/features/search-publications';
import { YearRangeSelect, type YearRange } from '@/shared/ui/YearRangeSelect';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import styles from './ProfilePublicationsSection.module.css';

const DEFAULT_PAGE_SIZE = 20;
const MIN_YEAR = 1950;

type ProfilePublicationsSectionProps = {
  /** Год последней публикации или текущий год — верхняя граница фильтра */
  maxYear: number;
};

export function ProfilePublicationsSection({ maxYear }: ProfilePublicationsSectionProps) {
  const currentYear = useMemo(() => maxYear || new Date().getFullYear(), [maxYear]);

  // Фильтр по годам
  const [yearRange, setYearRange] = useState<YearRange>({
    from: MIN_YEAR,
    to: currentYear,
  });
  const isAllYears = yearRange.from === MIN_YEAR && yearRange.to === currentYear;
  const activeYearFrom = isAllYears ? null : yearRange.from;
  const activeYearTo = isAllYears ? null : yearRange.to;

  // Список публикаций
  const [items, setItems] = useState<PublicationListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Статистика
  const [stats, setStats] = useState<ProfileStatsDto | null>(null);

  // Выделение
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Вид / сортировка
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list');
  const [sortField, setSortField] = useState<ProfilePublicationsSortField>('year');
  const [sortOrder, setSortOrder] = useState<PublicationSortOrder>('desc');

  // Скачивание отчёта
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Поиск и дополнительные фильтры
  const [publicationSearchDraft, setPublicationSearchDraft] = useState('');
  const [publicationSearchQuery, setPublicationSearchQuery] = useState('');
  const [publicationTypes, setPublicationTypes] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [originalTranslationMode, setOriginalTranslationMode] = useState('all');
  const [publicationTypeOptions, setPublicationTypeOptions] = useState<
    PublicationsFilterOption[]
  >([]);
  const [databaseOptions, setDatabaseOptions] = useState<PublicationsFilterOption[]>([]);
  const [originalTranslationOptions, setOriginalTranslationOptions] = useState<
    PublicationsFilterOption[]
  >([]);

  // ─── Загрузка данных ────────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    async function loadFilters() {
      try {
        const data = await getPublicationFilters();
        if (!isMounted) {
          return;
        }

        setPublicationTypeOptions(data.publication_types);
        setDatabaseOptions(data.databases);
        setOriginalTranslationOptions(data.original_translation_modes);
      } catch {
        if (isMounted) {
          setPublicationTypeOptions([]);
          setDatabaseOptions([]);
          setOriginalTranslationOptions([]);
        }
      }
    }

    void loadFilters();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadPublications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProfilePublications({
        page,
        pageSize,
        yearFrom: activeYearFrom,
        yearTo: activeYearTo,
        textQuery: publicationSearchQuery,
        publicationTypes,
        databases,
        originalTranslationMode,
        sortBy: sortField,
        sortOrder,
      });
      setItems(result.items as PublicationListItemDto[]);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.total_pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки публикаций');
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    pageSize,
    activeYearFrom,
    activeYearTo,
    publicationSearchQuery,
    publicationTypes,
    databases,
    originalTranslationMode,
    sortField,
    sortOrder,
  ]);

  const loadStats = useCallback(async () => {
    try {
      const result = await getProfileStats(
        activeYearFrom,
        activeYearTo,
        publicationSearchQuery,
        publicationTypes,
        databases,
        originalTranslationMode,
      );
      setStats(result);
    } catch {
      // статистика не критична
    }
  }, [
    activeYearFrom,
    activeYearTo,
    publicationSearchQuery,
    publicationTypes,
    databases,
    originalTranslationMode,
  ]);

  useEffect(() => {
    void loadPublications();
  }, [loadPublications]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // При смене фильтров — сбрасываем на первую страницу
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [
    activeYearFrom,
    activeYearTo,
    publicationSearchQuery,
    publicationTypes,
    databases,
    originalTranslationMode,
    sortField,
    sortOrder,
    pageSize,
  ]);

  // ─── Обработчики ────────────────────────────────────────────────────────────

  const handleYearRangeChange = useCallback((range: YearRange) => {
    setYearRange(range);
  }, []);

  const handleApplyPublicationSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPublicationSearchQuery(publicationSearchDraft.trim());
    },
    [publicationSearchDraft],
  );

  const handleResetPublicationSearch = useCallback(() => {
    setPublicationSearchDraft('');
    setPublicationSearchQuery('');
  }, []);

  const handleResetFilters = useCallback(() => {
    setYearRange({ from: MIN_YEAR, to: currentYear });
    setPublicationSearchDraft('');
    setPublicationSearchQuery('');
    setPublicationTypes([]);
    setDatabases([]);
    setOriginalTranslationMode('all');
  }, [currentYear]);

  const handleToggleItemSelection = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleTogglePageSelection = useCallback(
    (ids: number[], shouldSelect: boolean) => {
      setSelectedIds((prev) => {
        const set = new Set(prev);
        ids.forEach((id) => (shouldSelect ? set.add(id) : set.delete(id)));
        return Array.from(set);
      });
    },
    [],
  );

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadProfileReport(activeYearFrom, activeYearTo);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Не удалось сформировать отчёт.');
    } finally {
      setIsDownloading(false);
    }
  }, [activeYearFrom, activeYearTo]);

  const handleDownloadSelected = useCallback(
    async (ids: number[]) => {
      await downloadProfileReport(null, null, ids);
    },
    [],
  );

  // ─── Рендер ─────────────────────────────────────────────────────────────────

  const statItems = stats
    ? [
        { label: 'Всего публикаций', value: stats.total },
        { label: 'Web of Science', value: stats.wos_count },
        { label: 'Scopus', value: stats.scopus_count },
        { label: 'Белый список', value: stats.white_list_count },
        { label: 'ВАК', value: stats.vak_count },
        {
          label: 'Суммарный ИФ',
          value: stats.if_total > 0 ? stats.if_total.toFixed(3) : '—',
        },
      ]
    : [];
  const hasActiveFilters =
    !isAllYears ||
    Boolean(publicationSearchQuery) ||
    publicationTypes.length > 0 ||
    databases.length > 0 ||
    originalTranslationMode !== 'all';

  return (
    <section className={styles.section}>
      {/* Заголовок секции */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Мои публикации</h2>
        <OutlineButton
          label={isDownloading ? 'Формирование...' : 'Скачать отчёт (.xlsx)'}
          iconName="download"
          disabled={isDownloading || total === 0}
          onClick={() => {
            void handleDownload();
          }}
        />
      </div>

      {downloadError ? <div className={styles.errorBanner}>{downloadError}</div> : null}

      {/* Статистика */}
      {stats ? (
        <div className={styles.statsRow}>
          {statItems.map((item) => (
            <div key={item.label} className={styles.statCard}>
              <span className={styles.statValue}>{item.value}</span>
              <span className={styles.statLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Фильтр по годам */}
      <div className={styles.filtersRow}>
        <span className={styles.filterLabel}>Годы:</span>
        <YearRangeSelect
          from={yearRange.from}
          to={yearRange.to}
          minYear={MIN_YEAR}
          maxYear={currentYear}
          onChange={handleYearRangeChange}
          ariaLabel="Диапазон годов публикаций"
          showQuickActions
        />
        <PublicationsFilterDropdown
          label="Тип публикации"
          mode="multi"
          options={publicationTypeOptions}
          value={publicationTypes}
          onChange={setPublicationTypes}
        />
        <PublicationsFilterDropdown
          label="Оригинал/Перевод"
          mode="single"
          options={originalTranslationOptions}
          value={originalTranslationMode}
          onChange={setOriginalTranslationMode}
        />
        <PublicationsFilterDropdown
          label="Базы данных"
          mode="multi"
          options={databaseOptions}
          value={databases}
          onChange={setDatabases}
        />
        {hasActiveFilters ? (
          <OutlineButton
            label="Сбросить фильтры"
            iconName="close"
            onClick={handleResetFilters}
          />
        ) : null}
      </div>

      <form className={styles.searchRow} onSubmit={handleApplyPublicationSearch}>
        <label className={styles.searchLabel} htmlFor="profile-publications-search">
          Поиск по моим публикациям
        </label>
        <input
          id="profile-publications-search"
          className={styles.searchInput}
          type="search"
          value={publicationSearchDraft}
          onChange={(event) => setPublicationSearchDraft(event.target.value)}
          placeholder="Название, авторы, журнал, DOI или ключевые слова"
        />
        <OutlineButton label="Найти" iconName="search" type="submit" />
        {publicationSearchQuery ? (
          <OutlineButton
            label="Сбросить"
            iconName="close"
            onClick={handleResetPublicationSearch}
          />
        ) : null}
      </form>

      {/* Список публикаций */}
      <PublicationResultsList
        items={items}
        total={total}
        startIndex={(page - 1) * pageSize}
        isLoading={isLoading}
        error={error}
        selectedIds={selectedIds}
        viewMode={viewMode}
        sortField={sortField}
        sortOrder={sortOrder}
        onViewModeChange={setViewMode}
        onToggleItemSelection={handleToggleItemSelection}
        onTogglePageSelection={handleTogglePageSelection}
        onSortFieldChange={(value) => setSortField(value as ProfilePublicationsSortField)}
        onSortOrderChange={setSortOrder}
        onDownloadReport={handleDownloadSelected}
      />

      {/* Пагинация */}
      {totalPages > 1 || items.length > 0 ? (
        <PublicationsPagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          pageSizeOptions={[10, 20, 50]}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}
    </section>
  );
}
