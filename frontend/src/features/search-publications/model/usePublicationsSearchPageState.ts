import { useEffect, useRef, useState } from 'react';

import {
  buildPublicationsQueryFromForm,
  createAiPublicationRagSearch,
  getPublicationFilters,
  getPublications,
  hasPublicationSearchCriteria,
  INITIAL_PUBLICATION_SEARCH_FORM,
  SEARCH_FIELD_OPTIONS,
  type FilterOptionDto,
  type AiPublicationRagSearchDto,
  type AiPublicationSearchPlanDto,
  type AiPublicationSearchPlanFiltersDto,
  type PublicationFiltersDto,
  type PublicationListItemDto,
  type PublicationSearchFormState,
  type PublicationsPaginationDto,
  type PublicationsResponseDto,
  type PublicationsSortFieldValue,
  type PublicationSortOrder,
  type SearchFieldKey,
} from '@/entities/publication';
import { replaceTo } from '@/shared/lib/navigation';
import type { PublicationResultsViewMode } from './publicationResultsView';

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
    articleIds: [...form.articleIds],
  };
}

function isSearchFieldKey(value: string): value is SearchFieldKey {
  return SEARCH_FIELD_OPTIONS.some((option) => option.key === value);
}

function isSortFieldValue(value: string): value is PublicationsSortFieldValue {
  return ['relevance', 'authors', 'title', 'journal', 'year', 'doi', 'quartile'].includes(value);
}

function isPublicationResultsViewMode(value: unknown): value is PublicationResultsViewMode {
  return value === 'list' || value === 'table';
}

function normalizeSearchFields(value: unknown): SearchFieldKey[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_ACTIVE_FIELDS];
  }

  const fields = value.filter(
    (item): item is SearchFieldKey => typeof item === 'string' && isSearchFieldKey(item),
  );

  if (!value.length) {
    return [];
  }

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
    textQuery: typeof form.textQuery === 'string' ? form.textQuery : '',
    refineTextQuery:
      typeof form.refineTextQuery === 'string' ? form.refineTextQuery : '',
    pdfTextQuery: typeof form.pdfTextQuery === 'string' ? form.pdfTextQuery : '',
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
    articleIds: Array.isArray(form.articleIds)
      ? form.articleIds.filter((item): item is number => Number.isInteger(item) && item > 0)
      : [],
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

function normalizeOriginalTranslationModes(
  data: PublicationFiltersDto,
): PublicationFiltersDto {
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

  return {
    ...data,
    original_translation_modes: normalizedModes,
  };
}

function hasAiSearchPlanCriteria(plan: AiPublicationSearchPlanDto): boolean {
  const { filters } = plan;

  return Boolean(
    filters.text_query?.trim() ||
      filters.refine_text_query?.trim() ||
      filters.pdf_text_query?.trim() ||
      filters.title?.trim() ||
      filters.author?.trim() ||
      filters.journal?.trim() ||
      filters.keyword.some((value) => value.trim()) ||
      filters.publication_types.some((value) => value.trim()) ||
      filters.databases.some((value) => value.trim()) ||
      filters.article_ids.length ||
      typeof filters.year_from === 'number' ||
      typeof filters.year_to === 'number' ||
      (filters.original_translation_mode.trim() &&
        filters.original_translation_mode !== 'all'),
  );
}

function buildAiFiltersFromForm(
  form: PublicationSearchFormState,
  activeFields: SearchFieldKey[],
): AiPublicationSearchPlanFiltersDto {
  return {
    text_query: form.textQuery.trim() || null,
    refine_text_query: form.refineTextQuery.trim() || null,
    pdf_text_query: form.pdfTextQuery.trim() || null,
    title: activeFields.includes('title') ? form.title.trim() || null : null,
    author: activeFields.includes('author') ? form.author.trim() || null : null,
    journal: activeFields.includes('journal') ? form.journal.trim() || null : null,
    keyword: activeFields.includes('keyword')
      ? form.keyword
          .split(/[;,\n]/)
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    year_from: form.yearFrom.trim() ? Number(form.yearFrom) : null,
    year_to: form.yearTo.trim() ? Number(form.yearTo) : null,
    publication_types: [...form.publicationTypes],
    databases: [...form.databases],
    original_translation_mode:
      form.originalTranslationMode === 'original_only' ||
      form.originalTranslationMode === 'translation_only'
        ? form.originalTranslationMode
        : 'all',
    article_ids: [...form.articleIds],
  };
}

function getPositiveNumberParam(
  searchParams: URLSearchParams,
  name: string,
): number | null {
  const value = Number(searchParams.get(name));

  return Number.isInteger(value) && value > 0 ? value : null;
}

function getTrimmedListParams(searchParams: URLSearchParams, name: string): string[] {
  return searchParams
    .getAll(name)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getInitialSearchStateFromUrl(): {
  form: PublicationSearchFormState;
  activeFields: SearchFieldKey[];
  pagination: PublicationsPaginationDto;
  sortField: PublicationsSortFieldValue;
  sortOrder: PublicationSortOrder;
  viewMode: PublicationResultsViewMode;
  hasSearched: boolean;
} {
  const searchParams = new URLSearchParams(window.location.search);
  const requestedField = searchParams.get('field');
  const field = SEARCH_FIELD_OPTIONS.some((option) => option.key === requestedField)
    ? (requestedField as SearchFieldKey)
    : DEFAULT_ACTIVE_FIELDS[0];
  const query = searchParams.get('q') ?? '';
  const yearFrom = searchParams.get('year_from') ?? searchParams.get('yearFrom') ?? '';
  const yearTo = searchParams.get('year_to') ?? searchParams.get('yearTo') ?? '';
  const sortFieldParam = searchParams.get('sort_by') ?? '';
  const sortOrderParam = searchParams.get('sort_order');
  const viewModeParam = searchParams.get('view');
  const form: PublicationSearchFormState = {
    ...INITIAL_PUBLICATION_SEARCH_FORM,
    yearFrom,
    yearTo,
    author: searchParams.get('author') ?? '',
    title: searchParams.get('title') ?? '',
    textQuery: searchParams.get('text_query') ?? searchParams.get('textQuery') ?? '',
    refineTextQuery:
      searchParams.get('refine_text_query') ??
      searchParams.get('refineTextQuery') ??
      '',
    pdfTextQuery:
      searchParams.get('pdf_text_query') ??
      searchParams.get('pdfTextQuery') ??
      '',
    journal: searchParams.get('journal') ?? '',
    keyword: searchParams.get('keyword') ?? '',
    publicationTypes: getTrimmedListParams(searchParams, 'publication_types'),
    databases: getTrimmedListParams(searchParams, 'databases'),
    originalTranslationMode:
      searchParams.get('original_translation_mode') ??
      INITIAL_PUBLICATION_SEARCH_FORM.originalTranslationMode,
    articleIds: searchParams
      .getAll('article_ids')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  };

  if (query.trim()) {
    form[field] = query;
  }

  const activeFields = SEARCH_FIELD_OPTIONS.map((option) => option.key).filter((key) =>
    form[key].trim(),
  );
  const normalizedActiveFields = activeFields.length
    ? activeFields
    : query.trim()
      ? [field]
      : [...DEFAULT_ACTIVE_FIELDS];
  const page = getPositiveNumberParam(searchParams, 'page') ?? DEFAULT_PAGINATION.page;
  const pageSize =
    getPositiveNumberParam(searchParams, 'page_size') ?? DEFAULT_PAGINATION.page_size;
  const sortField = isSortFieldValue(sortFieldParam) ? sortFieldParam : 'year';
  const sortOrder = sortOrderParam === 'asc' ? 'asc' : 'desc';
  const viewMode = isPublicationResultsViewMode(viewModeParam) ? viewModeParam : 'list';

  return {
    form,
    activeFields: normalizedActiveFields,
    pagination: {
      ...DEFAULT_PAGINATION,
      page,
      page_size: pageSize,
    },
    sortField,
    sortOrder,
    viewMode,
    hasSearched: hasPublicationSearchCriteria(form, normalizedActiveFields),
  };
}

function appendSearchParamList(
  searchParams: URLSearchParams,
  name: string,
  values: string[],
) {
  values.forEach((value) => {
    const normalized = value.trim();

    if (normalized) {
      searchParams.append(name, normalized);
    }
  });
}

function getSearchParamName(field: SearchFieldKey): string {
  if (field === 'textQuery') {
    return 'text_query';
  }

  if (field === 'pdfTextQuery') {
    return 'pdf_text_query';
  }

  return field;
}

function buildPublicationsUrl(
  form: PublicationSearchFormState,
  activeFields: SearchFieldKey[],
  pagination: PublicationsPaginationDto,
  sortField: PublicationsSortFieldValue,
  sortOrder: PublicationSortOrder,
  viewMode: PublicationResultsViewMode,
): string {
  const searchParams = new URLSearchParams();

  activeFields.forEach((field) => {
    const value = form[field].trim();

    if (value) {
      searchParams.set(getSearchParamName(field), value);
    }
  });

  if (form.textQuery.trim()) {
    searchParams.set('text_query', form.textQuery.trim());
  }

  if (form.pdfTextQuery.trim()) {
    searchParams.set('pdf_text_query', form.pdfTextQuery.trim());
  }

  if (form.yearFrom.trim()) {
    searchParams.set('year_from', form.yearFrom.trim());
  }

  if (form.yearTo.trim()) {
    searchParams.set('year_to', form.yearTo.trim());
  }

  if (form.refineTextQuery.trim()) {
    searchParams.set('refine_text_query', form.refineTextQuery.trim());
  }

  appendSearchParamList(searchParams, 'publication_types', form.publicationTypes);
  appendSearchParamList(searchParams, 'databases', form.databases);

  form.articleIds.forEach((articleId) => {
    searchParams.append('article_ids', String(articleId));
  });

  if (form.originalTranslationMode.trim() && form.originalTranslationMode !== 'all') {
    searchParams.set('original_translation_mode', form.originalTranslationMode.trim());
  }

  searchParams.set('page', String(pagination.page));
  searchParams.set('page_size', String(pagination.page_size));
  searchParams.set('sort_by', sortField);
  searchParams.set('sort_order', sortOrder);
  searchParams.set('view', viewMode);

  return `/articles?${searchParams.toString()}`;
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
      selectedPublicationIds: [],
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

    return {
      form: cloneSearchForm(stateFromUrl.form),
      activeFields: [...stateFromUrl.activeFields],
      appliedForm: cloneSearchForm(stateFromUrl.form),
      appliedFields: [...stateFromUrl.activeFields],
      items: [],
      pagination: stateFromUrl.pagination,
      selectedPublicationIds: [],
      viewMode: stateFromUrl.viewMode,
      sortField: stateFromUrl.sortField,
      sortOrder: stateFromUrl.sortOrder,
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

export function usePublicationsSearchPageState() {
  const initialSearchState = useState(getInitialSearchState)[0];
  const shouldSkipInitialResultsFetch = useRef(
    Boolean(initialSearchState.restoredFromStorage && initialSearchState.hasSearched),
  );
  const shouldIncludeTotal = useRef(
    !Boolean(initialSearchState.restoredFromStorage && initialSearchState.hasSearched),
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
  const [isAiPlanning, setIsAiPlanning] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchExplanation, setAiSearchExplanation] = useState<string | null>(null);
  const [aiResetRevision, setAiResetRevision] = useState(0);
  const [hasSearched, setHasSearched] = useState(initialSearchState.hasSearched);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFilters() {
      try {
        setIsFiltersLoading(true);
        const data = await getPublicationFilters();

        if (!isMounted) {
          return;
        }

        setFilters(normalizeOriginalTranslationModes(data));
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
      selectedPublicationIds: [],
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
    sortField,
    sortOrder,
    viewMode,
  ]);

  useEffect(() => {
    if (!hasSearched) {
      return;
    }

    const nextPath = buildPublicationsUrl(
      appliedForm,
      appliedFields,
      pagination,
      sortField,
      sortOrder,
      viewMode,
    );
    const currentPath = `${window.location.pathname}${window.location.search}`;

    if (currentPath !== nextPath) {
      window.history.replaceState({}, '', nextPath);
    }
  }, [
    appliedFields,
    appliedForm,
    hasSearched,
    pagination,
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
        const includeTotal = shouldIncludeTotal.current;
        query.includeTotal = includeTotal;

        if (!includeTotal) {
          query.knownTotal = pagination.total;
        }

        const response: PublicationsResponseDto = await getPublications(query);

        if (!isMounted) {
          return;
        }

        setItems(response.items);
        setPagination(response.pagination);
        shouldIncludeTotal.current = false;
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

  const handleYearRangeChange = (nextValue: { from: string; to: string }) => {
    setForm((prev) => ({
      ...prev,
      yearFrom: nextValue.from,
      yearTo: nextValue.to,
    }));
  };

  const handlePublicationTypesChange = (nextValue: string[]) => {
    setForm((prev) => ({
      ...prev,
      publicationTypes: nextValue,
    }));
  };

  const handleDatabasesChange = (nextValue: string[]) => {
    setForm((prev) => ({
      ...prev,
      databases: nextValue,
    }));
  };

  const handleOriginalTranslationModeChange = (nextValue: string) => {
    setForm((prev) => ({
      ...prev,
      originalTranslationMode: nextValue,
    }));
  };

  const handleActiveFieldsChange = (nextValue: SearchFieldKey[]) => {
    setActiveFields(nextValue.length ? nextValue : [...DEFAULT_ACTIVE_FIELDS]);
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
    shouldIncludeTotal.current = true;
    setSelectedPublicationIds([]);
    setAppliedForm(cloneSearchForm(form));
    setAppliedFields([...activeFields]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handleAiSearch = async (
    messageOverride?: string,
  ): Promise<AiPublicationRagSearchDto | null> => {
    const message = (messageOverride ?? aiSearchQuery).trim();

    if (!message) {
      return null;
    }

    try {
      setIsAiPlanning(true);
      setError(null);
      setAiSearchQuery(message);

      const currentFilters = hasSearched
        ? buildAiFiltersFromForm(appliedForm, appliedFields)
        : undefined;
      const ragSearch = await createAiPublicationRagSearch(message, currentFilters);
      const plan = ragSearch.plan;
      setAiSearchExplanation(plan.explanation);

      if (plan.intent === 'clarify' || !hasAiSearchPlanCriteria(plan)) {
        return ragSearch;
      }

      const nextForm: PublicationSearchFormState = {
        ...cloneSearchForm(INITIAL_PUBLICATION_SEARCH_FORM),
        textQuery: plan.filters.text_query ?? '',
        refineTextQuery: plan.filters.refine_text_query ?? '',
        pdfTextQuery: plan.filters.article_ids.length
          ? ''
          : plan.filters.pdf_text_query ?? '',
        title: plan.filters.title ?? '',
        author: plan.filters.author ?? '',
        journal: plan.filters.journal ?? '',
        keyword: plan.filters.keyword.join(', '),
        yearFrom:
          typeof plan.filters.year_from === 'number'
            ? String(plan.filters.year_from)
            : '',
        yearTo:
          typeof plan.filters.year_to === 'number'
            ? String(plan.filters.year_to)
            : '',
        publicationTypes: plan.filters.publication_types,
        databases: plan.filters.databases,
        originalTranslationMode: plan.filters.original_translation_mode,
        articleIds: plan.filters.article_ids,
      };
      const nextActiveFields = SEARCH_FIELD_OPTIONS.map((option) => option.key).filter(
        (field) => nextForm[field].trim(),
      );
      const normalizedActiveFields: SearchFieldKey[] = nextActiveFields.length
        ? nextActiveFields
        : [...DEFAULT_ACTIVE_FIELDS];

      setForm(nextForm);
      setActiveFields(normalizedActiveFields);
      setAppliedForm(cloneSearchForm(nextForm));
      setAppliedFields([...normalizedActiveFields]);
      setHasSearched(true);
      shouldIncludeTotal.current = true;
      setSelectedPublicationIds([]);
      setPagination((prev) => ({
        ...prev,
        page: 1,
      }));
      setSortField(plan.sort.by);
      setSortOrder(plan.sort.order);
      return ragSearch;
    } catch (caughtError) {
      const messageText =
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось сформировать план поиска.';

      setError(
        messageText,
      );
      throw new Error(messageText);
    } finally {
      setIsAiPlanning(false);
    }
  };

  const handleReset = () => {
    window.sessionStorage.removeItem(PUBLICATIONS_SEARCH_STATE_KEY);
    setForm(cloneSearchForm(INITIAL_PUBLICATION_SEARCH_FORM));
    setAppliedForm(cloneSearchForm(INITIAL_PUBLICATION_SEARCH_FORM));
    setActiveFields([...DEFAULT_ACTIVE_FIELDS]);
    setAppliedFields([...DEFAULT_ACTIVE_FIELDS]);
    setSortField('year');
    setSortOrder('desc');
    shouldIncludeTotal.current = true;
    setAiSearchQuery('');
    setAiSearchExplanation(null);
    setAiResetRevision((prev) => prev + 1);
    setItems([]);
    setSelectedPublicationIds([]);
    setError(null);
    setHasSearched(false);
    setPagination(DEFAULT_PAGINATION);

    if (window.location.search) {
      replaceTo('/articles');
    }
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

  const handleSortFieldChange = (value: PublicationsSortFieldValue) => {
    setSortField(value);
    setSelectedPublicationIds([]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handleSortOrderChange = (value: PublicationSortOrder) => {
    setSortOrder(value);
    setSelectedPublicationIds([]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handlePageChange = (nextPage: number) => {
    setSelectedPublicationIds([]);
    setPagination((prev) => ({
      ...prev,
      page: nextPage,
    }));
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setSelectedPublicationIds([]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
      page_size: nextPageSize,
    }));
  };

  const handlePublicationDeleted = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedPublicationIds((prev) => prev.filter((itemId) => itemId !== id));
    setPagination((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
      total_pages: Math.ceil(Math.max(0, prev.total - 1) / prev.page_size),
    }));
  };

  return {
    filters,
    form,
    appliedForm,
    activeFields,
    items,
    pagination,
    selectedPublicationIds,
    viewMode,
    sortField,
    sortOrder,
    isAiPlanning,
    isFiltersLoading,
    isResultsLoading,
    hasSearched,
    error,
    aiSearchQuery,
    aiSearchExplanation,
    aiResetRevision,
    setAiSearchQuery,
    setViewMode,
    handleFieldChange,
    handleYearRangeChange,
    handlePublicationTypesChange,
    handleDatabasesChange,
    handleOriginalTranslationModeChange,
    handleActiveFieldsChange,
    handleAiSearch,
    handleSearch,
    handleReset,
    handleToggleItemSelection,
    handleTogglePageSelection,
    handleSortFieldChange,
    handleSortOrderChange,
    handlePageChange,
    handlePageSizeChange,
    handlePublicationDeleted,
  };
}
