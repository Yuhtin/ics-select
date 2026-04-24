'use client';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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
  const value = useMemo<Ctx>(
    () => ({
      error,
      setError: (patch) => setErrorState((prev) => ({ ...prev, ...patch })),
    }),
    [error],
  );
  return (
    <SettingsErrorContext.Provider value={value}>{children}</SettingsErrorContext.Provider>
  );
}

export function useSettingsError() {
  return useContext(SettingsErrorContext);
}
