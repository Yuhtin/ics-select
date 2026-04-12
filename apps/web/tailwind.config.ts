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
        brand: '0 8px 24px -4px rgb(0 90 180 / 0.25), 0 4px 8px -2px rgb(0 90 180 / 0.15)',
      },
      // Sem override em borderRadius — defaults do Tailwind (md=6px, lg=8px, xl=12px) batem com a spec.
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: '#f9f9ff',
            foreground: '#181c22',
            divider: '#c1c6d5',
            focus: '#005ab4',
            content1: '#ffffff',
            content2: '#f2f3fd',
            content3: '#ecedf7',
            content4: '#e0e2ec',
            default: {
              50: '#f9f9ff',
              100: '#f2f3fd',
              200: '#e0e2ec',
              300: '#c1c6d5',
              400: '#717785',
              500: '#5a6070',
              600: '#414753',
              700: '#303540',
              800: '#23272f',
              900: '#181c22',
              DEFAULT: '#e0e2ec',
              foreground: '#181c22',
            },
            // primary.DEFAULT (#005ab4) on white passes WCAG AA for normal text (ratio ~4.6:1).
            primary: {
              50: '#eef4ff',
              100: '#d6e3ff',
              200: '#aac7ff',
              300: '#7eaaff',
              400: '#4d8bf0',
              500: '#0873df',
              600: '#005ab4',
              700: '#00458d',
              800: '#003068',
              900: '#001b3e',
              DEFAULT: '#005ab4',
              foreground: '#ffffff',
            },
            success: { DEFAULT: '#10b981', foreground: '#ffffff' },
            warning: { DEFAULT: '#f59e0b', foreground: '#181c22' },
            danger:  { DEFAULT: '#ba1a1a', foreground: '#ffffff' },
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
