export const colors = {
  background: '#fbfbfe',
  surface: '#ffffff',
  surfaceMuted: '#f5f6f8',
  surfaceSubtle: '#f0f1f4',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  foreground: '#0f172a',
  foregroundMuted: '#475569',
  foregroundSubtle: '#94a3b8',

  brand: '#18a0fb',
  brandHover: '#0c8ce9',
  brandSoft: '#e0f2fe',
  brandSoftForeground: '#0c4a6e',

  success: '#10b981',
  successSoft: '#d1fae5',
  warning: '#f59e0b',
  warningSoft: '#fef3c7',
  danger: '#ef4444',
  dangerSoft: '#fee2e2',
  info: '#3b82f6',
  infoSoft: '#dbeafe',
} as const;

export const typography = {
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: {
    xs: '0.6875rem',
    sm: '0.8125rem',
    base: '0.9375rem',
    lg: '1.0625rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
} as const;

export const radius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  full: '9999px',
} as const;

export const shadows = {
  xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
  sm: '0 2px 4px -1px rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)',
  md: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
  brand: '0 8px 24px -4px rgb(24 160 251 / 0.25), 0 4px 8px -2px rgb(24 160 251 / 0.15)',
} as const;

export type Colors = typeof colors;
export type Typography = typeof typography;
