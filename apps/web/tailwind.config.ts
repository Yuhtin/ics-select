import type { Config } from 'tailwindcss';
import { heroui } from '@heroui/react';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          muted: 'hsl(var(--surface-muted) / <alpha-value>)',
          subtle: 'hsl(var(--surface-subtle) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--border) / <alpha-value>)',
          strong: 'hsl(var(--border-strong) / <alpha-value>)',
        },
        'foreground-muted': 'hsl(var(--foreground-muted) / <alpha-value>)',
        'foreground-subtle': 'hsl(var(--foreground-subtle) / <alpha-value>)',
        brand: {
          DEFAULT: 'hsl(var(--brand) / <alpha-value>)',
          hover: 'hsl(var(--brand-hover) / <alpha-value>)',
          soft: 'hsl(var(--brand-soft) / <alpha-value>)',
          'soft-foreground': 'hsl(var(--brand-soft-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          soft: 'hsl(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          soft: 'hsl(var(--warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
          soft: 'hsl(var(--danger-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          soft: 'hsl(var(--info-soft) / <alpha-value>)',
        },
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        sm: '0 2px 4px -1px rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)',
        md: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
        brand: '0 8px 24px -4px rgb(24 160 251 / 0.25), 0 4px 8px -2px rgb(24 160 251 / 0.15)',
      },
      // Sem override em borderRadius — defaults do Tailwind (md=6px, lg=8px, xl=12px) batem com a spec.
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: '#fbfbfe',
            foreground: '#0f172a',
            divider: '#e5e7eb',
            focus: '#18a0fb',
            content1: '#ffffff',
            content2: '#f5f6f8',
            content3: '#f0f1f4',
            content4: '#e5e7eb',
            default: {
              50: '#fbfbfe',
              100: '#f5f6f8',
              200: '#e5e7eb',
              300: '#d1d5db',
              400: '#94a3b8',
              500: '#64748b',
              600: '#475569',
              700: '#334155',
              800: '#1e293b',
              900: '#0f172a',
              DEFAULT: '#e5e7eb',
              foreground: '#0f172a',
            },
            // IMPORTANT: primary.DEFAULT (#18a0fb) fails WCAG AA as text on white (3.4:1).
            // Use brand only for backgrounds/borders/large icons (≥24px). For "brand-colored text",
            // use `brand-soft-foreground` (#0c4a6e, AAA) via the Tailwind token.
            primary: {
              50: '#e0f2fe',
              100: '#bae6fd',
              200: '#7dd3fc',
              300: '#38bdf8',
              400: '#18a0fb',
              500: '#0c8ce9',
              600: '#0369a1',
              700: '#075985',
              800: '#0c4a6e',
              900: '#082f49',
              DEFAULT: '#18a0fb',
              foreground: '#ffffff',
            },
            success: { DEFAULT: '#10b981', foreground: '#ffffff' },
            warning: { DEFAULT: '#f59e0b', foreground: '#0f172a' },
            danger: { DEFAULT: '#ef4444', foreground: '#ffffff' },
          },
          layout: {
            radius: { small: '0.375rem', medium: '0.5rem', large: '0.75rem' },
            fontSize: { small: '0.8125rem', medium: '0.9375rem', large: '1.0625rem' },
          },
        },
      },
    }),
  ],
};

export default config;
