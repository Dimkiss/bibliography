import { API_BASE_URL } from '@/shared/config/api';
import { getAuthHeaders } from '@/shared/lib/auth';

export type AdminPeriodicalMetricDto = {
  j_id: number;
  year: number;
  impact_factor: string | null;
  five_year_if: string | null;
  wos_quartile: string | null;
  scopus_quartile: string | null;
  white_list_level: number | null;
  wos: boolean;
  scopus: boolean;
  rinc: boolean;
  rinc_core: boolean;
  rsci: boolean;
  foreign: boolean;
  vak: boolean;
};

export type AdminPeriodicalEditionDto = {
  source_id: number;
  title: string;
  issn: string | null;
  is_if: boolean;
  wos_name: string | null;
  elibrary_name: string | null;
  is_translation: boolean;
  comment: string | null;
  metrics: AdminPeriodicalMetricDto[];
};

export type AdminPeriodicalMetricPayload = {
  j_id?: number | null;
  year: number;
  impact_factor?: string | null;
  five_year_if?: string | null;
  wos_quartile?: string | null;
  scopus_quartile?: string | null;
  white_list_level?: number | null;
  wos?: boolean;
  scopus?: boolean;
  rinc?: boolean;
  rinc_core?: boolean;
  rsci?: boolean;
  foreign?: boolean;
  vak?: boolean;
};

export type AdminPeriodicalEditionPayload = {
  title: string;
  issn?: string | null;
  is_if?: boolean;
  wos_name?: string | null;
  elibrary_name?: string | null;
  is_translation?: boolean;
  comment?: string | null;
  metrics?: AdminPeriodicalMetricPayload[];
};

function buildAuthHeaders(): HeadersInit {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
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

export async function getAdminPeriodicalEditionForEdit(
  sourceId: number,
): Promise<AdminPeriodicalEditionDto> {
  const response = await fetch(
    `${API_BASE_URL}/admin/editions/periodical/${sourceId}/edit`,
    {
      method: 'GET',
      headers: buildAuthHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function createAdminPeriodicalEdition(
  payload: AdminPeriodicalEditionPayload,
): Promise<AdminPeriodicalEditionDto> {
  const response = await fetch(`${API_BASE_URL}/admin/editions/periodical`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function updateAdminPeriodicalEdition(
  sourceId: number,
  payload: AdminPeriodicalEditionPayload,
): Promise<AdminPeriodicalEditionDto> {
  const response = await fetch(
    `${API_BASE_URL}/admin/editions/periodical/${sourceId}`,
    {
      method: 'PUT',
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}
