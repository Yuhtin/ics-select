'use client';

import { useEffect } from 'react';
import { useSceneStore } from './scene-store';

const PREVENT_DEFAULT_KEYS = new Set([
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ',
]);

export function useKeyboard() {
  const setKey = useSceneStore((s) => s.setKey);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (PREVENT_DEFAULT_KEYS.has(e.key.toLowerCase())) {
        e.preventDefault();
      }
      setKey(e.key, true);
    };
    const up = (e: KeyboardEvent) => setKey(e.key, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setKey]);
}
