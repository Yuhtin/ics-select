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
        // Magazine Editorial palette (disciplined)
        paper: 'hsl(var(--paper) / <alpha-value>)',
        'paper-warm': 'hsl(var(--paper-warm) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        ink: {
          DEFAULT: 'hsl(var(--ink) / <alpha-value>)',
          soft: 'hsl(var(--ink-soft) / <alpha-value>)',
          mute: 'hsl(var(--ink-mute) / <alpha-value>)',
          faint: 'hsl(var(--ink-faint) / <alpha-value>)',
        },
        rule: 'hsl(var(--rule) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',

        // Outcome family (dot or border-left only — never full background)
        'outcome-pending': 'hsl(var(--outcome-pending) / <alpha-value>)',
        'outcome-done-easy': 'hsl(var(--outcome-done-easy) / <alpha-value>)',
        'outcome-done-hard': 'hsl(var(--outcome-done-hard) / <alpha-value>)',
        'outcome-doubts': 'hsl(var(--outcome-doubts) / <alpha-value>)',
        'outcome-stuck': 'hsl(var(--outcome-stuck) / <alpha-value>)',

        // Platform colors (study material borders — reused across phases)
        platform: {
          youtube: 'hsl(var(--platform-youtube) / <alpha-value>)',
          leetcode: 'hsl(var(--platform-leetcode) / <alpha-value>)',
          medium: 'hsl(var(--platform-medium) / <alpha-value>)',
          github: 'hsl(var(--platform-github) / <alpha-value>)',
          article: 'hsl(var(--platform-article) / <alpha-value>)',
          book: 'hsl(var(--platform-book) / <alpha-value>)',
        },

        // HeroUI compatibility shims (admin shell still uses HeroUI)
        // These map old token names to new ones so HeroUI-styled components
        // still pick up sensible colors. Remove in a later PR once admin
        // is fully rewritten.
        background: 'hsl(var(--paper) / <alpha-value>)',
        foreground: 'hsl(var(--ink) / <alpha-value>)',
        'foreground-muted': 'hsl(var(--ink-mute) / <alpha-value>)',
        'foreground-subtle': 'hsl(var(--ink-faint) / <alpha-value>)',
        border: 'hsl(var(--rule) / <alpha-value>)',
      },
      borderColor: {
        DEFAULT: 'hsl(var(--rule) / <alpha-value>)',
      },
      fontFamily: {
        // Narrative / reading surfaces
        serif: ['Newsreader', 'Georgia', 'serif'],
        // Dense-data / tool surfaces (admin plan editor etc.)
        'serif-tool': ['"Source Serif 4"', 'Georgia', 'serif'],
        // UI chrome
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Numbers, hours, IDs
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '0.75rem',   // 12px
        pill: '9999px',
        input: '0.5rem',   // 8px
        img: '0.5rem',
      },
      letterSpacing: {
        eyebrow: '0.14em',
        label: '0.08em',
      },
      boxShadow: {
        // Used sparingly — only modal / focus
        modal: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
      },
      transitionTimingFunction: {
        magazine: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: '#FAFAF7',
            foreground: '#1A1A1A',
          },
        },
      },
    }),
  ],
};

export default config;
