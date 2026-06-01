import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import styles from './AuthorDetailsPage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';
import { useAuth } from '@/features/auth';
import { ADMIN_ROLE_ID, ADMINISTRATION_ROLE_ID, DEPARTMENT_HEAD_ROLE_ID } from '@/entities/role';
import { navigateTo } from '@/shared/lib/navigation';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { YearRangeSelect, type YearRange } from '@/shared/ui/YearRangeSelect';
import {
  getAdminAuthorFull,
  getAdminAuthorPublications,
  getAdminAuthorStats,
  downloadAdminAuthorPublicationsReport,
  linkAdminAuthorPublication,
  type AuthorFullDto,
  type AuthorPublicationsSortField,
  type AuthorStatsDto,
} from '@/features/manage-authors';
import {
  getPublications,
  getPublicationFilters,
  type PublicationListItemDto,
  type PublicationSortOrder,
} from '@/entities/publication';
import { PublicationResultsList } from '@/features/search-publications/ui/PublicationResultsList/PublicationResultsList';
import { PublicationsPagination } from '@/features/search-publications/ui/PublicationsPagination/PublicationsPagination';
import {
  PublicationsFilterDropdown,
  type PublicationsFilterOption,
} from '@/features/search-publications';

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

function formatAuthorType(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  return value === 'О' ? 'Штатный сотрудник' : value === 'В' ? 'Внештатный' : value;
}

function formatAuthorStatus(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined') {
    return '—';
  }

  return (
    {
      0: 'Уволен',
      1: 'Работает',
      2: 'Временно не работает',
    }[value] ?? String(value)
  );
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
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkCandidates, setLinkCandidates] = useState<PublicationListItemDto[]>([]);
  const [isLinkSearchLoading, setIsLinkSearchLoading] = useState(false);
  const [linkSearchError, setLinkSearchError] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linkingArticleId, setLinkingArticleId] = useState<number | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

  const isAdmin = isAuthenticated && user?.role_id === ADMIN_ROLE_ID;
  const hasPageAccess =
    isAuthenticated &&
    (user?.role_id === ADMIN_ROLE_ID ||
      user?.role_id === ADMINISTRATION_ROLE_ID ||
      user?.role_id === DEPARTMENT_HEAD_ROLE_ID);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigateTo('/login');
      return;
    }

    if (!isInitializing && isAuthenticated && !hasPageAccess) {
      navigateTo('/');
    }
  }, [isAuthenticated, isInitializing, hasPageAccess]);

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

    if (!isInitializing && isAuthenticated && hasPageAccess) {
      void loadAuthor();
    }

    return () => {
      isMounted = false;
    };
  }, [authorId, isAuthenticated, hasPageAccess, isInitializing]);

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
    if (authorId === null || !hasPageAccess) {
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
    databases,
    hasPageAccess,
    originalTranslationMode,
    page,
    pageSize,
    publicationSearchQuery,
    publicationTypes,
    sortField,
    sortOrder,
  ]);

  const loadStats = useCallback(async () => {
    if (authorId === null || !hasPageAccess) {
      return;
    }

    try {
      const result = await getAdminAuthorStats(
        authorId,
        activeYearFrom,
        activeYearTo,
        publicationSearchQuery,
        publicationTypes,
        databases,
        originalTranslationMode,
      );
      setStats(result);
    } catch {
      setStats(null);
    }
  }, [
    activeYearFrom,
    activeYearTo,
    authorId,
    databases,
    hasPageAccess,
    originalTranslationMode,
    publicationSearchQuery,
    publicationTypes,
  ]);

  useEffect(() => {
    void loadPublications();
  }, [loadPublications]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [
    activeYearFrom,
    activeYearTo,
    databases,
    originalTranslationMode,
    publicationSearchQuery,
    publicationTypes,
    sortField,
    sortOrder,
    pageSize,
  ]);

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

  const handleSearchLinkCandidates = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();

      const query = linkSearchQuery.trim();
      if (!query) {
        setLinkCandidates([]);
        setLinkSearchError('Введите название, DOI или ID публикации.');
        return;
      }

      setIsLinkSearchLoading(true);
      setLinkSearchError(null);
      setLinkMessage(null);

      try {
        const result = await getPublications({
          title: query,
          page: 1,
          pageSize: 10,
          sortBy: 'year',
          sortOrder: 'desc',
        });
        setLinkCandidates(result.items);
      } catch (error) {
        setLinkSearchError(
          error instanceof Error
            ? error.message
            : 'Не удалось найти публикации для привязки.',
        );
      } finally {
        setIsLinkSearchLoading(false);
      }
    },
    [linkSearchQuery],
  );

  const handleLinkPublication = useCallback(
    async (articleId: number) => {
      if (authorId === null) {
        return;
      }

      setLinkingArticleId(articleId);
      setLinkSearchError(null);
      setLinkMessage(null);

      try {
        await linkAdminAuthorPublication(authorId, articleId);
        setLinkMessage('Публикация привязана к автору.');
        setSelectedIds([]);
        await Promise.all([loadPublications(), loadStats()]);
      } catch (error) {
        setLinkSearchError(
          error instanceof Error
            ? error.message
            : 'Не удалось привязать публикацию.',
        );
      } finally {
        setLinkingArticleId(null);
      }
    },
    [authorId, loadPublications, loadStats],
  );

  const handleCloseLinkDialog = useCallback(() => {
    setIsLinkDialogOpen(false);
    setLinkSearchQuery('');
    setLinkCandidates([]);
    setLinkSearchError(null);
    setLinkMessage(null);
    setLinkingArticleId(null);
  }, []);

  const handleResetFilters = useCallback(() => {
    setYearRange({ from: MIN_YEAR, to: CURRENT_YEAR });
    setPublicationSearchDraft('');
    setPublicationSearchQuery('');
    setPublicationTypes([]);
    setDatabases([]);
    setOriginalTranslationMode('all');
  }, []);

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
  const hasActiveFilters =
    !isAllYears ||
    Boolean(publicationSearchQuery) ||
    publicationTypes.length > 0 ||
    databases.length > 0 ||
    originalTranslationMode !== 'all';

  if (isInitializing || !isAuthenticated || !hasPageAccess) {
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
                    <span className={styles.infoLabel}>Подразделение</span>
                    <span className={styles.infoValue}>
                      {formatValue(author.department_name)}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Тип</span>
                    <span className={styles.infoValue}>{formatAuthorType(author.type)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Статус</span>
                    <span className={styles.infoValue}>
                      {formatAuthorStatus(author.status)}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Дата рождения</span>
                    <span className={styles.infoValue}>
                      {formatValue(author.birthdate)}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Год рождения</span>
                    <span className={styles.infoValue}>
                      {formatValue(author.birth_year)}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Псевдоним</span>
                    <span className={styles.infoValue}>
                      {formatValue(author.nickname)}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Шаблон поиска</span>
                    <span className={styles.infoValue}>
                      {formatValue(author.search_pattern)}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Внешний ID</span>
                    <span className={styles.infoValue}>
                      {formatValue(author.external_id)}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>ID ПУ</span>
                    <span className={styles.infoValue}>
                      {author.snils_last4 ? `•••• ${author.snils_last4}` : '—'}
                    </span>
                  </div>
                </div>
              </>
            ) : null}
          </section>

          <section className={`app-surface ${styles.publicationsBlock}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Публикации автора</h2>
              <div className={styles.headerActions}>
                {isAdmin ? (
                  <OutlineButton
                    label="Привязать публикацию"
                    iconName="add"
                    onClick={() => setIsLinkDialogOpen(true)}
                  />
                ) : null}
                <OutlineButton
                  label={isReportDownloading ? 'Формирование...' : 'Скачать отчёт (.xlsx)'}
                  iconName="arrow-downward"
                  disabled={isReportDownloading || total === 0}
                  onClick={() => {
                    void handleDownloadReport();
                  }}
                />
              </div>
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
              <label className={styles.searchLabel} htmlFor="author-publications-search">
                Поиск по публикациям автора
              </label>
              <input
                id="author-publications-search"
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

      {isLinkDialogOpen ? (
        <div
          className={styles.dialogOverlay}
          role="presentation"
          onMouseDown={handleCloseLinkDialog}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-publication-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <div>
                <h2 id="link-publication-title" className={styles.dialogTitle}>
                  Привязать публикацию
                </h2>
                <p className={styles.dialogHint}>
                  Найдите существующую публикацию и добавьте автора в список её авторов.
                </p>
              </div>
              <OutlineButton
                label="Закрыть"
                iconName="close"
                size="small"
                onClick={handleCloseLinkDialog}
              />
            </div>

            <form className={styles.searchRow} onSubmit={handleSearchLinkCandidates}>
              <label className={styles.searchLabel} htmlFor="author-link-search">
                Поиск публикации
              </label>
              <input
                id="author-link-search"
                className={styles.searchInput}
                type="search"
                value={linkSearchQuery}
                onChange={(event) => setLinkSearchQuery(event.target.value)}
                placeholder="Название, DOI или ID публикации"
                autoFocus
              />
              <OutlineButton
                label={isLinkSearchLoading ? 'Поиск...' : 'Найти'}
                iconName="search"
                type="submit"
                disabled={isLinkSearchLoading}
              />
            </form>

            {linkMessage ? (
              <div className={styles.successBanner}>{linkMessage}</div>
            ) : null}

            {linkSearchError ? (
              <div className={styles.errorBanner}>{linkSearchError}</div>
            ) : null}

            {linkCandidates.length > 0 ? (
              <div className={styles.linkResults}>
                {linkCandidates.map((item) => (
                  <div key={item.id} className={styles.linkResultItem}>
                    <div className={styles.linkResultContent}>
                      <div className={styles.linkResultTitle}>
                        {item.title || `Публикация #${item.id}`}
                      </div>
                      <div className={styles.linkResultMeta}>
                        {[item.authors, item.journal, item.year, item.doi]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <OutlineButton
                      label={linkingArticleId === item.id ? 'Привязка...' : 'Связать'}
                      iconName="add"
                      size="small"
                      disabled={linkingArticleId !== null}
                      onClick={() => {
                        void handleLinkPublication(item.id);
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}
