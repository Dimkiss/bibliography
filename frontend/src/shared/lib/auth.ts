const ACCESS_TOKEN_KEY = 'auth_access_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getAuthHeaders(token?: string): HeadersInit {
  const resolvedToken = token ?? getAccessToken();

  if (!resolvedToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${resolvedToken}`,
  };
}