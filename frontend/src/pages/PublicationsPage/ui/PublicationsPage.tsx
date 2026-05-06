import { useEffect, useRef, useState } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import {
  PublicationResultsList,
  PublicationSearchPanel,
  PublicationsPagination,
  type PublicationResultsViewMode,
} from '@/features/search-publications';
import {
  buildPublicationsQueryFromForm,
  getPublicationFilters,
  getPublications,
  hasPublicationSearchCriteria,
  INITIAL_PUBLICATION_SEARCH_FORM,
  SEARCH_FIELD_OPTIONS,
  type FilterOptionDto,
  type PublicationFiltersDto,
  type PublicationListItemDto,
  type PublicationSearchFormState,
  type PublicationsPaginationDto,
  type PublicationsResponseDto,
  type PublicationsSortFieldValue,
  type PublicationSortOrder,
  type SearchFieldKey,
} from '@/entities/publication';
import { Button } from '@/shared/ui/Button';
import { navigateTo } from '@/shared/lib/navigation';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { useAuth } from '@/features/auth';
import styles from './PublicationsPage.module.css';

const DEFAULT_ACTIVE_FIELDS: SearchFieldKey[] = ['author'];

const DEFAULT_PAGINATION: PublicationsPaginationDto = {
  page: 1,
  page_size: 10,
  total: 0,
  total_pages: 0,
};

const EMPTY_FILTERS: PublicationFiltersDto = {
  year_min: null,
  year_max: null,
  publication_types: [],
  databases: [],
  original_translation_modes: [],
};

const PUBLICATIONS_SEARCH_STATE_KEY = 'publications:search-state';

type PublicationsPageSearchState = {
  form: PublicationSearchFormState;
  activeFields: SearchFieldKey[];
  appliedForm: PublicationSearchFormState;
  appliedFields: SearchFieldKey[];
  items: PublicationListItemDto[];
  pagination: PublicationsPaginationDto;
  selectedPublicationIds: number[];
  viewMode: PublicationResultsViewMode;
  sortField: PublicationsSortFieldValue;
  sortOrder: PublicationSortOrder;
  hasSearched: boolean;
  restoredFromStorage?: boolean;
};

function cloneSearchForm(
  form: PublicationSearchFormState,
): PublicationSearchFormState {
  return {
    ...form,
    publicationTypes: [...form.publicationTypes],
    databases: [...form.databases],
  };
}

function isSearchFieldKey(value: string): value is SearchFieldKey {
  return SEARCH_FIELD_OPTIONS.some((option) => option.key === value);
}

function isSortFieldValue(value: string): value is PublicationsSortFieldValue {
  return ['authors', 'title', 'journal', 'year', 'doi', 'quartile'].includes(value);
}

function isPublicationResultsViewMode(value: unknown): value is PublicationResultsViewMode {
  return value === 'list' || value === 'table';
}

function normalizeSelectedPublicationIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = value.filter(
    (item): item is number =>
      typeof item === 'number' && Number.isInteger(item) && item > 0,
  );

  return Array.from(new Set(ids));
}

function normalizeSearchFields(value: unknown): SearchFieldKey[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_ACTIVE_FIELDS];
  }

  const fields = value.filter(
    (item): item is SearchFieldKey => typeof item === 'string' && isSearchFieldKey(item),
  );

  return fields.length ? fields : [...DEFAULT_ACTIVE_FIELDS];
}

function normalizeSearchForm(value: unknown): PublicationSearchFormState {
  if (!value || typeof value !== 'object') {
    return cloneSearchForm(INITIAL_PUBLICATION_SEARCH_FORM);
  }

  const form = value as Partial<Record<keyof PublicationSearchFormState, unknown>>;

  return {
    yearFrom: typeof form.yearFrom === 'string' ? form.yearFrom : '',
    yearTo: typeof form.yearTo === 'string' ? form.yearTo : '',
    author: typeof form.author === 'string' ? form.author : '',
    title: typeof form.title === 'string' ? form.title : '',
    journal: typeof form.journal === 'string' ? form.journal : '',
    keyword: typeof form.keyword === 'string' ? form.keyword : '',
    publicationTypes: Array.isArray(form.publicationTypes)
      ? form.publicationTypes.filter((item): item is string => typeof item === 'string')
      : [],
    databases: Array.isArray(form.databases)
      ? form.databases.filter((item): item is string => typeof item === 'string')
      : [],
    originalTranslationMode:
      typeof form.originalTranslationMode === 'string'
        ? form.originalTranslationMode
        : 'all',
  };
}

function normalizePagination(value: unknown): PublicationsPaginationDto {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PAGINATION;
  }

  const pagination = value as Partial<Record<keyof PublicationsPaginationDto, unknown>>;

  return {
    page: typeof pagination.page === 'number' ? pagination.page : DEFAULT_PAGINATION.page,
    page_size:
      typeof pagination.page_size === 'number'
        ? pagination.page_size
        : DEFAULT_PAGINATION.page_size,
    total:
      typeof pagination.total === 'number' ? pagination.total : DEFAULT_PAGINATION.total,
    total_pages:
      typeof pagination.total_pages === 'number'
        ? pagination.total_pages
        : DEFAULT_PAGINATION.total_pages,
  };
}

function areStringArraysEqual(first: string[], second: string[]): boolean {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function areSearchFormsEqual(
  first: PublicationSearchFormState,
  second: PublicationSearchFormState,
): boolean {
  return (
    first.yearFrom === second.yearFrom &&
    first.yearTo === second.yearTo &&
    first.author === second.author &&
    first.title === second.title &&
    first.journal === second.journal &&
    first.keyword === second.keyword &&
    first.originalTranslationMode === second.originalTranslationMode &&
    areStringArraysEqual(first.publicationTypes, second.publicationTypes) &&
    areStringArraysEqual(first.databases, second.databases)
  );
}

function getInitialSearchStateFromUrl(): {
  form: PublicationSearchFormState;
  activeFields: SearchFieldKey[];
  hasSearched: boolean;
} {
  const searchParams = new URLSearchParams(window.location.search);
  const requestedField = searchParams.get('field');
  const field = SEARCH_FIELD_OPTIONS.some((option) => option.key === requestedField)
    ? (requestedField as SearchFieldKey)
    : DEFAULT_ACTIVE_FIELDS[0];
  const query = searchParams.get('q') ?? '';
  const yearFrom = searchParams.get('yearFrom') ?? '';
  const yearTo = searchParams.get('yearTo') ?? '';
  const form: PublicationSearchFormState = {
    ...INITIAL_PUBLICATION_SEARCH_FORM,
    yearFrom,
    yearTo,
    [field]: query,
  };
  const activeFields = [field];

  return {
    form,
    activeFields,
    hasSearched: hasPublicationSearchCriteria(form, activeFields),
  };
}

function getStoredSearchState(): PublicationsPageSearchState | null {
  try {
    const storedValue = window.sessionStorage.getItem(PUBLICATIONS_SEARCH_STATE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsed = JSON.parse(storedValue) as Partial<PublicationsPageSearchState>;
    const form = normalizeSearchForm(parsed.form);
    const activeFields = normalizeSearchFields(parsed.activeFields);
    const appliedForm = normalizeSearchForm(parsed.appliedForm);
    const appliedFields = normalizeSearchFields(parsed.appliedFields);
    const sortField =
      typeof parsed.sortField === 'string' && isSortFieldValue(parsed.sortField)
        ? parsed.sortField
        : 'year';
    const sortOrder = parsed.sortOrder === 'asc' ? 'asc' : 'desc';

    return {
      form,
      activeFields,
      appliedForm,
      appliedFields,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      pagination: normalizePagination(parsed.pagination),
      selectedPublicationIds: normalizeSelectedPublicationIds(
        parsed.selectedPublicationIds,
      ),
      viewMode: isPublicationResultsViewMode(parsed.viewMode)
        ? parsed.viewMode
        : 'list',
      sortField,
      sortOrder,
      hasSearched:
        typeof parsed.hasSearched === 'boolean'
          ? parsed.hasSearched
          : hasPublicationSearchCriteria(appliedForm, appliedFields),
    };
  } catch {
    window.sessionStorage.removeItem(PUBLICATIONS_SEARCH_STATE_KEY);
    return null;
  }
}

function getInitialSearchState(): PublicationsPageSearchState {
  if (window.location.search) {
    const stateFromUrl = getInitialSearchStateFromUrl();
    const storedState = getStoredSearchState();

    if (
      storedState?.hasSearched &&
      areSearchFormsEqual(storedState.appliedForm, stateFromUrl.form) &&
      areStringArraysEqual(storedState.appliedFields, stateFromUrl.activeFields)
    ) {
      return {
        ...storedState,
        restoredFromStorage: true,
      };
    }

    return {
      form: cloneSearchForm(stateFromUrl.form),
      activeFields: [...stateFromUrl.activeFields],
      appliedForm: cloneSearchForm(stateFromUrl.form),
      appliedFields: [...stateFromUrl.activeFields],
      items: [],
      pagination: DEFAULT_PAGINATION,
      selectedPublicationIds: [],
      viewMode: 'list',
      sortField: 'year',
      sortOrder: 'desc',
      hasSearched: stateFromUrl.hasSearched,
    };
  }

  const storedState = getStoredSearchState();

  if (storedState) {
    return {
      ...storedState,
      restoredFromStorage: true,
    };
  }

  return {
    form: cloneSearchForm(INITIAL_PUBLICATION_SEARCH_FORM),
    activeFields: [...DEFAULT_ACTIVE_FIELDS],
    appliedForm: cloneSearchForm(INITIAL_PUBLICATION_SEARCH_FORM),
    appliedFields: [...DEFAULT_ACTIVE_FIELDS],
    items: [],
    pagination: DEFAULT_PAGINATION,
    selectedPublicationIds: [],
    viewMode: 'list',
    sortField: 'year',
    sortOrder: 'desc',
    hasSearched: false,
  };
}

export function PublicationsPage() {
  const { user, isAuthenticated } = useAuth();
  const initialSearchState = useState(getInitialSearchState)[0];
  const shouldSkipInitialResultsFetch = useRef(
    Boolean(initialSearchState.restoredFromStorage && initialSearchState.hasSearched),
  );
  const [filters, setFilters] = useState<PublicationFiltersDto>(EMPTY_FILTERS);
  const [form, setForm] = useState<PublicationSearchFormState>(
    initialSearchState.form,
  );
  const [activeFields, setActiveFields] = useState<SearchFieldKey[]>(
    initialSearchState.activeFields,
  );
  const [items, setItems] = useState<PublicationListItemDto[]>(
    initialSearchState.items,
  );
  const [pagination, setPagination] = useState<PublicationsPaginationDto>(
    initialSearchState.pagination,
  );
  const [selectedPublicationIds, setSelectedPublicationIds] = useState<number[]>(
    initialSearchState.selectedPublicationIds,
  );
  const [viewMode, setViewMode] = useState<PublicationResultsViewMode>(
    initialSearchState.viewMode,
  );
  const [appliedForm, setAppliedForm] = useState<PublicationSearchFormState>(
    initialSearchState.appliedForm,
  );
  const [appliedFields, setAppliedFields] = useState<SearchFieldKey[]>(
    initialSearchState.appliedFields,
  );
  const [sortField, setSortField] = useState<PublicationsSortFieldValue>(
    initialSearchState.sortField,
  );
  const [sortOrder, setSortOrder] = useState<PublicationSortOrder>(
    initialSearchState.sortOrder,
  );
  const [isFiltersLoading, setIsFiltersLoading] = useState(true);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(initialSearchState.hasSearched);
  const [error, setError] = useState<string | null>(null);

  const canCreatePublication = Boolean(
    isAuthenticated && user?.role_id === ADMIN_ROLE_ID,
  );

  useEffect(() => {
    let isMounted = true;

    async function loadFilters() {
      try {
        setIsFiltersLoading(true);
        const data = await getPublicationFilters();

        if (!isMounted) {
          return;
        }

        const normalizedModes: FilterOptionDto[] = (
          data.original_translation_modes.length
            ? data.original_translation_modes
            : [
                { value: 'all', label: 'Все' },
                { value: 'original_only', label: 'Только оригиналы' },
                { value: 'translation_only', label: 'Только переводы' },
              ]
        )
          .filter((option) => option.value !== 'linked_only')
          .map((option) =>
            option.value === 'original_only'
              ? { ...option, label: 'Только оригиналы' }
              : option.value === 'translation_only'
                ? { ...option, label: 'Только переводы' }
                : option,
          );

        setFilters({
          ...data,
          original_translation_modes: normalizedModes,
        });
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Не удалось загрузить фильтры.',
        );
      } finally {
        if (isMounted) {
          setIsFiltersLoading(false);
        }
      }
    }

    void loadFilters();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const stateToStore: PublicationsPageSearchState = {
      form: cloneSearchForm(form),
      activeFields: [...activeFields],
      appliedForm: cloneSearchForm(appliedForm),
      appliedFields: [...appliedFields],
      items,
      pagination,
      selectedPublicationIds,
      viewMode,
      sortField,
      sortOrder,
      hasSearched,
    };

    window.sessionStorage.setItem(
      PUBLICATIONS_SEARCH_STATE_KEY,
      JSON.stringify(stateToStore),
    );
  }, [
    activeFields,
    appliedFields,
    appliedForm,
    form,
    hasSearched,
    items,
    pagination,
    selectedPublicationIds,
    sortField,
    sortOrder,
    viewMode,
  ]);

  useEffect(() => {
    if (!hasSearched) {
      return;
    }

    if (shouldSkipInitialResultsFetch.current) {
      shouldSkipInitialResultsFetch.current = false;
      return;
    }

    let isMounted = true;

    async function loadResults() {
      try {
        setIsResultsLoading(true);
        setError(null);

        const query = buildPublicationsQueryFromForm(
          appliedForm,
          appliedFields,
          pagination.page,
          pagination.page_size,
          sortField,
          sortOrder,
        );

        const response: PublicationsResponseDto = await getPublications(query);

        if (!isMounted) {
          return;
        }

        setItems(response.items);
        setPagination(response.pagination);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Не удалось загрузить публикации.',
        );
      } finally {
        if (isMounted) {
          setIsResultsLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      isMounted = false;
    };
  }, [
    appliedFields,
    appliedForm,
    hasSearched,
    pagination.page,
    pagination.page_size,
    sortField,
    sortOrder,
  ]);

  const handleFieldChange = (field: SearchFieldKey, nextValue: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: nextValue,
    }));
  };

  const handleSearch = () => {
    if (!hasPublicationSearchCriteria(form, activeFields)) {
      setItems([]);
      setError(null);
      setHasSearched(false);
      setPagination(DEFAULT_PAGINATION);
      setSelectedPublicationIds([]);
      return;
    }

    setHasSearched(true);
    setSelectedPublicationIds([]);
    setAppliedForm({
      ...form,
      publicationTypes: [...form.publicationTypes],
      databases: [...form.databases],
    });
    setAppliedFields([...activeFields]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handleReset = () => {
    window.sessionStorage.removeItem(PUBLICATIONS_SEARCH_STATE_KEY);
    setForm(INITIAL_PUBLICATION_SEARCH_FORM);
    setAppliedForm({
      ...INITIAL_PUBLICATION_SEARCH_FORM,
      publicationTypes: [],
      databases: [],
    });
    setActiveFields(DEFAULT_ACTIVE_FIELDS);
    setAppliedFields([...DEFAULT_ACTIVE_FIELDS]);
    setSortField('year');
    setSortOrder('desc');
    setItems([]);
    setSelectedPublicationIds([]);
    setError(null);
    setHasSearched(false);
    setPagination(DEFAULT_PAGINATION);
  };

  const handleToggleItemSelection = (id: number) => {
    setSelectedPublicationIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const handleTogglePageSelection = (ids: number[], shouldSelect: boolean) => {
    if (!ids.length) {
      return;
    }

    setSelectedPublicationIds((prev) => {
      const idSet = new Set(prev);

      ids.forEach((id) => {
        if (shouldSelect) {
          idSet.add(id);
          return;
        }

        idSet.delete(id);
      });

      return Array.from(idSet);
    });
  };

  return (
    <div className={styles.page}>
      <Header title="Поиск публикаций" />

      <main className={styles.main}>
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
              value={form}
              activeFields={activeFields}
              yearMin={filters.year_min}
              yearMax={filters.year_max}
              publicationTypes={filters.publication_types}
              databases={filters.databases}
              originalTranslationModes={filters.original_translation_modes}
              isLoading={isFiltersLoading || isResultsLoading}
              onFieldChange={handleFieldChange}
              onYearRangeChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  yearFrom: nextValue.from,
                  yearTo: nextValue.to,
                }))
              }
              onPublicationTypesChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  publicationTypes: nextValue,
                }))
              }
              onDatabasesChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  databases: nextValue,
                }))
              }
              onOriginalTranslationModeChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  originalTranslationMode: nextValue,
                }))
              }
              onActiveFieldsChange={setActiveFields}
              onSubmit={handleSearch}
              onReset={handleReset}
            />

            {hasSearched ? (
              <div className={`app-surface ${styles.resultsBlock}`}>
                <PublicationResultsList
                  items={items}
                  total={pagination.total}
                  startIndex={(pagination.page - 1) * pagination.page_size}
                  isLoading={isResultsLoading}
                  error={error}
                  selectedIds={selectedPublicationIds}
                  viewMode={viewMode}
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onViewModeChange={setViewMode}
                  onToggleItemSelection={handleToggleItemSelection}
                  onTogglePageSelection={handleTogglePageSelection}
                  onSortFieldChange={(value) => {
                    setSortField(value);
                    setPagination((prev) => ({
                      ...prev,
                      page: 1,
                    }));
                  }}
                  onSortOrderChange={(value) => {
                    setSortOrder(value);
                    setPagination((prev) => ({
                      ...prev,
                      page: 1,
                    }));
                  }}
                />

                <PublicationsPagination
                  page={pagination.page}
                  pageSize={pagination.page_size}
                  totalPages={pagination.total_pages}
                  total={pagination.total}
                  onPageChange={(nextPage) =>
                    setPagination((prev) => ({
                      ...prev,
                      page: nextPage,
                    }))
                  }
                  onPageSizeChange={(nextPageSize) =>
                    setPagination((prev) => ({
                      ...prev,
                      page: 1,
                      page_size: nextPageSize,
                    }))
                  }
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
