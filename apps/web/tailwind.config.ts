import type { Config } from 'tailwindcss';
import { heroui } from '@heroui/react';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../node_modules/.pnpm/@heroui+theme@*/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
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
        platform: {
          youtube: 'hsl(var(--platform-youtube) / <alpha-value>)',
          leetcode: 'hsl(var(--platform-leetcode) / <alpha-value>)',
          medium: 'hsl(var(--platform-medium) / <alpha-value>)',
          github: 'hsl(var(--platform-github) / <alpha-value>)',
          article: 'hsl(var(--platform-article) / <alpha-value>)',
          book: 'hsl(var(--platform-book) / <alpha-value>)',
        },
        map: {
          path: 'hsl(var(--map-path) / <alpha-value>)',
          'path-done': 'hsl(var(--map-path-done) / <alpha-value>)',
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
        brand: '0 8px 24px -4px rgb(249 115 22 / 0.25), 0 4px 8px -2px rgb(249 115 22 / 0.15)',
      },
      // Sem override em borderRadius — defaults do Tailwind (md=6px, lg=8px, xl=12px) batem com a spec.
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: '#FDF8F3',
            foreground: '#2D2418',
            divider: '#d4cdc5',
            focus: '#F97316',
            content1: '#ffffff',
            content2: '#FAF5F0',
            content3: '#F5EDE4',
            content4: '#E8DFD5',
            default: {
              50: '#FDF8F3',
              100: '#FAF5F0',
              200: '#E8DFD5',
              300: '#d4cdc5',
              400: '#8a8178',
              500: '#6b6358',
              600: '#534b42',
              700: '#3d362e',
              800: '#2D2418',
              900: '#1a1410',
              DEFAULT: '#E8DFD5',
              foreground: '#2D2418',
            },
            primary: {
              50: '#FFF7ED',
              100: '#FFEDD5',
              200: '#FED7AA',
              300: '#FDBA74',
              400: '#FB923C',
              500: '#F97316',
              600: '#EA580C',
              700: '#C2410C',
              800: '#9A3412',
              900: '#7C2D12',
              DEFAULT: '#F97316',
              foreground: '#ffffff',
            },
            success: { DEFAULT: '#10b981', foreground: '#ffffff' },
            warning: { DEFAULT: '#f59e0b', foreground: '#2D2418' },
            danger:  { DEFAULT: '#EF4444', foreground: '#ffffff' },
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
