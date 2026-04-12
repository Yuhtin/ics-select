# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the ICS Select design system — Satoshi font, indigo+coral palette, updated radii/shadows, and propagate changes across all existing components.

**Architecture:** Update CSS variables in globals.css, tailwind.config.ts tokens, HeroUI theme config, and font loading in layout.tsx. Then propagate the new `brand` (indigo) color across components that reference it. The accent (coral) stays available for FOMO/CTA elements.

**Tech Stack:** Tailwind CSS 3, HeroUI, Fontshare CDN (Satoshi), CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-04-12-design-system.md`

---

## File Structure

### Modified files

```
apps/web/app/globals.css                    # New CSS variables (indigo primary, creme bg, new radii/shadows)
apps/web/app/layout.tsx                     # Replace Inter with Satoshi font loading
apps/web/tailwind.config.ts                 # New color tokens, radii, shadows, font family, HeroUI theme
apps/web/components/member/map-node.tsx     # Update brand color refs (pulsing glow now indigo)
apps/web/components/member/map-path.tsx     # Map path done color → indigo
apps/web/components/member/node-map.tsx     # No changes needed (uses brand token)
```

All other components use `text-brand`, `bg-brand`, `border-brand` etc. which resolve through CSS variables — they auto-update when we change the variables. No per-component changes needed for the palette swap.

---

## Phase 1: Foundation

### Task 1: Install Satoshi Font

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add Fontshare CSS import for Satoshi in globals.css**

At the very top of `apps/web/app/globals.css`, before `@tailwind base`, add:

```css
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700,800,900&display=swap');
```

- [ ] **Step 2: Update layout.tsx to remove Inter and use Satoshi**

Replace the Inter import and font setup in `apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ICS Select',
  description: 'Programa de Preparação Avançada para Entrevistas Técnicas',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="light" data-theme="light">
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build compiles**

Run: `pnpm --filter @ics-select/web build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "style(web): replace Inter with Satoshi font via Fontshare"
```

---

### Task 2: Update CSS Variables (palette + shadows + radii)

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Replace the entire :root block in globals.css**

Replace the `:root { ... }` block with:

```css
:root {
  /* Background — creme quente */
  --background: 40 20% 97%;       /* #FAFAF7 */
  --foreground: 0 0% 10%;         /* #1A1A1A */
  --surface: 0 0% 100%;           /* #FFFFFF */
  --surface-muted: 40 14% 95%;    /* #F5F5F0 */
  --surface-subtle: 40 10% 92%;   /* #EEEDE8 */
  --border: 40 6% 85%;
  --border-strong: 0 0% 42%;      /* #6B6B6B */

  --foreground-muted: 0 0% 42%;   /* #6B6B6B */
  --foreground-subtle: 0 0% 64%;  /* #A3A3A3 */

  /* Primary — Indigo moderno */
  --brand: 243 75% 59%;            /* #4F46E5 */
  --brand-hover: 243 75% 51%;     /* #4338CA */
  --brand-soft: 226 100% 97%;     /* #EEF2FF */
  --brand-soft-foreground: 244 47% 20%; /* #1E1B4B */

  /* Accent — Coral quente */
  --accent: 24 95% 53%;           /* #F97316 */
  --accent-hover: 21 90% 48%;     /* #EA580C */
  --accent-soft: 33 100% 96%;     /* #FFF7ED */

  /* Status */
  --success: 160 84% 39%;
  --success-soft: 152 76% 90%;
  --warning: 38 92% 50%;
  --warning-soft: 48 96% 89%;
  --danger: 0 84% 60%;            /* #EF4444 */
  --danger-soft: 0 100% 94%;
  --info: 243 75% 59%;            /* same as brand */
  --info-soft: 226 100% 97%;

  /* Platform colors */
  --platform-youtube: 0 100% 50%;
  --platform-leetcode: 36 100% 54%;
  --platform-medium: 0 0% 10%;
  --platform-github: 263 70% 58%;
  --platform-article: 174 84% 29%;
  --platform-book: 33 90% 43%;

  /* Map-specific */
  --map-path: 40 10% 82%;
  --map-path-done: 243 75% 59%;   /* indigo, matches brand */
  --map-bg-start: 40 20% 97%;
  --map-bg-end: 40 14% 95%;
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style(web): update CSS variables to indigo primary + creme backgrounds"
```

---

### Task 3: Update Tailwind Config (colors, fonts, radii, shadows, HeroUI theme)

**Files:**
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Replace the entire tailwind.config.ts**

```typescript
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
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          hover: 'hsl(var(--accent-hover) / <alpha-value>)',
          soft: 'hsl(var(--accent-soft) / <alpha-value>)',
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
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'h1': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h3': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['0.9375rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'caption': ['0.6875rem', { lineHeight: '1rem', fontWeight: '500' }],
      },
      borderRadius: {
        'sm': '0.5rem',     /* 8px — inputs */
        'md': '0.75rem',    /* 12px — buttons, small chips */
        'lg': '1rem',       /* 16px — cards */
        'xl': '1.25rem',    /* 20px — hero cards, modals */
        '2xl': '1.5rem',    /* 24px — large cards */
        'pill': '9999px',   /* capsule — buttons, badges */
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(0,0,0,0.04)',
        'sm': '0 2px 8px rgba(0,0,0,0.06)',
        'md': '0 4px 16px rgba(0,0,0,0.08)',
        'lg': '0 8px 32px rgba(0,0,0,0.12)',
        'glow-primary': '0 0 20px rgba(79,70,229,0.15)',
        'glow-accent': '0 0 20px rgba(249,115,22,0.15)',
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
            divider: '#EEEDE8',
            focus: '#4F46E5',
            content1: '#ffffff',
            content2: '#F5F5F0',
            content3: '#EEEDE8',
            content4: '#E5E4DF',
            default: {
              50: '#FAFAF7',
              100: '#F5F5F0',
              200: '#EEEDE8',
              300: '#E5E4DF',
              400: '#A3A3A3',
              500: '#6B6B6B',
              600: '#525252',
              700: '#3D3D3D',
              800: '#1A1A1A',
              900: '#0A0A0A',
              DEFAULT: '#EEEDE8',
              foreground: '#1A1A1A',
            },
            primary: {
              50: '#EEF2FF',
              100: '#E0E7FF',
              200: '#C7D2FE',
              300: '#A5B4FC',
              400: '#818CF8',
              500: '#4F46E5',
              600: '#4338CA',
              700: '#3730A3',
              800: '#312E81',
              900: '#1E1B4B',
              DEFAULT: '#4F46E5',
              foreground: '#ffffff',
            },
            success: { DEFAULT: '#10b981', foreground: '#ffffff' },
            warning: { DEFAULT: '#f59e0b', foreground: '#1A1A1A' },
            danger:  { DEFAULT: '#EF4444', foreground: '#ffffff' },
          },
          layout: {
            radius: { small: '0.5rem', medium: '0.75rem', large: '1rem' },
            fontSize: { small: '0.8125rem', medium: '0.9375rem', large: '1.0625rem' },
          },
        },
      },
    }),
  ],
};

export default config;
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "style(web): update tailwind config with design system tokens"
```

---

## Phase 2: Component Propagation

### Task 4: Update Map Node Glow Color

**Files:**
- Modify: `apps/web/components/member/map-node.tsx`

- [ ] **Step 1: Update the active node pulsing glow**

In `apps/web/components/member/map-node.tsx`, find the `animate` prop on the active node that uses `rgba(249,115,22,...)` (coral) and change it to indigo `rgba(79,70,229,...)`:

Change:
```typescript
animate={isActive ? {
  boxShadow: [
    '0 0 0 0 rgba(249,115,22,0.3)',
    '0 0 0 12px rgba(249,115,22,0)',
    '0 0 0 0 rgba(249,115,22,0.3)',
  ],
} : undefined}
```

To:
```typescript
animate={isActive ? {
  boxShadow: [
    '0 0 0 0 rgba(79,70,229,0.3)',
    '0 0 0 12px rgba(79,70,229,0)',
    '0 0 0 0 rgba(79,70,229,0.3)',
  ],
} : undefined}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/map-node.tsx
git commit -m "style(web): update map node glow to indigo"
```

---

### Task 5: Add Accent Color Utilities + FOMO Badge

**Files:**
- Modify: `apps/web/app/globals.css` (add utility classes)

- [ ] **Step 1: Add utility classes for accent and FOMO elements**

At the bottom of `apps/web/app/globals.css`, after the `body` rule, add:

```css
/* Accent CTA button glow */
.btn-accent-glow {
  @apply bg-accent text-white shadow-glow-accent;
}
.btn-accent-glow:hover {
  @apply bg-accent-hover scale-[1.02];
}

/* FOMO badge with gradient */
.badge-exclusive {
  @apply inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-caption font-semibold;
  background: linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(24 100% 60%) 100%);
  color: white;
  box-shadow: 0 0 16px rgba(249, 115, 22, 0.2);
}

/* Primary glow for highlighted elements */
.ring-glow-primary {
  box-shadow: 0 0 0 2px hsl(var(--brand) / 0.2), 0 0 16px hsl(var(--brand) / 0.1);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style(web): add accent glow, FOMO badge, and primary ring utilities"
```

---

### Task 6: Update BrandLockup Logo Color

**Files:**
- Modify: `apps/web/components/shell/brand-lockup.tsx`

- [ ] **Step 1: The BrandLockup currently uses `bg-brand` which will now be indigo**

Read the file and verify it uses `bg-brand`. Since the brand token changed from coral to indigo, the logo mark will now be indigo. This is correct — the ICS logo should use the primary brand color.

No code change needed if it already uses the `bg-brand` token. Just verify visually.

- [ ] **Step 2: Commit (only if changes needed)**

---

### Task 7: Full Build + Visual Verification

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 2: Run full build**

Run: `pnpm build`
Expected: Build succeeds for all packages.

- [ ] **Step 3: Run API tests**

Run: `pnpm --filter @ics-select/api test`
Expected: All 82 tests pass.

- [ ] **Step 4: Start dev server and visually verify**

Run: `pnpm --filter @ics-select/web dev`

Check in browser:
1. `/login` — Satoshi font visible, indigo brand on logo, creme background
2. `/admin/cycles` — navbar links in indigo when active, coral accent nowhere unexpected
3. `/admin/cycles` → "Novo ciclo" → modal should have indigo primary button
4. `/test-modal` — both modals render with indigo primary buttons

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(web): resolve design system integration issues"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the visual identity section in CLAUDE.md**

Replace the "Warm coral palette" section with the new design system info:
- Primary is now Indigo `#4F46E5`
- Coral `#F97316` is now `accent` (for FOMO/CTAs), not `brand`
- Font is Satoshi (via Fontshare CDN), not Inter
- Border radius uses pill for buttons/badges, lg/xl for cards
- Background is creme `#FAFAF7`

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with design system changes"
```
