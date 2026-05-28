import { API_BASE_URL } from '@/shared/config/api';
import { getAuthHeaders } from '@/shared/lib/auth';

export type UserDto = {
  id: number;
  login: string;
  full_name: string;
  role_id: number;
  role_name: string | null;
  department_id: number;
  department_name: string | null;
  author_id: number | null;
  author_name: string | null;
  created_at?: string;
};

export type RoleDto = {
  id: number;
  name: string;
};

export type DepartmentDto = {
  id: number;
  name: string;
};

export type AuthorDto = {
  id: number;
  name: string;
  department_id: number | null;
  linked_user_id: number | null;
  linked_user_login: string | null;
  is_available: boolean;
};

export type CreateUserPayload = {
  login: string;
  password: string;
  full_name: string;
  role_id: number;
  department_id: number;
  author_id: number | null;
};

export type UpdateUserPayload = {
  login?: string;
  password?: string;
  full_name?: string;
  role_id?: number;
  department_id?: number;
  author_id?: number | null;
};

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data?.detail === 'string') {
      return data.detail;
    }
  } catch {
    // ignore
  }

  return `Request failed with status ${response.status}`;
}

function buildJsonHeaders(): HeadersInit {
  return {
    accept: 'application/json',
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
}

function buildHeaders(): HeadersInit {
  return {
    accept: 'application/json',
    ...getAuthHeaders(),
  };
}

export async function getAdminUsers(): Promise<UserDto[]> {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function getAdminRoles(): Promise<RoleDto[]> {
  const response = await fetch(`${API_BASE_URL}/admin/roles`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function getAdminDepartments(): Promise<DepartmentDto[]> {
  const response = await fetch(`${API_BASE_URL}/admin/departments`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function getAdminAuthors(params?: {
  availableOnly?: boolean;
  userId?: number;
}): Promise<AuthorDto[]> {
  const searchParams = new URLSearchParams();

  if (typeof params?.availableOnly === 'boolean') {
    searchParams.set('available_only', String(params.availableOnly));
  }

  if (typeof params?.userId === 'number') {
    searchParams.set('user_id', String(params.userId));
  }

  const query = searchParams.toString();
  const url = query
    ? `${API_BASE_URL}/admin/authors?${query}`
    : `${API_BASE_URL}/admin/authors`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function createAdminUser(
  payload: CreateUserPayload,
): Promise<UserDto> {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function updateAdminUser(
  userId: number,
  payload: UpdateUserPayload,
): Promise<UserDto> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'PUT',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export async function deleteAdminUser(userId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}