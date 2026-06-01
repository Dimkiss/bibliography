import { API_BASE_URL } from '@/shared/config/api';
import { getAuthHeaders } from '@/shared/lib/auth';
import type {
  PublicationsResponseDto,
  PublicationSortOrder,
} from '@/entities/publication';

export type ProfilePublicationsSortField = 'year' | 'title' | 'journal' | 'quartile';

export type GetProfilePublicationsParams = {
  page?: number;
  pageSize?: number;
  yearFrom?: number | null;
  yearTo?: number | null;
  textQuery?: string;
  publicationTypes?: string[];
  databases?: string[];
  originalTranslationMode?: string;
  sortBy?: ProfilePublicationsSortField;
  sortOrder?: PublicationSortOrder;
};

export type ProfileStatsDto = {
  total: number;
  wos_count: number;
  scopus_count: number;
  vak_count: number;
  white_list_count: number;
  if_total: number;
};

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data?.message === 'string') return data.message;
  } catch {
    // ignore
  }
  return `Request failed with status ${response.status}`;
}

export async function getProfilePublications(
  params: GetProfilePublicationsParams = {},
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

  const url = `${API_BASE_URL}/profile/publications?${sp.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function getProfileStats(
  yearFrom?: number | null,
  yearTo?: number | null,
  textQuery?: string,
  publicationTypes?: string[],
  databases?: string[],
  originalTranslationMode?: string,
): Promise<ProfileStatsDto> {
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

  const url = `${API_BASE_URL}/profile/stats?${sp.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export function getProfileReportUrl(
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
  const qs = sp.toString();
  return `${API_BASE_URL}/profile/report${qs ? `?${qs}` : ''}`;
}

export async function downloadProfileReport(
  yearFrom?: number | null,
  yearTo?: number | null,
  articleIds?: number[] | null,
): Promise<void> {
  const url = getProfileReportUrl(yearFrom, yearTo, articleIds);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match ? match[1] : 'report.xlsx';

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}
