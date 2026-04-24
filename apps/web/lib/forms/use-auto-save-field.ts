'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

export type AutoSaveOptions<T> = {
  initial: T;
  save: (value: T) => void | Promise<unknown>;
  validate?: (value: T) => boolean;
  debounceMs?: number;
};

export type AutoSaveDriver<T> = {
  onChange: (value: T) => void;
  onBlur: () => void;
  dispose: () => void;
};

export function createAutoSaveDriver<T>(opts: AutoSaveOptions<T>): AutoSaveDriver<T> {
  const { save, validate, debounceMs = 800 } = opts;
  let pendingValue: T | undefined = undefined;
  let lastSaved: T | undefined = opts.initial;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pendingValue === undefined) return;
    const value = pendingValue;
    pendingValue = undefined;
    if (validate && !validate(value)) return;
    if (Object.is(value, lastSaved)) return;
    lastSaved = value;
    void save(value);
  };

  return {
    onChange(value: T) {
      pendingValue = value;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    },
    onBlur() { flush(); },
    dispose() { flush(); },
  };
}

export type UseAutoSaveField<T> = {
  value: T;
  onChange: (value: T) => void;
  onBlur: () => void;
  invalid: boolean;
};

export function useAutoSaveField<T>(opts: AutoSaveOptions<T>): UseAutoSaveField<T> {
  const [value, setValue] = useState<T>(opts.initial);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const driver = useMemo(
    () =>
      createAutoSaveDriver<T>({
        initial: opts.initial,
        save: (v) => optsRef.current.save(v),
        validate: (v) => (optsRef.current.validate ? optsRef.current.validate(v) : true),
        debounceMs: opts.debounceMs,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    return () => driver.dispose();
  }, [driver]);

  return {
    value,
    onChange: (v: T) => {
      setValue(v);
      driver.onChange(v);
    },
    onBlur: () => driver.onBlur(),
    invalid: opts.validate ? !opts.validate(value) : false,
  };
}
