import type {
  EditionKind,
  EditionSortField,
  EditionSortOrder,
  GetEditionsParams,
} from '../api/editions';

export type EditionSearchFormState = {
  query: string;
  yearFrom: string;
  yearTo: string;
  metricLevels: string[];
  editionTypes: string[];
};

export type EditionsSortFieldValue = EditionSortField;

export const INITIAL_EDITION_SEARCH_FORM: EditionSearchFormState = {
  query: '',
  yearFrom: '',
  yearTo: '',
  metricLevels: [],
  editionTypes: [],
};

export const EDITION_KIND_OPTIONS: Array<{
  value: EditionKind;
  label: string;
  iconName: string;
}> = [
  { value: 'periodical', label: 'Периодические', iconName: 'journal-outline' },
  { value: 'nonperiodical', label: 'Непериодические', iconName: 'book-outline' },
];

export const PERIODICAL_SORT_FIELD_OPTIONS: Array<{
  value: EditionsSortFieldValue;
  label: string;
}> = [
  { value: 'title', label: 'Название' },
  { value: 'issn', label: 'ISSN' },
  { value: 'white_list', label: 'БС' },
  { value: 'wos', label: 'Квартиль WoS' },
  { value: 'scopus', label: 'Квартиль Scopus' },
  { value: 'rinc', label: 'Наличие в РИНЦ' },
  { value: 'vak', label: 'Наличие в ВАК' },
];

export const NONPERIODICAL_SORT_FIELD_OPTIONS: Array<{
  value: EditionsSortFieldValue;
  label: string;
}> = [
  { value: 'title', label: 'Название' },
  { value: 'type', label: 'Тип издания' },
  { value: 'year', label: 'Год' },
];

export function getDefaultEditionSortField(
  kind: EditionKind,
): EditionsSortFieldValue {
  return kind === 'periodical' ? 'title' : 'year';
}

export function getDefaultEditionSortOrder(kind: EditionKind): EditionSortOrder {
  return kind === 'periodical' ? 'asc' : 'desc';
}

export function getEditionSortOptions(kind: EditionKind) {
  return kind === 'periodical'
    ? PERIODICAL_SORT_FIELD_OPTIONS
    : NONPERIODICAL_SORT_FIELD_OPTIONS;
}

export function cloneEditionSearchForm(
  form: EditionSearchFormState,
): EditionSearchFormState {
  return {
    ...form,
    metricLevels: [...form.metricLevels],
    editionTypes: [...form.editionTypes],
  };
}

export function hasEditionSearchCriteria(
  kind: EditionKind,
  form: EditionSearchFormState,
): boolean {
  if (form.query.trim() || form.yearFrom.trim() || form.yearTo.trim()) {
    return true;
  }

  return kind === 'periodical'
    ? form.metricLevels.some((value) => value.trim())
    : form.editionTypes.some((value) => value.trim());
}

export function buildEditionsQueryFromForm(
  kind: EditionKind,
  form: EditionSearchFormState,
  page: number,
  pageSize: number,
  sortBy: EditionSortField,
  sortOrder: EditionSortOrder,
): GetEditionsParams {
  const query: GetEditionsParams = {
    kind,
    page,
    pageSize,
    sortBy,
    sortOrder,
  };

  if (form.query.trim()) {
    query.query = form.query.trim();
  }

  if (form.yearFrom.trim()) {
    query.yearFrom = Number(form.yearFrom);
  }

  if (form.yearTo.trim()) {
    query.yearTo = Number(form.yearTo);
  }

  if (kind === 'periodical') {
    query.metricLevels = form.metricLevels;
  } else {
    query.editionTypes = form.editionTypes;
  }

  return query;
}

export function formatEditionPresence(value: boolean): string {
  return value ? 'Да' : 'Нет';
}

export function formatMetricValue(value?: string | null): string {
  return value?.trim() || '—';
}

export function formatWhiteListLevel(value?: string | null): string {
  const normalized = value?.trim();

  if (!normalized) {
    return '—';
  }

  return /^[1-4]$/.test(normalized) ? `УБС ${normalized}` : normalized;
}

export function buildEditionDetailsPath(kind: EditionKind, sourceId: number): string {
  return `/journals/${kind}/${sourceId}`;
}
