'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getAccessToken, setAccessToken } from '../api/client';

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

  const { data, isLoading, refetch } = useQuery({
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
