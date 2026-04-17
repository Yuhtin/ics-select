import type { Config } from 'tailwindcss';
import { heroui } from '@heroui/react';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../node_modules/.pnpm/@heroui+theme@*/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // DS v2 — Focus room palette
        bg: 'hsl(var(--bg) / <alpha-value>)',
        'bg-subtle': 'hsl(var(--bg-subtle) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        'surface-hover': 'hsl(var(--surface-hover) / <alpha-value>)',

        fg: {
          DEFAULT: 'hsl(var(--fg) / <alpha-value>)',
          soft: 'hsl(var(--fg-soft) / <alpha-value>)',
          mute: 'hsl(var(--fg-mute) / <alpha-value>)',
          faint: 'hsl(var(--fg-faint) / <alpha-value>)',
          ghost: 'hsl(var(--fg-ghost) / <alpha-value>)',
        },

        'border-token': 'hsl(var(--border) / <alpha-value>)',
        'border-strong': 'hsl(var(--border-strong) / <alpha-value>)',

        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          soft: 'hsl(var(--primary-soft) / <alpha-value>)',
          fg: 'hsl(var(--primary-fg) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          soft: 'hsl(var(--success-soft) / <alpha-value>)',
        },
        warn: {
          DEFAULT: 'hsl(var(--warn) / <alpha-value>)',
          soft: 'hsl(var(--warn-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
          soft: 'hsl(var(--danger-soft) / <alpha-value>)',
        },
        reflect: {
          DEFAULT: 'hsl(var(--reflect) / <alpha-value>)',
          soft: 'hsl(var(--reflect-soft) / <alpha-value>)',
        },

        // Outcome tokens (dot / left border accent; never full bg)
        'outcome-pending': 'hsl(var(--outcome-pending) / <alpha-value>)',
        'outcome-done-easy': 'hsl(var(--outcome-done-easy) / <alpha-value>)',
        'outcome-done-hard': 'hsl(var(--outcome-done-hard) / <alpha-value>)',
        'outcome-doubts': 'hsl(var(--outcome-doubts) / <alpha-value>)',
        'outcome-stuck': 'hsl(var(--outcome-stuck) / <alpha-value>)',

        // Platform (study material borders)
        platform: {
          youtube: 'hsl(var(--platform-youtube) / <alpha-value>)',
          leetcode: 'hsl(var(--platform-leetcode) / <alpha-value>)',
          medium: 'hsl(var(--platform-medium) / <alpha-value>)',
          github: 'hsl(var(--platform-github) / <alpha-value>)',
          article: 'hsl(var(--platform-article) / <alpha-value>)',
          book: 'hsl(var(--platform-book) / <alpha-value>)',
        },

        // ========== Legacy v1 aliases ==========
        // Map the cream-era tokens to the new cool-neutral family so
        // existing components keep rendering sanely while the token
        // migration ripples through.
        paper: 'hsl(var(--bg) / <alpha-value>)',
        'paper-warm': 'hsl(var(--bg-subtle) / <alpha-value>)',
        ink: {
          DEFAULT: 'hsl(var(--fg) / <alpha-value>)',
          soft: 'hsl(var(--fg-soft) / <alpha-value>)',
          mute: 'hsl(var(--fg-mute) / <alpha-value>)',
          faint: 'hsl(var(--fg-faint) / <alpha-value>)',
        },
        rule: 'hsl(var(--border) / <alpha-value>)',
        accent: 'hsl(var(--reflect) / <alpha-value>)',
        focus: 'hsl(var(--primary) / <alpha-value>)',

        // HeroUI compatibility shims
        background: 'hsl(var(--bg) / <alpha-value>)',
        foreground: 'hsl(var(--fg) / <alpha-value>)',
        'foreground-muted': 'hsl(var(--fg-mute) / <alpha-value>)',
        'foreground-subtle': 'hsl(var(--fg-faint) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        // serif-tool is a legacy alias; DS v2 uses serif only for moments.
        // Kept pointing at Newsreader so admin pages that still reference
        // it don't break. New code should use `font-serif` for moments or
        // `font-sans` (Inter) for everything else.
        'serif-tool': ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '0.625rem',   // 10px — tighter v2
        pill: '9999px',
        input: '0.5rem',    // 8px
        tile: '0.875rem',   // 14px — stat tiles
        img: '0.5rem',
      },
      letterSpacing: {
        eyebrow: '0.08em',  // tightened from 0.14em
        label: '0.06em',
      },
      boxShadow: {
        sm: '0 1px 2px hsl(220 24% 12% / 0.04)',
        md: '0 1px 2px hsl(220 24% 12% / 0.04), 0 4px 12px hsl(220 24% 12% / 0.06)',
        lg: '0 1px 3px hsl(220 24% 12% / 0.06), 0 12px 32px hsl(220 24% 12% / 0.10)',
        modal: '0 1px 3px hsl(220 24% 12% / 0.06), 0 12px 32px hsl(220 24% 12% / 0.10)',
        lift: '0 1px 2px hsl(220 24% 12% / 0.04), 0 4px 12px hsl(220 24% 12% / 0.06)',
      },
      transitionTimingFunction: {
        magazine: 'cubic-bezier(0.16, 1, 0.3, 1)',
        focus: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.45)' },
          '70%': { boxShadow: '0 0 0 10px hsl(var(--primary) / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: '#F7F8FA',
            foreground: '#14181F',
          },
        },
        dark: {
          colors: {
            background: '#0F1218',
            foreground: '#F2F4F7',
          },
        },
      },
    }),
  ],
};

export default config;
