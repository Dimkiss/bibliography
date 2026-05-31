import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { getMe, login as loginRequest } from '../api/auth';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@/shared/lib/auth';
import { AuthContext, type AuthContextValue } from './context';
import type { AuthUser, LoginPayload } from './types';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const logout = useCallback(() => {
    clearAccessToken();
    // Чистим кэш результатов поиска (публикации, издания, ИИ-чат),
    // чтобы данные предыдущего пользователя не оставались после выхода.
    window.sessionStorage.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setUser(null);
      return;
    }

    try {
      const currentUser = await getMe();
      setUser(currentUser);
    } catch {
      clearAccessToken();
      setUser(null);
    }
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginRequest(payload);
    setAccessToken(response.access_token);
    setUser(response.user);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const token = getAccessToken();

      if (!token) {
        if (isMounted) {
          setIsInitializing(false);
        }
        return;
      }

      try {
        const currentUser = await getMe();

        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        clearAccessToken();

        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      login,
      logout,
      refreshUser,
    }),
    [user, isInitializing, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
