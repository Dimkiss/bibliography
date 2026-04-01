import type {
  GetPublicationsParams,
  PublicationListItemDto,
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
): GetPublicationsParams {
  const query: GetPublicationsParams = {
    page,
    pageSize,
    publicationTypes: form.publicationTypes,
    databases: form.databases,
    originalTranslationMode: form.originalTranslationMode,
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