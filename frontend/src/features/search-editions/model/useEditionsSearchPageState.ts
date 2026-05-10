import { useEffect, useMemo, useRef, useState } from 'react';

import {
  buildEditionsQueryFromForm,
  cloneEditionSearchForm,
  getDefaultEditionSortField,
  getDefaultEditionSortOrder,
  getEditionFilters,
  getEditionSortOptions,
  getEditions,
  INITIAL_EDITION_SEARCH_FORM,
  type EditionFiltersDto,
  type EditionKind,
  type EditionListItemDto,
  type EditionSearchFormState,
  type EditionsPaginationDto,
  type EditionsResponseDto,
  type EditionsSortFieldValue,
  type EditionSortOrder,
} from '@/entities/edition';
import type { EditionResultsViewMode } from './editionResultsView';

const DEFAULT_KIND: EditionKind = 'periodical';

const DEFAULT_PAGINATION: EditionsPaginationDto = {
  page: 1,
  page_size: 10,
  total: 0,
  total_pages: 0,
};

const EMPTY_FILTERS: EditionFiltersDto = {
  year_min: null,
  year_max: null,
  metric_levels: [],
  edition_types: [],
};

const EDITIONS_SEARCH_STATE_KEY = 'editions:search-state';

type EditionsPageSearchState = {
  kind: EditionKind;
  form: EditionSearchFormState;
  appliedForm: EditionSearchFormState;
  items: EditionListItemDto[];
  pagination: EditionsPaginationDto;
  selectedEditionIds: string[];
  viewMode: EditionResultsViewMode;
  sortField: EditionsSortFieldValue;
  sortOrder: EditionSortOrder;
  restoredFromStorage?: boolean;
};

function isEditionKind(value: unknown): value is EditionKind {
  return value === 'periodical' || value === 'nonperiodical';
}

function isViewMode(value: unknown): value is EditionResultsViewMode {
  return value === 'list' || value === 'table';
}

function normalizeSearchForm(value: unknown): EditionSearchFormState {
  if (!value || typeof value !== 'object') {
    return cloneEditionSearchForm(INITIAL_EDITION_SEARCH_FORM);
  }

  const form = value as Partial<Record<keyof EditionSearchFormState, unknown>>;

  return {
    query: typeof form.query === 'string' ? form.query : '',
    yearFrom: typeof form.yearFrom === 'string' ? form.yearFrom : '',
    yearTo: typeof form.yearTo === 'string' ? form.yearTo : '',
    metricLevels: Array.isArray(form.metricLevels)
      ? form.metricLevels.filter((item): item is string => typeof item === 'string')
      : [],
    editionTypes: Array.isArray(form.editionTypes)
      ? form.editionTypes.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function normalizePagination(value: unknown): EditionsPaginationDto {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PAGINATION;
  }

  const pagination = value as Partial<Record<keyof EditionsPaginationDto, unknown>>;

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

function normalizeSortField(
  kind: EditionKind,
  value: unknown,
): EditionsSortFieldValue {
  if (typeof value !== 'string') {
    return getDefaultEditionSortField(kind);
  }

  const options = getEditionSortOptions(kind);
  return options.some((option) => option.value === value)
    ? (value as EditionsSortFieldValue)
    : getDefaultEditionSortField(kind);
}

function getStoredSearchState(): EditionsPageSearchState | null {
  try {
    const storedValue = window.sessionStorage.getItem(EDITIONS_SEARCH_STATE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsed = JSON.parse(storedValue) as Partial<EditionsPageSearchState>;
    const kind = isEditionKind(parsed.kind) ? parsed.kind : DEFAULT_KIND;

    return {
      kind,
      form: normalizeSearchForm(parsed.form),
      appliedForm: normalizeSearchForm(parsed.appliedForm),
      items: Array.isArray(parsed.items) ? parsed.items : [],
      pagination: normalizePagination(parsed.pagination),
      selectedEditionIds: [],
      viewMode: isViewMode(parsed.viewMode) ? parsed.viewMode : 'table',
      sortField: normalizeSortField(kind, parsed.sortField),
      sortOrder:
        parsed.sortOrder === 'asc' || parsed.sortOrder === 'desc'
          ? parsed.sortOrder
          : getDefaultEditionSortOrder(kind),
    };
  } catch {
    window.sessionStorage.removeItem(EDITIONS_SEARCH_STATE_KEY);
    return null;
  }
}

function getInitialSearchState(): EditionsPageSearchState {
  const storedState = getStoredSearchState();

  if (storedState) {
    return {
      ...storedState,
      restoredFromStorage: true,
    };
  }

  return {
    kind: DEFAULT_KIND,
    form: cloneEditionSearchForm(INITIAL_EDITION_SEARCH_FORM),
    appliedForm: cloneEditionSearchForm(INITIAL_EDITION_SEARCH_FORM),
    items: [],
    pagination: DEFAULT_PAGINATION,
    selectedEditionIds: [],
    viewMode: 'table',
    sortField: getDefaultEditionSortField(DEFAULT_KIND),
    sortOrder: getDefaultEditionSortOrder(DEFAULT_KIND),
  };
}

export function useEditionsSearchPageState() {
  const initialSearchState = useState(getInitialSearchState)[0];
  const shouldSkipInitialResultsFetch = useRef(
    Boolean(initialSearchState.restoredFromStorage),
  );
  const [filters, setFilters] = useState<EditionFiltersDto>(EMPTY_FILTERS);
  const [kind, setKind] = useState<EditionKind>(initialSearchState.kind);
  const [form, setForm] = useState<EditionSearchFormState>(
    initialSearchState.form,
  );
  const [appliedForm, setAppliedForm] = useState<EditionSearchFormState>(
    initialSearchState.appliedForm,
  );
  const [items, setItems] = useState<EditionListItemDto[]>(
    initialSearchState.items,
  );
  const [pagination, setPagination] = useState<EditionsPaginationDto>(
    initialSearchState.pagination,
  );
  const [selectedEditionIds, setSelectedEditionIds] = useState<string[]>(
    initialSearchState.selectedEditionIds,
  );
  const [viewMode, setViewMode] = useState<EditionResultsViewMode>(
    initialSearchState.viewMode,
  );
  const [sortField, setSortField] = useState<EditionsSortFieldValue>(
    initialSearchState.sortField,
  );
  const [sortOrder, setSortOrder] = useState<EditionSortOrder>(
    initialSearchState.sortOrder,
  );
  const [isFiltersLoading, setIsFiltersLoading] = useState(true);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortOptions = useMemo(() => getEditionSortOptions(kind), [kind]);

  useEffect(() => {
    let isMounted = true;

    async function loadFilters() {
      try {
        setIsFiltersLoading(true);
        const data = await getEditionFilters();

        if (!isMounted) {
          return;
        }

        setFilters(data);
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
    const stateToStore: EditionsPageSearchState = {
      kind,
      form: cloneEditionSearchForm(form),
      appliedForm: cloneEditionSearchForm(appliedForm),
      items,
      pagination,
      selectedEditionIds: [],
      viewMode,
      sortField,
      sortOrder,
    };

    window.sessionStorage.setItem(
      EDITIONS_SEARCH_STATE_KEY,
      JSON.stringify(stateToStore),
    );
  }, [appliedForm, form, items, kind, pagination, sortField, sortOrder, viewMode]);

  useEffect(() => {
    if (shouldSkipInitialResultsFetch.current) {
      shouldSkipInitialResultsFetch.current = false;
      return;
    }

    let isMounted = true;

    async function loadResults() {
      try {
        setIsResultsLoading(true);
        setError(null);

        const query = buildEditionsQueryFromForm(
          kind,
          appliedForm,
          pagination.page,
          pagination.page_size,
          sortField,
          sortOrder,
        );

        const response: EditionsResponseDto = await getEditions(query);

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
            : 'Не удалось загрузить издания.',
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
    appliedForm,
    kind,
    pagination.page,
    pagination.page_size,
    sortField,
    sortOrder,
  ]);

  const handleKindChange = (nextKind: EditionKind) => {
    if (nextKind === kind) {
      return;
    }

    const nextForm = {
      ...form,
      metricLevels: [],
      editionTypes: [],
    };

    setKind(nextKind);
    setForm(nextForm);
    setAppliedForm(cloneEditionSearchForm(nextForm));
    setSortField(getDefaultEditionSortField(nextKind));
    setSortOrder(getDefaultEditionSortOrder(nextKind));
    setSelectedEditionIds([]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
      total: 0,
      total_pages: 0,
    }));
  };

  const handleQueryChange = (nextValue: string) => {
    setForm((prev) => ({
      ...prev,
      query: nextValue,
    }));
  };

  const handleYearRangeChange = (nextValue: { from: string; to: string }) => {
    setForm((prev) => ({
      ...prev,
      yearFrom: nextValue.from,
      yearTo: nextValue.to,
    }));
  };

  const handleMetricLevelsChange = (nextValue: string[]) => {
    setForm((prev) => ({
      ...prev,
      metricLevels: nextValue,
    }));
  };

  const handleEditionTypesChange = (nextValue: string[]) => {
    setForm((prev) => ({
      ...prev,
      editionTypes: nextValue,
    }));
  };

  const handleSearch = () => {
    setSelectedEditionIds([]);
    setAppliedForm(cloneEditionSearchForm(form));
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handleToggleItemSelection = (id: string) => {
    setSelectedEditionIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const handleTogglePageSelection = (ids: string[], shouldSelect: boolean) => {
    if (!ids.length) {
      return;
    }

    setSelectedEditionIds((prev) => {
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

  const handleSortFieldChange = (value: EditionsSortFieldValue) => {
    setSortField(value);
    setSelectedEditionIds([]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handleSortOrderChange = (value: EditionSortOrder) => {
    setSortOrder(value);
    setSelectedEditionIds([]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handlePageChange = (nextPage: number) => {
    setSelectedEditionIds([]);
    setPagination((prev) => ({
      ...prev,
      page: nextPage,
    }));
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setSelectedEditionIds([]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
      page_size: nextPageSize,
    }));
  };

  return {
    filters,
    kind,
    form,
    items,
    pagination,
    selectedEditionIds,
    viewMode,
    sortField,
    sortOrder,
    sortOptions,
    isFiltersLoading,
    isResultsLoading,
    error,
    setViewMode,
    handleKindChange,
    handleQueryChange,
    handleYearRangeChange,
    handleMetricLevelsChange,
    handleEditionTypesChange,
    handleSearch,
    handleToggleItemSelection,
    handleTogglePageSelection,
    handleSortFieldChange,
    handleSortOrderChange,
    handlePageChange,
    handlePageSizeChange,
  };
}
