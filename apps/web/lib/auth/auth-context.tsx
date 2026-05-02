'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiErrorResponse, apiFetch, getAccessToken, setAccessToken } from '../api/client';

type User = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  privacyAcceptedAt: string | null;
  whatsappPhone: string | null;
  targetTrack: string | null;
  googleConnected: boolean;
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    getAccessToken();
    setHydrated(true);
  }, []);

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<User>('/me'),
    enabled: hydrated && !!getAccessToken(),
    retry: false,
  });

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    queryClient.clear();
    if (typeof window !== 'undefined') window.location.href = '/login';
  };

  // Auto-logout when /me declares the session invalid:
  //   401 — JWT expired AND refresh failed (apiFetch already retried internally).
  //   404 — JWT signature still valid, but the User row is gone (e.g., a prod
  //         data wipe). Without this, the member would land on a page that
  //         shows "Could not load…" with no way out, especially on mobile
  //         where the topbar logout button is hidden.
  // 5xx is left alone — that's a server issue, not an auth issue.
  const autoLogoutFiredRef = useRef(false);
  useEffect(() => {
    if (!error || autoLogoutFiredRef.current) return;
    if (!(error instanceof ApiErrorResponse)) return;
    if (error.status === 401 || error.status === 404) {
      autoLogoutFiredRef.current = true;
      void logout();
    }
    // logout is stable across renders (closes over queryClient which is stable),
    // so we intentionally omit it from deps to avoid re-firing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <AuthContext.Provider
      value={{
        user: data ?? null,
        isLoading: !hydrated || isLoading,
        logout,
        refetch: async () => {
          await refetch();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
