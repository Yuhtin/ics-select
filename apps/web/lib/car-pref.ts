import { useEffect, useState } from 'react';
import { DEFAULT_CAR_ID } from '../components/member/map-3d/car-models';

const KEY = 'ics:car';

export function getCarPref(): string {
  if (typeof window === 'undefined') return DEFAULT_CAR_ID;
  return localStorage.getItem(KEY) ?? DEFAULT_CAR_ID;
}

export function setCarPref(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new CustomEvent('ics:car-pref', { detail: id }));
}

export function useCarPref(): [string, (id: string) => void] {
  const [id, setId] = useState<string>(DEFAULT_CAR_ID);

  useEffect(() => {
    setId(getCarPref());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setId(detail);
    };
    window.addEventListener('ics:car-pref', onChange);
    return () => window.removeEventListener('ics:car-pref', onChange);
  }, []);

  return [id, setCarPref];
}
