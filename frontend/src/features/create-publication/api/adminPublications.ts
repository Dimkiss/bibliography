import { API_BASE_URL } from '@/shared/config/api';
import { getAuthHeaders } from '@/shared/lib/auth';
import { getPublications } from '@/entities/publication';
import { getEditions, type EditionListItemDto } from '@/entities/edition';

export type AdminPaginationDto = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type AdminOptionDto = {
  id: number;
  label: string;
};

export type JournalOptionDto = AdminOptionDto & {
  journal_name?: string | null;
  year?: number | null;
  quartile?: string | null;
  quartile_scopus?: string | null;
};

export type PublisherOptionDto = AdminOptionDto;

export type AuthorOptionDto = {
  id: number | null;
  label: string;
  source: 'employee' | 'publication_author';
  nickname: string | null;
  email: string | null;
  position: string | null;
  department_id: number | null;
  department_name: string | null;
};

export type AdminOptionListResponseDto<TItem> = {
  items: TItem[];
  pagination: AdminPaginationDto;
};

export type WorkFormTypeDto = {
  value: string;
  label: string | null;
  label_ru: string | null;
};

export type PublicationTypeDto = {
  value: string;
  label: string;
};

export type ArticleSearchItemDto = {
  id: number;
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
};

export type AdminEditionSourceDto = {
  id: string;
  source_id: number;
  label: string;
  meta: string;
};

export type ArticleSearchResponseDto = {
  items: ArticleSearchItemDto[];
  pagination: AdminPaginationDto;
};

export type SelectedAuthorPayloadDto = {
  author_id: number;
  affiliation: number;
  corresponding_author: boolean;
};

export type CreateAdminArticlePayload = {
  title: string;
  year: number;
  authors_text?: string | null;
  authors?: SelectedAuthorPayloadDto[];
  author_role?: string | null;
  abstract?: string | null;
  doi?: string | null;
  journal_id?: number | null;
  edition?: string | null;
  work_form_type?: string | null;
  medium_designator_id?: number | null;
  author_of_material?: string | null;
  title_of_material?: string | null;
  date_of_meeting?: string | null;
  place_of_meeting_id?: number | null;
  place_of_publication_id?: number | null;
  publisher_id?: number | null;
  publication_date?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  extent_of_work?: string | null;
  url?: string | null;
  issn?: string | null;
  isbn?: string | null;
  notes?: string | null;
  speaker?: string | null;
  publication_type_flags?: string[];
  keywords?: string[];
  department_codes?: number[];
  original_version_id?: number | null;
  translation_version_id?: number | null;
  article_language?: string | null;
  tirage?: string | null;
  wos_excluded?: boolean | null;
  scopus_excluded?: boolean | null;
  num_foreigners?: number | null;
  ship?: string | null;
};

type SearchListParams = {
  query?: string;
  all?: boolean;
  includeTotal?: boolean;
  page?: number;
  pageSize?: number;
};

function buildAuthHeaders(): HeadersInit {
  return {
    accept: 'application/json',
    ...getAuthHeaders(),
  };
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data?.detail === 'string') {
      return data.detail;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item: { msg?: string; loc?: unknown[] }) => {
          const path = Array.isArray(item?.loc) ? item.loc.join('.') : 'field';
          return `${path}: ${item?.msg ?? 'Validation error'}`;
        })
        .join('; ');
    }
  } catch {
    // ignore
  }

  return `Request failed with status ${response.status}`;
}

function makeSearchParams(params: {
  searchKey: 'search' | 'query';
  query?: string;
  all?: boolean;
  includeTotal?: boolean;
  page?: number;
  pageSize?: number;
}): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (params.query?.trim()) {
    searchParams.set(params.searchKey, params.query.trim());
  }

  if (params.all) {
    searchParams.set('all', 'true');
  } else {
    searchParams.set('page', String(params.page ?? 1));
    searchParams.set('page_size', String(params.pageSize ?? 20));
  }

  if (typeof params.includeTotal === 'boolean') {
    searchParams.set('include_total', String(params.includeTotal));
  }

  return searchParams;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function getAdminWorkFormTypes(): Promise<WorkFormTypeDto[]> {
  return getJson<WorkFormTypeDto[]>(`${API_BASE_URL}/admin/work-form-types`);
}

export async function getAdminPublicationTypes(
  workFormType?: string,
): Promise<PublicationTypeDto[]> {
  const searchParams = new URLSearchParams();

  if (workFormType?.trim()) {
    searchParams.set('work_form_type', workFormType.trim());
  }

  const queryString = searchParams.toString();
  const url = queryString
    ? `${API_BASE_URL}/admin/publication-types?${queryString}`
    : `${API_BASE_URL}/admin/publication-types`;

  return getJson<PublicationTypeDto[]>(url);
}

export async function getAdminAuthors(
  params: SearchListParams = {},
): Promise<AdminOptionListResponseDto<AuthorOptionDto>> {
  const searchParams = makeSearchParams({
    searchKey: 'search',
    query: params.query,
    all: params.all,
    includeTotal: params.includeTotal,
    page: params.page,
    pageSize: params.pageSize,
  });

  return getJson<AdminOptionListResponseDto<AuthorOptionDto>>(
    `${API_BASE_URL}/admin/article-authors?${searchParams.toString()}`,
  );
}

export async function getAdminJournals(
  params: SearchListParams = {},
): Promise<AdminOptionListResponseDto<JournalOptionDto>> {
  const searchParams = makeSearchParams({
    searchKey: 'search',
    query: params.query,
    all: params.all,
    page: params.page,
    pageSize: params.pageSize,
  });

  return getJson<AdminOptionListResponseDto<JournalOptionDto>>(
    `${API_BASE_URL}/admin/journals?${searchParams.toString()}`,
  );
}

export async function getAdminPublishers(
  params: SearchListParams = {},
): Promise<AdminOptionListResponseDto<PublisherOptionDto>> {
  const searchParams = makeSearchParams({
    searchKey: 'search',
    query: params.query,
    all: params.all,
    page: params.page,
    pageSize: params.pageSize,
  });

  return getJson<AdminOptionListResponseDto<PublisherOptionDto>>(
    `${API_BASE_URL}/admin/publishers?${searchParams.toString()}`,
  );
}

export async function getAdminRelatedArticles(
  params: SearchListParams = {},
): Promise<ArticleSearchResponseDto> {
  const searchParams = makeSearchParams({
    searchKey: 'query',
    query: params.query,
    all: params.all,
    page: params.page,
    pageSize: params.pageSize,
  });

  return getJson<ArticleSearchResponseDto>(
    `${API_BASE_URL}/admin/articles/search?${searchParams.toString()}`,
  );
}

export async function searchAdminJournals(query: string): Promise<AdminOptionDto[]> {
  const response = await getAdminJournals({
    query,
    page: 1,
    pageSize: 100,
    includeTotal: false,
  });

  return response.items.map((item) => ({
    id: item.id,
    label:
      [item.label, item.year ? String(item.year) : null].filter(Boolean).join(' · ') || item.label,
  }));
}

export async function searchAdminPublishers(query: string): Promise<AdminOptionDto[]> {
  const response = await getAdminPublishers({
    query,
    page: 1,
    pageSize: 20,
  });

  return response.items.map((item) => ({
    id: item.id,
    label: item.label,
  }));
}

export async function searchAdminArticles(query: string): Promise<ArticleSearchItemDto[]> {
  const response = await getPublications({
    title: query,
    page: 1,
    pageSize: 20,
    includeTotal: false,
    knownTotal: 0,
    sortBy: 'year',
    sortOrder: 'desc',
  });

  return response.items.map((item) => ({
    id: item.id,
    title: item.title,
    authors: item.authors,
    journal: item.journal,
    year: item.year,
    doi: item.doi,
  }));
}

function formatEditionSourceLabel(item: EditionListItemDto): string {
  return item.title?.trim() || `Издание #${item.source_id}`;
}

function formatEditionSourceMeta(item: EditionListItemDto): string {
  return [
    item.publication_type,
    item.contributors,
    item.publisher,
    item.year ? String(item.year) : null,
    item.identifier ? `${item.identifier_label}: ${item.identifier}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export async function searchAdminEditionSources(
  query: string,
  editionType: 'monograph' | 'conference',
): Promise<AdminEditionSourceDto[]> {
  const response = await getEditions({
    kind: 'nonperiodical',
    query,
    page: 1,
    pageSize: 20,
    editionTypes: [editionType],
    sortBy: 'title',
    sortOrder: 'asc',
    includeTotal: false,
  });

  return response.items.map((item) => ({
    id: item.id,
    source_id: item.source_id,
    label: formatEditionSourceLabel(item),
    meta: formatEditionSourceMeta(item),
  }));
}

export async function createAdminArticle(
  payload: CreateAdminArticlePayload,
): Promise<{ id: number }> {
  const response = await fetch(`${API_BASE_URL}/admin/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function uploadAdminArticlePdf(
  articleId: number,
  file: File,
): Promise<{ article_id: number; has_pdf: boolean }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/admin/articles/${articleId}/pdf`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}
