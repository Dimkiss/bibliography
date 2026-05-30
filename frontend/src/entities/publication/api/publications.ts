import { AI_API_BASE_URL, API_BASE_URL } from '@/shared/config/api';
import { getAuthHeaders } from '@/shared/lib/auth';

export type PublicationPreviewDto = {
  id: number;
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
};

export type PublicationListItemDto = PublicationPreviewDto & {
  bibliographic_reference: string;
  quartile: string | null;
  quartile_scopus: string | null;
  publication_types: string[];
  databases: string[];
  original_translation: string | null;
  has_pdf: boolean;
  found_in_metadata: boolean;
  found_in_pdf: boolean;
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
  | 'relevance'
  | 'authors'
  | 'title'
  | 'journal'
  | 'year'
  | 'doi'
  | 'quartile';

export type PublicationSortOrder = 'asc' | 'desc';

export type PublicationMetricDto = {
  label: string;
  value: string | null;
  extra: string | null;
  enabled: boolean;
};

export type RelatedPublicationDto = {
  id: number;
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  relation_type: 'original' | 'translation';
  has_pdf: boolean;
};

export type PublicationDetailDto = {
  id: number;
  title: string | null;
  authors: string | null;
  abstract: string | null;
  doi: string | null;
  bibliographic_reference: string;
  journal: string | null;
  edition_kind: 'periodical' | 'nonperiodical' | null;
  edition_source_id: number | null;
  year: number | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publication_date: string | null;
  insert_date: string | null;
  publication_types: string[];
  keywords: string[];
  metrics: PublicationMetricDto[];
  related_articles: RelatedPublicationDto[];
  has_pdf: boolean;
};

export type GetPublicationsParams = {
  page?: number;
  pageSize?: number;
  textQuery?: string;
  refineTextQuery?: string;
  pdfTextQuery?: string;
  title?: string;
  author?: string;
  journal?: string;
  keyword?: string | string[];
  yearFrom?: number | null;
  yearTo?: number | null;
  publicationTypes?: string[];
  databases?: string[];
  originalTranslationMode?: string;
  articleIds?: number[];
  ragArticleIds?: number[];
  sortBy?: PublicationSortField;
  sortOrder?: PublicationSortOrder;
  includeTotal?: boolean;
  knownTotal?: number;
};

export type AiPublicationSearchPlanFiltersDto = {
  text_query: string | null;
  refine_text_query: string | null;
  pdf_text_query: string | null;
  title: string | null;
  author: string | null;
  journal: string | null;
  keyword: string[];
  year_from: number | null;
  year_to: number | null;
  publication_types: string[];
  databases: string[];
  original_translation_mode: 'all' | 'original_only' | 'translation_only';
  article_ids: number[];
};

export type AiPublicationSearchPlanDto = {
  intent: 'search' | 'clarify';
  explanation: string;
  filters: AiPublicationSearchPlanFiltersDto;
  semantic: {
    query: string | null;
    scope: 'metadata' | 'pdf' | 'metadata_and_pdf';
  };
  sort: {
    by: PublicationSortField;
    order: PublicationSortOrder;
  };
};

export type AiPublicationRagChunkMatchDto = {
  article_id: number;
  page_number: number;
  chunk_index: number;
  score: number;
  text: string;
};

export type AiPublicationRagSearchDto = {
  plan: AiPublicationSearchPlanDto;
  retrieval: {
    status: 'ok' | 'skipped' | 'disabled' | 'error' | string;
    query: string | null;
    article_ids: number[];
    matches: AiPublicationRagChunkMatchDto[];
    error: string | null;
  };
};

function splitSearchValues(value: string): string[] {
  return value
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(
      (item, index, array) =>
        array.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index,
    );
}

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

  if (params.textQuery?.trim()) {
    searchParams.set('text_query', params.textQuery.trim());
  }

  if (params.refineTextQuery?.trim()) {
    searchParams.set('refine_text_query', params.refineTextQuery.trim());
  }

  if (params.pdfTextQuery?.trim()) {
    searchParams.set('pdf_text_query', params.pdfTextQuery.trim());
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

  const keywordValues = Array.isArray(params.keyword)
    ? params.keyword
    : splitSearchValues(params.keyword ?? '');

  keywordValues.forEach((value) => {
    if (value.trim()) {
      searchParams.append('keyword', value.trim());
    }
  });

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

  params.articleIds?.forEach((value) => {
    if (Number.isInteger(value) && value > 0) {
      searchParams.append('article_ids', String(value));
    }
  });

  params.ragArticleIds?.forEach((value) => {
    if (Number.isInteger(value) && value > 0) {
      searchParams.append('rag_article_ids', String(value));
    }
  });

  if (params.sortBy) {
    searchParams.set('sort_by', params.sortBy);
  }

  if (params.sortOrder) {
    searchParams.set('sort_order', params.sortOrder);
  }

  if (typeof params.includeTotal === 'boolean') {
    searchParams.set('include_total', String(params.includeTotal));
  }

  if (typeof params.knownTotal === 'number') {
    searchParams.set('known_total', String(params.knownTotal));
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

export async function createAiPublicationSearchPlan(
  message: string,
  currentFilters?: AiPublicationSearchPlanFiltersDto,
): Promise<AiPublicationSearchPlanDto> {
  const response = await fetch(`${AI_API_BASE_URL}/ai/publications/search-plan`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message, current_filters: currentFilters ?? null }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function createAiPublicationRagSearch(
  message: string,
  currentFilters?: AiPublicationSearchPlanFiltersDto,
): Promise<AiPublicationRagSearchDto> {
  const response = await fetch(`${AI_API_BASE_URL}/ai/publications/rag-search`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message,
      current_filters: currentFilters ?? null,
      limit: 30,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function getPublicationDetail(
  articleId: number,
): Promise<PublicationDetailDto> {
  const response = await fetch(`${API_BASE_URL}/articles/${articleId}`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export function getPublicationPdfUrl(articleId: number): string {
  return `${API_BASE_URL}/articles/${articleId}/pdf`;
}

export async function deleteAdminArticle(articleId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/articles/${articleId}`, {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}
