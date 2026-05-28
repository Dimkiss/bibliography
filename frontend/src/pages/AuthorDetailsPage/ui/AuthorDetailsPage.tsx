import { useCallback, useEffect, useMemo, useState } from 'react';

import styles from './AuthorDetailsPage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';
import { useAuth } from '@/features/auth';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { navigateTo } from '@/shared/lib/navigation';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { YearRangeSelect, type YearRange } from '@/shared/ui/YearRangeSelect';
import {
  getAdminAuthorFull,
  getAdminAuthorPublications,
  getAdminAuthorStats,
  downloadAdminAuthorPublicationsReport,
  type AuthorFullDto,
  type AuthorPublicationsSortField,
  type AuthorStatsDto,
} from '@/features/manage-authors';
import {
  type PublicationListItemDto,
  type PublicationSortOrder,
} from '@/entities/publication';
import { PublicationResultsList } from '@/features/search-publications/ui/PublicationResultsList/PublicationResultsList';
import { PublicationsPagination } from '@/features/search-publications/ui/PublicationsPagination/PublicationsPagination';

const DEFAULT_PAGE_SIZE = 20;
const MIN_YEAR = 1950;
const CURRENT_YEAR = new Date().getFullYear();

function getAuthorIdFromPathname(pathname: string): number | null {
  const match = pathname.match(/^\/authors\/(\d+)$/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || value === '') {
    return '—';
  }

  return String(value);
}

export function AuthorDetailsPage() {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const authorId = useMemo(
    () => getAuthorIdFromPathname(window.location.pathname),
    [],
  );

  const [author, setAuthor] = useState<AuthorFullDto | null>(null);
  const [isAuthorLoading, setIsAuthorLoading] = useState(true);
  const [authorError, setAuthorError] = useState<string | null>(null);

  const [yearRange, setYearRange] = useState<YearRange>({
    from: MIN_YEAR,
    to: CURRENT_YEAR,
  });
  const isAllYears = yearRange.from === MIN_YEAR && yearRange.to === CURRENT_YEAR;
  const activeYearFrom = isAllYears ? null : yearRange.from;
  const activeYearTo = isAllYears ? null : yearRange.to;

  const [items, setItems] = useState<PublicationListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isPublicationsLoading, setIsPublicationsLoading] = useState(false);
  const [publicationsError, setPublicationsError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'table'>('table');
  const [sortField, setSortField] = useState<AuthorPublicationsSortField>('year');
  const [sortOrder, setSortOrder] = useState<PublicationSortOrder>('desc');
  const [stats, setStats] = useState<AuthorStatsDto | null>(null);
  const [isReportDownloading, setIsReportDownloading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const isAdmin = isAuthenticated && user?.role_id === ADMIN_ROLE_ID;

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigateTo('/login');
      return;
    }

    if (!isInitializing && isAuthenticated && !isAdmin) {
      navigateTo('/');
    }
  }, [isAuthenticated, isInitializing, isAdmin]);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthor() {
      if (authorId === null) {
        setAuthorError('Некорректный идентификатор автора.');
        setIsAuthorLoading(false);
        return;
      }

      try {
        setIsAuthorLoading(true);
        setAuthorError(null);

        const data = await getAdminAuthorFull(authorId);

        if (!isMounted) {
          return;
        }

        setAuthor(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAuthorError(
          error instanceof Error ? error.message : 'Не удалось загрузить автора.',
        );
      } finally {
        if (isMounted) {
          setIsAuthorLoading(false);
        }
      }
    }

    if (!isInitializing && isAuthenticated && isAdmin) {
      void loadAuthor();
    }

    return () => {
      isMounted = false;
    };
  }, [authorId, isAuthenticated, isAdmin, isInitializing]);

  const loadPublications = useCallback(async () => {
    if (authorId === null || !isAdmin) {
      return;
    }

    setIsPublicationsLoading(true);
    setPublicationsError(null);

    try {
      const result = await getAdminAuthorPublications(authorId, {
        page,
        pageSize,
        yearFrom: activeYearFrom,
        yearTo: activeYearTo,
        sortBy: sortField,
        sortOrder,
      });

      setItems(result.items as PublicationListItemDto[]);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.total_pages);
    } catch (error) {
      setPublicationsError(
        error instanceof Error ? error.message : 'Не удалось загрузить публикации.',
      );
    } finally {
      setIsPublicationsLoading(false);
    }
  }, [
    activeYearFrom,
    activeYearTo,
    authorId,
    isAdmin,
    page,
    pageSize,
    sortField,
    sortOrder,
  ]);

  const loadStats = useCallback(async () => {
    if (authorId === null || !isAdmin) {
      return;
    }

    try {
      const result = await getAdminAuthorStats(
        authorId,
        activeYearFrom,
        activeYearTo,
      );
      setStats(result);
    } catch {
      setStats(null);
    }
  }, [activeYearFrom, activeYearTo, authorId, isAdmin]);

  useEffect(() => {
    void loadPublications();
  }, [loadPublications]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [activeYearFrom, activeYearTo, sortField, sortOrder, pageSize]);

  const handleToggleItemSelection = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleTogglePageSelection = useCallback(
    (ids: number[], shouldSelect: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => (shouldSelect ? next.add(id) : next.delete(id)));
        return Array.from(next);
      });
    },
    [],
  );

  const handleDownloadReport = useCallback(async () => {
    if (authorId === null) {
      return;
    }

    setIsReportDownloading(true);
    setReportError(null);

    try {
      await downloadAdminAuthorPublicationsReport(
        authorId,
        activeYearFrom,
        activeYearTo,
      );
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : 'Не удалось сформировать отчёт.',
      );
    } finally {
      setIsReportDownloading(false);
    }
  }, [activeYearFrom, activeYearTo, authorId]);

  const handleDownloadSelectedReport = useCallback(
    async (ids: number[]) => {
      if (authorId === null) {
        return;
      }

      await downloadAdminAuthorPublicationsReport(authorId, null, null, ids);
    },
    [authorId],
  );

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

  if (isInitializing || !isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="app-page">
      <Header title="Информация об авторе" />

      <main className="app-main">
        <div className="container app-block-group">
          <section className={`app-surface ${styles.authorBlock}`}>
            {isAuthorLoading ? (
              <div className={styles.state}>Загрузка автора...</div>
            ) : null}

            {!isAuthorLoading && authorError ? (
              <div className={styles.state}>{authorError}</div>
            ) : null}

            {!isAuthorLoading && !authorError && author ? (
              <>
                <div className={styles.authorHeader}>
                  <div>
                    <h1 className={styles.name}>{author.name}</h1>
                    <div className={styles.metaRow}>
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>ID</span>
                        <span className={styles.metaChipSep}>·</span>
                        <span className={styles.metaChipValue}>{author.id}</span>
                      </span>
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Подразделение</span>
                        <span className={styles.metaChipSep}>·</span>
                        <span className={styles.metaChipValue}>
                          {formatValue(author.department_name)}
                        </span>
                      </span>
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Пользователь</span>
                        <span className={styles.metaChipSep}>·</span>
                        <span className={styles.metaChipValue}>
                          {formatValue(author.linked_user_login)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <OutlineButton
                    label="Назад"
                    iconName="arrow_back"
                    size="small"
                    onClick={() => navigateTo('/author-management')}
                  />
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Должность</span>
                    <span className={styles.infoValue}>{formatValue(author.position)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Учёная степень</span>
                    <span className={styles.infoValue}>{formatValue(author.degree)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Звание</span>
                    <span className={styles.infoValue}>{formatValue(author.rank)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Email</span>
                    <span className={styles.infoValue}>{formatValue(author.email)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>ORCID</span>
                    <span className={styles.infoValue}>{formatValue(author.orcid)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Scopus ID</span>
                    <span className={styles.infoValue}>{formatValue(author.scopus_id)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>WOS ID</span>
                    <span className={styles.infoValue}>{formatValue(author.wos_id)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Код подразделения</span>
                    <span className={styles.infoValue}>
                      {formatValue(author.department_id)}
                    </span>
                  </div>
                </div>
              </>
            ) : null}
          </section>

          <section className={`app-surface ${styles.publicationsBlock}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Публикации автора</h2>
              <OutlineButton
                label={isReportDownloading ? 'Формирование...' : 'Скачать отчёт (.xlsx)'}
                iconName="arrow-downward"
                disabled={isReportDownloading || total === 0}
                onClick={() => {
                  void handleDownloadReport();
                }}
              />
            </div>

            {reportError ? (
              <div className={styles.errorBanner}>{reportError}</div>
            ) : null}

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

            <div className={styles.filtersRow}>
              <span className={styles.filterLabel}>Годы:</span>
              <YearRangeSelect
                from={yearRange.from}
                to={yearRange.to}
                minYear={MIN_YEAR}
                maxYear={CURRENT_YEAR}
                onChange={setYearRange}
                ariaLabel="Диапазон годов публикаций автора"
                showQuickActions
              />
            </div>

            <PublicationResultsList
              items={items}
              total={total}
              startIndex={(page - 1) * pageSize}
              isLoading={isPublicationsLoading}
              error={publicationsError}
              selectedIds={selectedIds}
              viewMode={viewMode}
              sortField={sortField}
              sortOrder={sortOrder}
              onViewModeChange={setViewMode}
              onToggleItemSelection={handleToggleItemSelection}
              onTogglePageSelection={handleTogglePageSelection}
              onSortFieldChange={(value) =>
                setSortField(value as AuthorPublicationsSortField)
              }
              onSortOrderChange={setSortOrder}
              onDownloadReport={handleDownloadSelectedReport}
            />

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
        </div>
      </main>

      <Footer />
    </div>
  );
}
