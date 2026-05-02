'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type SettingsError = {
  hasOverlap: boolean;
};

type Ctx = {
  error: SettingsError;
  setError: (patch: Partial<SettingsError>) => void;
};

const SettingsErrorContext = createContext<Ctx>({
  error: { hasOverlap: false },
  setError: () => {},
});

export function SettingsErrorProvider({ children }: { children: ReactNode }) {
  const [error, setErrorState] = useState<SettingsError>({ hasOverlap: false });
  // Stable across renders — must not depend on `error`, otherwise consumers
  // putting `setError` in a useEffect dependency list will re-fire every time
  // setError is called, creating an infinite render loop (this happened on
  // /me/settings/availability and froze the page).
  const setError = useCallback(
    (patch: Partial<SettingsError>) => setErrorState((prev) => ({ ...prev, ...patch })),
    [],
  );
  const value = useMemo<Ctx>(() => ({ error, setError }), [error, setError]);
  return (
    <SettingsErrorContext.Provider value={value}>{children}</SettingsErrorContext.Provider>
  );
}

export function useSettingsError() {
  return useContext(SettingsErrorContext);
}
