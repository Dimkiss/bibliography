import { API_BASE_URL } from '@/shared/config/api';
import { getAuthHeaders } from '@/shared/lib/auth';
import type {
  PublicationsResponseDto,
  PublicationSortOrder,
} from '@/entities/publication';

export type AuthorFullDto = {
  id: number;
  name: string;
  position: string | null;
  degree: string | null;
  rank: string | null;
  email: string | null;
  type: string | null;
  birthdate: string | null;
  birth_year: number | null;
  nickname: string | null;
  status: number | null;
  search_pattern: string | null;
  external_id: number | null;
  snils_last4: string | null;
  wos_id: string | null;
  scopus_id: string | null;
  orcid: string | null;
  department_id: number | null;
  department_name: string | null;
  linked_user_id: number | null;
  linked_user_login: string | null;
  is_available: boolean;
};

export type CreateAuthorPayload = {
  authorName: string;
  position?: string | null;
  degree?: string | null;
  rank?: string | null;
  email?: string | null;
  type?: string | null;
  birthdate?: string | null;
  birth_year?: number | null;
  nickname?: string | null;
  status?: number | null;
  search_pattern?: string | null;
  external_id?: number | null;
  WOS_ID?: string | null;
  Scopus_ID?: string | null;
  ORCID?: string | null;
  DepartmentCode?: number | null;
};

export type UpdateAuthorPayload = {
  authorName?: string;
  position?: string | null;
  degree?: string | null;
  rank?: string | null;
  email?: string | null;
  type?: string | null;
  birthdate?: string | null;
  birth_year?: number | null;
  nickname?: string | null;
  status?: number | null;
  search_pattern?: string | null;
  external_id?: number | null;
  WOS_ID?: string | null;
  Scopus_ID?: string | null;
  ORCID?: string | null;
  DepartmentCode?: number | null;
};

export type AuthorPublicationsSortField = 'year' | 'title' | 'journal' | 'quartile';

export type GetAuthorPublicationsParams = {
  page?: number;
  pageSize?: number;
  yearFrom?: number | null;
  yearTo?: number | null;
  textQuery?: string;
  publicationTypes?: string[];
  databases?: string[];
  originalTranslationMode?: string;
  sortBy?: AuthorPublicationsSortField;
  sortOrder?: PublicationSortOrder;
};

export type AuthorStatsDto = {
  total: number;
  wos_count: number;
  scopus_count: number;
  vak_count: number;
  white_list_count: number;
  if_total: number;
};

type AuthorsReportPayload = {
  author_ids: number[];
  year_from?: number | null;
  year_to?: number | null;
  article_ids?: number[] | null;
};

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') return data.detail;
  } catch {
    // ignore
  }
  return `Request failed with status ${response.status}`;
}

function buildJsonHeaders(): HeadersInit {
  return { accept: 'application/json', 'Content-Type': 'application/json', ...getAuthHeaders() };
}

function buildHeaders(): HeadersInit {
  return { accept: 'application/json', ...getAuthHeaders() };
}

function buildReportHeaders(): HeadersInit {
  return {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ...getAuthHeaders(),
  };
}

function buildReportJsonHeaders(): HeadersInit {
  return {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
}

function getDownloadFilename(response: Response, fallback: string): string {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return fallback;
    }
  }

  const match = /filename="([^"]+)"/.exec(disposition);
  return match ? match[1] : fallback;
}

async function downloadResponseBlob(
  response: Response,
  fallbackFilename: string,
): Promise<void> {
  if (!response.ok) throw new Error(await parseErrorMessage(response));

  const blob = await response.blob();
  const filename = getDownloadFilename(response, fallbackFilename);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function buildAuthorReportQuery(
  yearFrom?: number | null,
  yearTo?: number | null,
  articleIds?: number[] | null,
): string {
  const sp = new URLSearchParams();
  if (typeof yearFrom === 'number') sp.set('year_from', String(yearFrom));
  if (typeof yearTo === 'number') sp.set('year_to', String(yearTo));
  if (articleIds && articleIds.length > 0) {
    articleIds.forEach((id) => sp.append('article_ids', String(id)));
  }
  const query = sp.toString();
  return query ? `?${query}` : '';
}

async function downloadAuthorsReport(
  endpoint: string,
  payload: AuthorsReportPayload,
  fallbackFilename: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: buildReportJsonHeaders(),
    body: JSON.stringify(payload),
  });
  await downloadResponseBlob(response, fallbackFilename);
}

export async function getAdminAuthorsFull(params?: {
  departmentId?: number | null;
}): Promise<AuthorFullDto[]> {
  const sp = new URLSearchParams();
  if (typeof params?.departmentId === 'number') {
    sp.set('department_id', String(params.departmentId));
  }
  const query = sp.toString();
  const url = query
    ? `${API_BASE_URL}/admin/authors-manage?${query}`
    : `${API_BASE_URL}/admin/authors-manage`;
  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json();
}

export async function getAdminAuthorFull(authorId: number): Promise<AuthorFullDto> {
  const response = await fetch(`${API_BASE_URL}/admin/authors-manage/${authorId}`, {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json();
}

export async function getAdminAuthorPublications(
  authorId: number,
  params: GetAuthorPublicationsParams = {},
): Promise<PublicationsResponseDto> {
  const sp = new URLSearchParams();

  if (typeof params.page === 'number') sp.set('page', String(params.page));
  if (typeof params.pageSize === 'number') sp.set('page_size', String(params.pageSize));
  if (typeof params.yearFrom === 'number') sp.set('year_from', String(params.yearFrom));
  if (typeof params.yearTo === 'number') sp.set('year_to', String(params.yearTo));
  if (params.textQuery?.trim()) sp.set('text_query', params.textQuery.trim());
  params.publicationTypes?.forEach((value) => {
    if (value.trim()) sp.append('publication_types', value.trim());
  });
  params.databases?.forEach((value) => {
    if (value.trim()) sp.append('databases', value.trim());
  });
  if (params.originalTranslationMode?.trim()) {
    sp.set('original_translation_mode', params.originalTranslationMode.trim());
  }
  if (params.sortBy) sp.set('sort_by', params.sortBy);
  if (params.sortOrder) sp.set('sort_order', params.sortOrder);

  const query = sp.toString();
  const url = `${API_BASE_URL}/admin/authors-manage/${authorId}/publications${
    query ? `?${query}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json();
}

export async function linkAdminAuthorPublication(
  authorId: number,
  articleId: number,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/admin/authors-manage/${authorId}/publications/${articleId}`,
    {
      method: 'POST',
      headers: buildHeaders(),
    },
  );
  if (!response.ok) throw new Error(await parseErrorMessage(response));
}

export async function getAdminAuthorStats(
  authorId: number,
  yearFrom?: number | null,
  yearTo?: number | null,
  textQuery?: string,
  publicationTypes?: string[],
  databases?: string[],
  originalTranslationMode?: string,
): Promise<AuthorStatsDto> {
  const sp = new URLSearchParams();
  if (typeof yearFrom === 'number') sp.set('year_from', String(yearFrom));
  if (typeof yearTo === 'number') sp.set('year_to', String(yearTo));
  if (textQuery?.trim()) sp.set('text_query', textQuery.trim());
  publicationTypes?.forEach((value) => {
    if (value.trim()) sp.append('publication_types', value.trim());
  });
  databases?.forEach((value) => {
    if (value.trim()) sp.append('databases', value.trim());
  });
  if (originalTranslationMode?.trim()) {
    sp.set('original_translation_mode', originalTranslationMode.trim());
  }

  const query = sp.toString();
  const url = `${API_BASE_URL}/admin/authors-manage/${authorId}/stats${
    query ? `?${query}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json();
}

export async function createAdminAuthor(payload: CreateAuthorPayload): Promise<AuthorFullDto> {
  const response = await fetch(`${API_BASE_URL}/admin/authors-manage`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json();
}

export async function updateAdminAuthor(
  authorId: number,
  payload: UpdateAuthorPayload,
): Promise<AuthorFullDto> {
  const response = await fetch(`${API_BASE_URL}/admin/authors-manage/${authorId}`, {
    method: 'PUT',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json();
}

export async function deleteAdminAuthor(authorId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/authors-manage/${authorId}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
}

export async function downloadAdminAuthorPublicationsReport(
  authorId: number,
  yearFrom?: number | null,
  yearTo?: number | null,
  articleIds?: number[] | null,
): Promise<void> {
  const query = buildAuthorReportQuery(yearFrom, yearTo, articleIds);
  const response = await fetch(
    `${API_BASE_URL}/admin/reports/author/${authorId}/publications${query}`,
    {
      method: 'GET',
      headers: buildReportHeaders(),
    },
  );
  await downloadResponseBlob(response, 'author-publications.xlsx');
}

export async function downloadAdminAuthorsPublicationsReport(
  authorIds: number[],
  yearFrom?: number | null,
  yearTo?: number | null,
): Promise<void> {
  await downloadAuthorsReport(
    '/admin/reports/authors/publications',
    {
      author_ids: authorIds,
      year_from: yearFrom,
      year_to: yearTo,
    },
    'authors-publications.xlsx',
  );
}

export async function downloadAdminAuthorsSummaryReport(
  authorIds: number[],
  yearFrom?: number | null,
  yearTo?: number | null,
): Promise<void> {
  await downloadAuthorsReport(
    '/admin/reports/authors/summary',
    {
      author_ids: authorIds,
      year_from: yearFrom,
      year_to: yearTo,
    },
    'authors-summary.xlsx',
  );
}

export async function downloadAdminAuthorsExportReport(
  authorIds: number[],
): Promise<void> {
  await downloadAuthorsReport(
    '/admin/reports/authors/export',
    { author_ids: authorIds },
    'authors.xlsx',
  );
}
