import { API_BASE_URL } from '@/shared/config/api';

export type PublicationPreviewDto = {
  id: number;
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
};

export type PublicationListItemDto = PublicationPreviewDto & {
  quartile: string | null;
  quartile_scopus: string | null;
  publication_types: string[];
  databases: string[];
  original_translation: string | null;
};

export type PublicationsPaginationDto = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type PublicationsResponseDto = {
  items: PublicationListItemDto[];
  pagination: PublicationsPaginationDto;
};

export type FilterOptionDto = {
  value: string;
  label: string;
};

export type PublicationFiltersDto = {
  year_min: number | null;
  year_max: number | null;
  publication_types: FilterOptionDto[];
  databases: FilterOptionDto[];
  original_translation_modes: FilterOptionDto[];
};

export type PublicationSortField =
  | 'authors'
  | 'title'
  | 'journal'
  | 'year'
  | 'doi'
  | 'quartile';

export type PublicationSortOrder = 'asc' | 'desc';

export type GetPublicationsParams = {
  page?: number;
  pageSize?: number;
  title?: string;
  author?: string;
  journal?: string;
  keyword?: string;
  yearFrom?: number | null;
  yearTo?: number | null;
  publicationTypes?: string[];
  databases?: string[];
  originalTranslationMode?: string;
  sortBy?: PublicationSortField;
  sortOrder?: PublicationSortOrder;
};

type RawLatestPublicationDto = {
  id?: number;
  Record_ID?: number;
  title?: string | null;
  authors?: string | null;
  journal?: string | null;
  year?: number | null;
  doi?: string | null;
  DOI?: string | null;
};

function buildHeaders(): HeadersInit {
  return {
    accept: 'application/json',
  };
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data?.detail === 'string') {
      return data.detail;
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }
  } catch {
    // ignore
  }

  return `Request failed with status ${response.status}`;
}

function normalizePreviewItem(item: RawLatestPublicationDto): PublicationPreviewDto {
  return {
    id: item.id ?? item.Record_ID ?? 0,
    title: item.title ?? null,
    authors: item.authors ?? null,
    journal: item.journal ?? null,
    year: item.year ?? null,
    doi: item.doi ?? item.DOI ?? null,
  };
}

export async function getLatestPublications(
  limit = 5,
): Promise<PublicationPreviewDto[]> {
  const response = await fetch(`${API_BASE_URL}/articles/latest?limit=${limit}`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = (await response.json()) as RawLatestPublicationDto[];
  return data.map(normalizePreviewItem);
}

export async function getPublicationFilters(): Promise<PublicationFiltersDto> {
  const response = await fetch(`${API_BASE_URL}/articles/filters`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function getPublications(
  params: GetPublicationsParams = {},
): Promise<PublicationsResponseDto> {
  const searchParams = new URLSearchParams();

  if (typeof params.page === 'number') {
    searchParams.set('page', String(params.page));
  }

  if (typeof params.pageSize === 'number') {
    searchParams.set('page_size', String(params.pageSize));
  }

  if (params.title?.trim()) {
    searchParams.set('title', params.title.trim());
  }

  if (params.author?.trim()) {
    searchParams.set('author', params.author.trim());
  }

  if (params.journal?.trim()) {
    searchParams.set('journal', params.journal.trim());
  }

  if (params.keyword?.trim()) {
    searchParams.set('keyword', params.keyword.trim());
  }

  if (typeof params.yearFrom === 'number') {
    searchParams.set('year_from', String(params.yearFrom));
  }

  if (typeof params.yearTo === 'number') {
    searchParams.set('year_to', String(params.yearTo));
  }

  params.publicationTypes?.forEach((value) => {
    if (value.trim()) {
      searchParams.append('publication_types', value);
    }
  });

  params.databases?.forEach((value) => {
    if (value.trim()) {
      searchParams.append('databases', value);
    }
  });

  if (params.originalTranslationMode?.trim()) {
    searchParams.set(
      'original_translation_mode',
      params.originalTranslationMode.trim(),
    );
  }

  if (params.sortBy) {
    searchParams.set('sort_by', params.sortBy);
  }

  if (params.sortOrder) {
    searchParams.set('sort_order', params.sortOrder);
  }

  const queryString = searchParams.toString();
  const url = queryString
    ? `${API_BASE_URL}/articles?${queryString}`
    : `${API_BASE_URL}/articles`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}