import { API_BASE_URL } from '@/shared/config/api';
import { getAuthHeaders } from '@/shared/lib/auth';

export type AuthorFullDto = {
  id: number;
  name: string;
  position: string | null;
  degree: string | null;
  rank: string | null;
  email: string | null;
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
  WOS_ID?: string | null;
  Scopus_ID?: string | null;
  ORCID?: string | null;
  DepartmentCode?: number | null;
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

export async function getAdminAuthorsFull(): Promise<AuthorFullDto[]> {
  const response = await fetch(`${API_BASE_URL}/admin/authors-manage`, {
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
