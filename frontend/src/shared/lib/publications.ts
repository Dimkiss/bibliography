import type {
  GetPublicationsParams,
  PublicationListItemDto,
  PublicationSortField,
  PublicationSortOrder,
  RelatedPublicationDto,
} from '@/shared/api/publications';

export type SearchFieldKey = 'author' | 'title' | 'journal' | 'keyword';

export type PublicationSearchFormState = {
  yearFrom: string;
  yearTo: string;
  author: string;
  title: string;
  journal: string;
  keyword: string;
  publicationTypes: string[];
  databases: string[];
  originalTranslationMode: string;
};

export const SEARCH_FIELD_OPTIONS: Array<{ key: SearchFieldKey; label: string }> = [
  { key: 'author', label: 'Автор' },
  { key: 'title', label: 'Название' },
  { key: 'journal', label: 'Издание' },
  { key: 'keyword', label: 'Ключевые слова' },
];

export const INITIAL_PUBLICATION_SEARCH_FORM: PublicationSearchFormState = {
  yearFrom: '',
  yearTo: '',
  author: '',
  title: '',
  journal: '',
  keyword: '',
  publicationTypes: [],
  databases: [],
  originalTranslationMode: 'all',
};

export type PublicationsSortFieldValue = PublicationSortField;

export const PUBLICATIONS_SORT_FIELD_OPTIONS: Array<{
  value: PublicationsSortFieldValue;
  label: string;
}> = [
  { value: 'authors', label: 'Авторы' },
  { value: 'title', label: 'Название' },
  { value: 'journal', label: 'Издание' },
  { value: 'year', label: 'Год' },
  { value: 'doi', label: 'DOI' },
  { value: 'quartile', label: 'Квартиль' },
];

export function normalizeJournalName(journal?: string | null): string {
  return (journal ?? '').replace(/^\/\//, '').trim();
}

export function buildDoiUrl(doi?: string | null): string | null {
  const normalized = doi?.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  return `https://doi.org/${normalized}`;
}

export function formatSearchFieldLabel(field: SearchFieldKey): string {
  return SEARCH_FIELD_OPTIONS.find((option) => option.key === field)?.label ?? field;
}

export function buildPublicationsQueryFromForm(
  form: PublicationSearchFormState,
  activeFields: SearchFieldKey[],
  page: number,
  pageSize: number,
  sortBy: PublicationSortField,
  sortOrder: PublicationSortOrder,
): GetPublicationsParams {
  const query: GetPublicationsParams = {
    page,
    pageSize,
    publicationTypes: form.publicationTypes,
    databases: form.databases,
    originalTranslationMode: form.originalTranslationMode,
    sortBy,
    sortOrder,
  };

  if (form.yearFrom.trim()) {
    query.yearFrom = Number(form.yearFrom);
  }

  if (form.yearTo.trim()) {
    query.yearTo = Number(form.yearTo);
  }

  activeFields.forEach((field) => {
    const value = form[field].trim();

    if (!value) {
      return;
    }

    query[field] = value;
  });

  return query;
}

export function getPublicationSubtitle(item: PublicationListItemDto): string {
  const parts = [normalizeJournalName(item.journal), item.year ? String(item.year) : '']
    .map((part) => part?.trim())
    .filter(Boolean);

  return parts.join(' · ');
}

export function formatOriginalTranslationLabel(value?: string | null): string | null {
  switch (value) {
    case 'original':
      return 'Оригинал';
    case 'translation':
      return 'Перевод';
    default:
      return null;
  }
}

export function formatDisplayDate(dateString?: string | null): string {
  if (!dateString) {
    return '—';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

export function formatRelatedPublicationTitle(
  item: RelatedPublicationDto,
): string {
  return item.relation_type === 'original'
    ? 'Оригинальная версия'
    : 'Переводная версия';
}