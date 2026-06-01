import { API_BASE_URL } from '@/shared/config/api';

export type EditionKind = 'periodical' | 'nonperiodical';

export type EditionListItemDto = {
  id: string;
  source_id: number;
  kind: EditionKind;
  title: string | null;
  identifier: string | null;
  identifier_label: string;
  year: number | null;
  publication_type: string | null;
  contributors: string | null;
  contributors_label: string | null;
  publisher: string | null;
  place: string | null;
  tirage: string | null;
  white_list_level: string | null;
  wos_quartile: string | null;
  scopus_quartile: string | null;
  white_list_levels: EditionMetricHistoryItemDto[];
  wos_quartiles: EditionMetricHistoryItemDto[];
  scopus_quartiles: EditionMetricHistoryItemDto[];
  rinc: boolean;
  vak: boolean;
  publication_count: number;
};

export type EditionMetricHistoryItemDto = {
  year: number;
  value: string | null;
};

export type EditionDetailMetricDto = {
  year: number;
  white_list_level: string | null;
  wos_quartile: string | null;
  impact_factor: string | null;
  five_year_if: string | null;
  scopus_quartile: string | null;
  wos: boolean;
  scopus: boolean;
  rinc: boolean;
  rinc_core: boolean;
  rsci: boolean;
  foreign: boolean;
  vak: boolean;
};

export type EditionPublicationDto = {
  id: number;
  title: string | null;
  authors: string | null;
  doi: string | null;
  year: number | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  has_pdf: boolean;
};

export type RelatedEditionDto = {
  kind: EditionKind;
  source_id: number;
  title: string | null;
  identifier: string | null;
};

export type EditionDetailDto = {
  id: string;
  source_id: number;
  kind: EditionKind;
  title: string | null;
  identifier: string | null;
  identifier_label: string;
  year: number | null;
  publication_type: string | null;
  contributors: string | null;
  contributors_label: string | null;
  date_of_meeting: string | null;
  publisher: string | null;
  place: string | null;
  tirage: string | null;
  insert_date: string | null;
  metrics: EditionDetailMetricDto[];
  publications: EditionPublicationDto[];
  related_editions: RelatedEditionDto[];
};

export type EditionsPaginationDto = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type EditionsResponseDto = {
  items: EditionListItemDto[];
  pagination: EditionsPaginationDto;
};

export type EditionFilterOptionDto = {
  value: string;
  label: string;
};

export type EditionFiltersDto = {
  year_min: number | null;
  year_max: number | null;
  metric_levels: EditionFilterOptionDto[];
  edition_types: EditionFilterOptionDto[];
};

export type EditionSortField =
  | 'title'
  | 'issn'
  | 'isbn'
  | 'white_list'
  | 'wos'
  | 'scopus'
  | 'rinc'
  | 'vak'
  | 'type'
  | 'year'
  | 'tirage';

export type EditionSortOrder = 'asc' | 'desc';

export type GetEditionsParams = {
  kind?: EditionKind;
  page?: number;
  pageSize?: number;
  query?: string;
  yearFrom?: number | null;
  yearTo?: number | null;
  metricLevels?: string[];
  editionTypes?: string[];
  sortBy?: EditionSortField;
  sortOrder?: EditionSortOrder;
  includeTotal?: boolean;
  knownTotal?: number;
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

export async function getEditionFilters(): Promise<EditionFiltersDto> {
  const response = await fetch(`${API_BASE_URL}/editions/filters`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function getEditions(
  params: GetEditionsParams = {},
): Promise<EditionsResponseDto> {
  const searchParams = new URLSearchParams();

  if (params.kind) {
    searchParams.set('kind', params.kind);
  }

  if (typeof params.page === 'number') {
    searchParams.set('page', String(params.page));
  }

  if (typeof params.pageSize === 'number') {
    searchParams.set('page_size', String(params.pageSize));
  }

  if (params.query?.trim()) {
    searchParams.set('query', params.query.trim());
  }

  if (typeof params.yearFrom === 'number') {
    searchParams.set('year_from', String(params.yearFrom));
  }

  if (typeof params.yearTo === 'number') {
    searchParams.set('year_to', String(params.yearTo));
  }

  params.metricLevels?.forEach((value) => {
    if (value.trim()) {
      searchParams.append('metric_levels', value);
    }
  });

  params.editionTypes?.forEach((value) => {
    if (value.trim()) {
      searchParams.append('edition_types', value);
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
    ? `${API_BASE_URL}/editions?${queryString}`
    : `${API_BASE_URL}/editions`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function getEditionDetail(
  kind: EditionKind,
  sourceId: number,
): Promise<EditionDetailDto> {
  const response = await fetch(`${API_BASE_URL}/editions/${kind}/${sourceId}`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}
