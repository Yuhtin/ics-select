# PR 2a — Design System + Member Shell (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pre-revamp Indigo+Coral design system with the **Magazine Editorial** system (Newsreader + Source Serif 4 + Inter + IBM Plex Mono; paper/ink/rule tokens; outcome token family; accent terracotta). Build primitive components (Button, Pill, Card, OutcomePicker, ListRow, StreakCard, DayHeader). Ship the member shell (floating topbar on desktop + bottom tab bar on mobile). Produce a `/dev/design-system` sandbox route to visually verify the library. No screens yet — PR 2b builds `/me`, `/me/plan`, `/me/item/[id]` on top of this foundation.

**Architecture:** Tailwind config (v3) is the single source of truth for tokens. Fonts load via `<link>` in `layout.tsx` (never `@import` in CSS — blocks Next.js dev server). Primitives live in `apps/web/components/ui/`. Member shell components live in `apps/web/components/member-shell/`. HeroUI is retained for Modal/Toast/etc. that are non-visual or used by admin — we do NOT rip it out in this PR. After this PR, hitting `/dev/design-system` renders the full primitive showcase in the Magazine Editorial aesthetic; hitting `/home` renders the placeholder page under the new shell.

**Tech Stack:** Next.js 15 App Router · React 19 · Tailwind CSS 3 · Framer Motion · `lucide-react` · Google Fonts (Newsreader, Source Serif 4, Inter, IBM Plex Mono) · Playwright.

**Reference spec:** `docs/superpowers/specs/2026-04-16-revamp-design.md` (commit `a089d18`), sections §2 Sistema Visual and §4.1 Home do membro (composition only).

**Out of scope:** all `/me/*` content screens (those are PR 2b); cohort / retro / settings / onboarding (PR 2b/2c); backend endpoints (PR 2b); admin screens (PR 3); AI work (PR 4).

---

## File Structure

### Created

- `apps/web/components/ui/button.tsx`
- `apps/web/components/ui/pill.tsx`
- `apps/web/components/ui/card.tsx`
- `apps/web/components/ui/eyebrow.tsx`
- `apps/web/components/ui/section-label.tsx`
- `apps/web/components/ui/outcome-picker.tsx`
- `apps/web/components/ui/outcome-dot.tsx`
- `apps/web/components/ui/list-row.tsx`
- `apps/web/components/ui/day-header.tsx`
- `apps/web/components/ui/streak-card.tsx`
- `apps/web/components/member-shell/topbar-member.tsx`
- `apps/web/components/member-shell/bottom-tab-bar.tsx`
- `apps/web/components/member-shell/member-shell.tsx`
- `apps/web/app/dev/design-system/page.tsx`
- `apps/web/tests/design-system.spec.ts`

### Modified

- `apps/web/tailwind.config.ts`
- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`
- `apps/web/app/(member)/layout.tsx`
- `apps/web/app/(member)/home/page.tsx`

### Deleted

- None in this PR.

---

## Tasks

### Task 1: Replace Tailwind theme tokens

**Files:**
- Modify: `apps/web/tailwind.config.ts`

The current config has an Indigo+Coral palette + Satoshi font. Replace with Magazine Editorial tokens. Preserve the `content` paths (pnpm HeroUI) and the `heroui` plugin registration (HeroUI is still used by admin + toast elsewhere).

- [ ] **Step 1: Overwrite `apps/web/tailwind.config.ts`**

Write the file entirely:

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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "feat(web/tailwind): replace Indigo+Coral system with Magazine Editorial tokens"
```

**Note:** Admin pages that currently rely on `brand` / `accent-soft` / `warning` / `success` / `danger` / `info` / `success-soft` classes will visually degrade (fall back to Tailwind default colors). This is **acceptable for PR 2a** — admin is redesigned entirely in PR 3. The HeroUI shim section preserves the minimum `background` / `foreground` / `border` names so HeroUI theme lookup doesn't crash at runtime.

---

### Task 2: Replace `globals.css` with Magazine Editorial CSS variables

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Read current content**

```bash
cat apps/web/app/globals.css
```

- [ ] **Step 2: Overwrite**

Write `apps/web/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Magazine Editorial palette */
  --paper: 40 30% 97%;         /* #FAFAF7 */
  --paper-warm: 40 17% 92%;    /* #EFEEE8 */
  --surface: 0 0% 100%;        /* #FFFFFF */
  --ink: 0 0% 10%;             /* #1A1A1A */
  --ink-soft: 24 9% 25%;       /* #44403C */
  --ink-mute: 24 5% 47%;       /* #78716C */
  --ink-faint: 25 6% 63%;      /* #A8A29E */
  --rule: 40 8% 89%;           /* #E5E4DF */
  --accent: 15 56% 50%;        /* #C45D3A terracotta */

  /* Outcome tokens (dot 6-10px or border-left 3px only) */
  --outcome-pending: 25 6% 63%;        /* #A8A29E */
  --outcome-done-easy: 161 82% 17%;    /* #065F46 */
  --outcome-done-hard: 27 88% 35%;     /* #B45309 */
  --outcome-doubts: 271 78% 40%;       /* #6B21A8 */
  --outcome-stuck: 0 74% 35%;          /* #991B1B */

  /* Platform colors (unchanged from prior palette) */
  --platform-youtube: 0 100% 50%;
  --platform-leetcode: 36 100% 54%;
  --platform-medium: 0 0% 10%;
  --platform-github: 263 70% 58%;
  --platform-article: 174 84% 29%;
  --platform-book: 33 90% 43%;
}

html,
body {
  height: 100%;
  background: hsl(var(--paper));
  color: hsl(var(--ink));
}

html {
  /* Keep class="light" requirement for HeroUI portal-rendered components */
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  @apply antialiased;
  font-feature-settings: 'kern', 'liga', 'calt';
}

/* Utility: tabular numerics for dense-data surfaces */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(web/css): swap CSS variables to Magazine Editorial palette"
```

---

### Task 3: Load the four fonts via `<link>` in layout.tsx

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Read the current layout**

```bash
cat apps/web/app/layout.tsx
```

Expected: an existing `<html>` / `<head>` / `<body>` structure with some `<link>` tags already (possibly for Satoshi via Fontshare).

- [ ] **Step 2: Replace the `<head>` font links**

Locate the font `<link>` block(s) inside `<head>`. Remove any Fontshare / Satoshi / JetBrains Mono tags. Add the four Google Fonts links:

```tsx
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
  />
</head>
```

Do not remove `className="light"` and `data-theme="light"` attributes on `<html>` — they're required for HeroUI-portal components.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web/fonts): load Newsreader + Source Serif 4 + Inter + Plex Mono"
```

---

### Task 4: Button primitive

**Files:**
- Create: `apps/web/components/ui/button.tsx`

- [ ] **Step 1: Write the component**

Write `apps/web/components/ui/button.tsx`:

```tsx
'use client';

import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'link';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // variant
        variant === 'primary' && 'bg-ink text-paper hover:bg-ink-soft rounded-pill',
        variant === 'ghost' && 'border border-ink text-ink hover:bg-paper-warm rounded-pill',
        variant === 'link' && 'text-ink underline decoration-1 underline-offset-2 hover:decoration-2',
        // size
        size === 'sm' && variant !== 'link' && 'h-8 px-3 text-xs',
        size === 'md' && variant !== 'link' && 'h-10 px-4 text-sm',
        size === 'lg' && variant !== 'link' && 'h-11 px-5 text-base',
        size === 'sm' && variant === 'link' && 'text-xs',
        size === 'md' && variant === 'link' && 'text-sm',
        size === 'lg' && variant === 'link' && 'text-base',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
```

Note: `clsx` is an existing dep. If it isn't, install it: `pnpm --filter @ics-select/web add clsx`. First check `apps/web/package.json`.

- [ ] **Step 2: Verify `clsx` is installed**

```bash
grep "\"clsx\"" apps/web/package.json
```

If not present:

```bash
pnpm --filter @ics-select/web add clsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/button.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web/ui): add Button primitive (primary/ghost/link, 3 sizes)"
```

---

### Task 5: Pill + OutcomeDot primitives

**Files:**
- Create: `apps/web/components/ui/pill.tsx`
- Create: `apps/web/components/ui/outcome-dot.tsx`

- [ ] **Step 1: Write Pill**

Write `apps/web/components/ui/pill.tsx`:

```tsx
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type PillVariant = 'solid' | 'soft' | 'outline';

interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  className?: string;
}

export function Pill({ children, variant = 'solid', className }: PillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-[9px] font-bold uppercase tracking-label',
        variant === 'solid' && 'bg-ink text-paper',
        variant === 'soft' && 'bg-paper-warm text-ink',
        variant === 'outline' && 'border border-rule text-ink-mute bg-transparent',
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Write OutcomeDot**

Write `apps/web/components/ui/outcome-dot.tsx`:

```tsx
import { clsx } from 'clsx';
import type { ItemOutcome } from '@ics-select/shared';

interface OutcomeDotProps {
  outcome: ItemOutcome;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Pulse ring around the dot (for "now" / active). */
  active?: boolean;
}

const SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

const OUTCOME_CLASS: Record<ItemOutcome, string> = {
  PENDING: 'bg-outcome-pending',
  DONE_EASY: 'bg-outcome-done-easy',
  DONE_HARD: 'bg-outcome-done-hard',
  DOUBTS: 'bg-outcome-doubts',
  STUCK: 'bg-outcome-stuck',
};

export function OutcomeDot({ outcome, size = 'md', active, className }: OutcomeDotProps) {
  return (
    <span
      className={clsx(
        'inline-block rounded-full',
        SIZE_CLASS[size],
        OUTCOME_CLASS[outcome],
        active && 'ring-2 ring-rule ring-offset-1 ring-offset-paper',
        className,
      )}
      aria-label={`outcome ${outcome.toLowerCase()}`}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/pill.tsx apps/web/components/ui/outcome-dot.tsx
git commit -m "feat(web/ui): add Pill and OutcomeDot primitives"
```

---

### Task 6: Card, Eyebrow, SectionLabel primitives

**Files:**
- Create: `apps/web/components/ui/card.tsx`
- Create: `apps/web/components/ui/eyebrow.tsx`
- Create: `apps/web/components/ui/section-label.tsx`

- [ ] **Step 1: Write Card**

Write `apps/web/components/ui/card.tsx`:

```tsx
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  /** 'surface' = white / 'paper-warm' = slightly tinted. */
  tone?: 'surface' | 'paper-warm';
  className?: string;
}

export function Card({ children, tone = 'surface', className }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-card border border-rule',
        tone === 'surface' && 'bg-surface',
        tone === 'paper-warm' && 'bg-paper-warm',
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Write Eyebrow**

Write `apps/web/components/ui/eyebrow.tsx`:

```tsx
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p
      className={clsx(
        'font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold',
        className,
      )}
    >
      {children}
    </p>
  );
}
```

- [ ] **Step 3: Write SectionLabel**

Write `apps/web/components/ui/section-label.tsx`:

```tsx
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <p
      className={clsx(
        'font-mono text-[9px] uppercase tracking-eyebrow text-ink-mute font-semibold mb-2.5',
        className,
      )}
    >
      {children}
    </p>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/card.tsx apps/web/components/ui/eyebrow.tsx apps/web/components/ui/section-label.tsx
git commit -m "feat(web/ui): add Card, Eyebrow, SectionLabel primitives"
```

---

### Task 7: OutcomePicker (5-state interactive)

**Files:**
- Create: `apps/web/components/ui/outcome-picker.tsx`

- [ ] **Step 1: Write the component**

Write `apps/web/components/ui/outcome-picker.tsx`:

```tsx
'use client';

import { clsx } from 'clsx';
import type { ItemOutcome } from '@ics-select/shared';
import { OutcomeDot } from './outcome-dot';

interface OutcomePickerProps {
  value: ItemOutcome | null;
  onChange: (outcome: ItemOutcome) => void;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

const OPTIONS: Array<{ outcome: ItemOutcome; label: string }> = [
  { outcome: 'DONE_EASY', label: 'Nailed it' },
  { outcome: 'DONE_HARD', label: 'Got it (hard)' },
  { outcome: 'DOUBTS', label: 'Had doubts' },
  { outcome: 'STUCK', label: 'Stuck' },
  { outcome: 'PENDING', label: 'Not yet' },
];

export function OutcomePicker({
  value,
  onChange,
  disabled,
  disabledReason,
  className,
}: OutcomePickerProps) {
  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex flex-wrap gap-2 md:flex-nowrap md:overflow-x-auto">
        {OPTIONS.map(({ outcome, label }) => {
          const selected = value === outcome;
          return (
            <button
              key={outcome}
              type="button"
              disabled={disabled}
              onClick={() => onChange(outcome)}
              className={clsx(
                'inline-flex items-center gap-2 rounded-pill border px-3 py-2 text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
                selected
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-ink border-rule hover:bg-paper-warm',
                disabled && 'opacity-50 cursor-not-allowed hover:bg-paper',
              )}
            >
              <OutcomeDot outcome={outcome} size="sm" className={clsx(selected && 'ring-paper')} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {disabled && disabledReason && (
        <p className="text-xs text-ink-mute">{disabledReason}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/ui/outcome-picker.tsx
git commit -m "feat(web/ui): add OutcomePicker primitive (5 states, click-to-select)"
```

---

### Task 8: ListRow, DayHeader, StreakCard

**Files:**
- Create: `apps/web/components/ui/list-row.tsx`
- Create: `apps/web/components/ui/day-header.tsx`
- Create: `apps/web/components/ui/streak-card.tsx`

- [ ] **Step 1: Write ListRow**

Write `apps/web/components/ui/list-row.tsx`:

```tsx
import { clsx } from 'clsx';
import type { ItemOutcome } from '@ics-select/shared';
import type { ReactNode } from 'react';
import { OutcomeDot } from './outcome-dot';

interface ListRowProps {
  /** Left-aligned tabular time, e.g. "19:00". Optional. */
  time?: string;
  outcome?: ItemOutcome;
  /** Shown with ring when the row is the "now" item. */
  active?: boolean;
  title: ReactNode;
  meta?: ReactNode;
  rightSlot?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ListRow({
  time,
  outcome = 'PENDING',
  active,
  title,
  meta,
  rightSlot,
  onClick,
  className,
}: ListRowProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'flex w-full items-start gap-3 border-b border-rule py-3 text-left last:border-b-0',
        onClick && 'hover:bg-paper-warm focus-visible:outline-none focus-visible:bg-paper-warm',
        'transition-colors',
        className,
      )}
    >
      {time !== undefined && (
        <span className="w-[52px] flex-none pt-0.5 font-mono text-[11px] tabular-nums text-ink-mute">
          {time}
        </span>
      )}
      <OutcomeDot outcome={outcome} size="md" active={active} className="mt-1 flex-none" />
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            'font-serif text-[15px] font-medium leading-tight',
            outcome === 'DONE_EASY' && 'text-ink-mute line-through',
          )}
        >
          {title}
        </p>
        {meta && <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-ink-mute">{meta}</p>}
      </div>
      {rightSlot && <div className="flex-none pt-0.5">{rightSlot}</div>}
    </Wrapper>
  );
}
```

- [ ] **Step 2: Write DayHeader**

Write `apps/web/components/ui/day-header.tsx`:

```tsx
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface DayHeaderProps {
  label: ReactNode;
  /** Small description under the label, e.g. "3 items · 120 min". */
  hint?: ReactNode;
  className?: string;
}

export function DayHeader({ label, hint, className }: DayHeaderProps) {
  return (
    <div className={clsx('flex items-baseline justify-between gap-3 pt-6 pb-2', className)}>
      <h2 className="font-serif text-[22px] font-medium leading-none tracking-tight">{label}</h2>
      {hint && <span className="font-mono text-[11px] text-ink-mute">{hint}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Write StreakCard**

Write `apps/web/components/ui/streak-card.tsx`:

```tsx
import { clsx } from 'clsx';
import { Card } from './card';
import { SectionLabel } from './section-label';

interface StreakCardProps {
  /** Current streak in days. */
  current: number;
  /** Last 7 days — true if the day had a positive outcome. Oldest first. */
  last7: boolean[];
  className?: string;
}

export function StreakCard({ current, last7, className }: StreakCardProps) {
  return (
    <Card tone="surface" className={clsx('p-5', className)}>
      <SectionLabel>Day streak</SectionLabel>
      <p className="font-serif text-[56px] font-medium leading-none tabular-nums">{current}</p>
      <div className="mt-4 flex items-center gap-1.5" aria-label="last 7 days">
        {last7.map((on, i) => (
          <span
            key={i}
            className={clsx(
              'h-2 w-2 rounded-full',
              on ? 'bg-ink' : 'bg-rule',
            )}
          />
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/list-row.tsx apps/web/components/ui/day-header.tsx apps/web/components/ui/streak-card.tsx
git commit -m "feat(web/ui): add ListRow, DayHeader, StreakCard primitives"
```

---

### Task 9: Member shell — desktop topbar

**Files:**
- Create: `apps/web/components/member-shell/topbar-member.tsx`

- [ ] **Step 1: Write the topbar**

Write `apps/web/components/member-shell/topbar-member.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Compass, User, Users } from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { href: '/home', label: 'Today', icon: Compass },
  { href: '/cohort', label: 'Cohort', icon: Users },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
] as const;

export function TopbarMember() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-rule/60 bg-paper/80 backdrop-blur md:block">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/home" className="font-serif text-lg font-semibold tracking-tight">
          ICS Select
        </Link>
        <nav className="flex items-center gap-1 font-sans text-sm">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 transition-colors',
                  active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-warm',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-rule text-ink hover:bg-paper-warm"
          aria-label="Settings"
        >
          <User className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/member-shell/topbar-member.tsx
git commit -m "feat(web/member-shell): add desktop floating topbar (Today/Cohort/Calendar/Settings)"
```

---

### Task 10: Member shell — mobile bottom tab bar

**Files:**
- Create: `apps/web/components/member-shell/bottom-tab-bar.tsx`

- [ ] **Step 1: Write the component**

Write `apps/web/components/member-shell/bottom-tab-bar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Compass, User, Users } from 'lucide-react';
import { clsx } from 'clsx';

const TABS = [
  { href: '/home', label: 'Today', icon: Compass },
  { href: '/cohort', label: 'Cohort', icon: Users },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/settings', label: 'Settings', icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 backdrop-blur md:hidden"
      aria-label="Main navigation"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={clsx(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-mono uppercase tracking-label',
                  active ? 'text-ink' : 'text-ink-mute',
                )}
              >
                <Icon
                  className={clsx('h-5 w-5', active ? 'stroke-ink' : 'stroke-ink-mute')}
                  strokeWidth={active ? 2 : 1.5}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/member-shell/bottom-tab-bar.tsx
git commit -m "feat(web/member-shell): add mobile bottom tab bar"
```

---

### Task 11: MemberShell wrapper + refactor `(member)/layout.tsx`

**Files:**
- Create: `apps/web/components/member-shell/member-shell.tsx`
- Modify: `apps/web/app/(member)/layout.tsx`

- [ ] **Step 1: Write MemberShell**

Write `apps/web/components/member-shell/member-shell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { TopbarMember } from './topbar-member';
import { BottomTabBar } from './bottom-tab-bar';

interface MemberShellProps {
  children: ReactNode;
}

export function MemberShell({ children }: MemberShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <TopbarMember />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-6xl px-5 py-6 md:px-6 md:py-10">{children}</div>
      </main>
      <BottomTabBar />
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `(member)/layout.tsx`**

Write `apps/web/app/(member)/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { MemberShell } from '../../components/member-shell/member-shell';

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <MemberShell>{children}</MemberShell>;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member-shell/member-shell.tsx 'apps/web/app/(member)/layout.tsx'
git commit -m "feat(web): member shell wires topbar + bottom tab into (member)/layout.tsx"
```

---

### Task 12: Polish `(member)/home/page.tsx` to use new primitives

**Files:**
- Modify: `apps/web/app/(member)/home/page.tsx`

Context: the Task 15-of-PR-1 placeholder renders plain Tailwind text. Upgrade it to use the new primitives so a fresh login visually confirms the design system is live.

- [ ] **Step 1: Rewrite**

Write `apps/web/app/(member)/home/page.tsx`:

```tsx
import { Eyebrow } from '../../../components/ui/eyebrow';

export default function MemberPlaceholderHome() {
  return (
    <section className="max-w-2xl">
      <Eyebrow>ICS Select</Eyebrow>
      <h1 className="mt-3 font-serif text-4xl font-medium leading-tight tracking-tight">
        Your study home is being rebuilt.
      </h1>
      <p className="mt-4 font-sans text-base leading-relaxed text-ink-soft">
        The member experience is under construction. The daily list, item focus page, and cohort
        view all ship in the next release. For anything urgent, reach out to the program director.
      </p>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-label text-ink-mute">
        PR 2a · foundation preview
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'apps/web/app/(member)/home/page.tsx'
git commit -m "feat(web): refresh placeholder home to use Magazine Editorial primitives"
```

---

### Task 13: Design-system showcase route

**Files:**
- Create: `apps/web/app/dev/design-system/page.tsx`

Context: a sandbox route that renders every primitive in sensible groups. Useful for (a) eyeballing the system, (b) Playwright snapshot regression. Lives under `/dev/` (no auth gate needed by default — verify with current middleware).

- [ ] **Step 1: Confirm `/dev/` is accessible**

Check `apps/web/middleware.ts` (if it exists) to see how `/dev/*` is handled. If it's gated behind auth, add an exception OR just rely on authenticated-admin access for testing (the user is always logged in during development). Move on — do not modify middleware in this task.

- [ ] **Step 2: Write the showcase**

Write `apps/web/app/dev/design-system/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { ItemOutcome } from '@ics-select/shared';
import { Button } from '../../../components/ui/button';
import { Pill } from '../../../components/ui/pill';
import { OutcomeDot } from '../../../components/ui/outcome-dot';
import { OutcomePicker } from '../../../components/ui/outcome-picker';
import { Card } from '../../../components/ui/card';
import { Eyebrow } from '../../../components/ui/eyebrow';
import { SectionLabel } from '../../../components/ui/section-label';
import { ListRow } from '../../../components/ui/list-row';
import { DayHeader } from '../../../components/ui/day-header';
import { StreakCard } from '../../../components/ui/streak-card';

export default function DesignSystemPage() {
  const [outcome, setOutcome] = useState<ItemOutcome | null>('DONE_HARD');

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-10">
      <header>
        <Eyebrow>Dev · Design System</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">
          Magazine Editorial primitives
        </h1>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          Sandbox to visually verify tokens, fonts, and components. Delete this route before ship.
        </p>
      </header>

      <section>
        <SectionLabel>Typography</SectionLabel>
        <Card className="p-6 space-y-4">
          <p className="font-serif text-[40px] font-medium leading-none tracking-tight">
            Newsreader 40 — headlines.
          </p>
          <p className="font-serif-tool text-2xl font-semibold tabular-nums">
            Source Serif 4 · tabular 1,234,567 · tool tone
          </p>
          <p className="font-sans text-base text-ink-soft">
            Inter 16 — body copy. UI chrome, labels, paragraphs.
          </p>
          <p className="font-mono text-xs uppercase tracking-eyebrow text-ink-mute">
            IBM Plex Mono · 12 · eyebrow label
          </p>
        </Card>
      </section>

      <section>
        <SectionLabel>Buttons</SectionLabel>
        <Card className="p-6 flex flex-wrap gap-3 items-center">
          <Button variant="primary" size="sm">Small primary</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="primary" size="lg">Large primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link button</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </Card>
      </section>

      <section>
        <SectionLabel>Pills</SectionLabel>
        <Card className="p-6 flex flex-wrap gap-2">
          <Pill>LEETCODE</Pill>
          <Pill variant="soft">DP</Pill>
          <Pill variant="outline">45 min</Pill>
        </Card>
      </section>

      <section>
        <SectionLabel>Outcome dots</SectionLabel>
        <Card className="p-6 flex flex-wrap gap-4 items-center text-sm">
          {(['PENDING', 'DONE_EASY', 'DONE_HARD', 'DOUBTS', 'STUCK'] as ItemOutcome[]).map((o) => (
            <span key={o} className="inline-flex items-center gap-2">
              <OutcomeDot outcome={o} />
              <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                {o}
              </span>
            </span>
          ))}
          <span className="inline-flex items-center gap-2 ml-6">
            <OutcomeDot outcome="PENDING" active />
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
              PENDING · active
            </span>
          </span>
        </Card>
      </section>

      <section>
        <SectionLabel>Outcome picker</SectionLabel>
        <Card className="p-6 space-y-3">
          <OutcomePicker value={outcome} onChange={setOutcome} />
          <p className="font-mono text-[11px] text-ink-mute">
            current: <span className="text-ink">{outcome ?? 'null'}</span>
          </p>
        </Card>
      </section>

      <section>
        <SectionLabel>List rows (Today)</SectionLabel>
        <Card className="px-6">
          <DayHeader label="Today" hint="3 items · 110 min" />
          <ListRow
            time="13:00"
            outcome="DONE_EASY"
            title="Recursion intro"
            meta="VIDEO · 30 MIN"
          />
          <ListRow
            time="19:00"
            outcome="PENDING"
            active
            title="Binary search patterns"
            meta="LEETCODE · 45 MIN · NOW"
          />
          <ListRow
            time="21:00"
            outcome="PENDING"
            title="Complexity review"
            meta="ARTICLE · 20 MIN"
          />
        </Card>
      </section>

      <section>
        <SectionLabel>Streak card</SectionLabel>
        <div className="max-w-xs">
          <StreakCard current={12} last7={[true, true, true, false, true, true, true]} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dev/design-system/page.tsx
git commit -m "feat(web/dev): add /dev/design-system primitive showcase"
```

---

### Task 14: Playwright smoke screenshot of showcase

**Files:**
- Create: `apps/web/tests/design-system.spec.ts`

Context: locks the visual output of the design system so future regressions are caught. The test simply loads `/dev/design-system` and takes a screenshot.

- [ ] **Step 1: Inspect existing Playwright config**

```bash
ls apps/web/playwright.config.ts apps/web/tests 2>/dev/null
```

If no config exists, check the web package.json for a Playwright test script:

```bash
grep -A2 '"test"' apps/web/package.json
```

If Playwright is not set up yet, STOP this task and report BLOCKED — PR 2b will add the Playwright baseline.

If Playwright config exists, proceed.

- [ ] **Step 2: Write the spec**

Write `apps/web/tests/design-system.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test.describe('Design system sandbox', () => {
  test('renders all primitives at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/design-system');
    // Wait for the 40px headline before capturing
    await expect(page.getByRole('heading', { name: /magazine editorial primitives/i })).toBeVisible();
    // Fonts take a moment to load
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('design-system-desktop.png', { fullPage: true });
  });

  test('renders at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/design-system');
    await expect(page.getByRole('heading', { name: /magazine editorial primitives/i })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('design-system-mobile.png', { fullPage: true });
  });
});
```

- [ ] **Step 3: Generate baseline snapshots**

Run:

```bash
pnpm --filter @ics-select/web test:update tests/design-system.spec.ts
```

Expected: creates `apps/web/tests/design-system.spec.ts-snapshots/design-system-desktop.png` and `design-system-mobile.png`.

If the `test:update` script is not defined, try:

```bash
pnpm --filter @ics-select/web exec playwright test tests/design-system.spec.ts --update-snapshots
```

- [ ] **Step 4: Run the tests to confirm they pass against the new baseline**

```bash
pnpm --filter @ics-select/web test tests/design-system.spec.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit the spec + snapshots**

```bash
git add apps/web/tests/design-system.spec.ts apps/web/tests/design-system.spec.ts-snapshots
git commit -m "test(web): lock design-system visual baseline (desktop + mobile)"
```

If the snapshots directory has a different naming convention for your Playwright version, adapt the `git add` path accordingly.

---

### Task 15: Final regression + merge gate

**Files:**
- No files changed manually. Verification only.

- [ ] **Step 1: Lint**

```bash
pnpm lint
```

Expected: clean (fix any new warnings from the new components — common issues: unused props, missing `'use client'` directive on interactive components).

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: API + web tests**

```bash
pnpm test
```

Expected: API 86/86 (unchanged from PR 1) + web Playwright design-system specs pass.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: all four packages build cleanly.

- [ ] **Step 5: Manual eyeball**

Start the dev server:

```bash
pnpm --filter @ics-select/web dev
```

Open two tabs:
- `http://localhost:3000/home` — member placeholder in the new shell.
- `http://localhost:3000/dev/design-system` — primitive showcase.

Verify:
- Fonts loaded (inspect with devtools → Network → CSS). Headlines should be Newsreader; body should be Inter.
- Colors correct (`#FAFAF7` bg, `#1A1A1A` ink).
- Topbar sticky on desktop (`≥ 768px`), bottom tab shows on mobile (`< 768px`).
- OutcomePicker clickable, selection changes state.

Stop the dev server with Ctrl+C.

- [ ] **Step 6: No commit needed — gate only.**

---

## Self-review

**Spec coverage:**
- Spec §2.1 typography (dual serif) → Tasks 1–3 configure all four fonts. ✅
- Spec §2.2 palette (disciplined tokens + outcome family) → Tasks 1–2 add all tokens. ✅
- Spec §2.3 geometry (radius, no box-shadow, Framer easing) → Task 1 defines `rounded-card`, `rounded-pill`, `transition-timing-function.magazine`. ✅
- Spec §2.4 components (Button, Pill, Card, Outcome picker) → Tasks 4–8. ✅
- Spec §3.1 shells (member floating topbar + bottom tab) → Tasks 9–11. ✅
- Spec §4.1 home composition (streak card etc.) → primitives exist; full `/me` page is PR 2b, not this PR. ✅ (correctly deferred)

**Placeholder scan:** No "TBD", "TODO", "similar to Task N", or vague handwaves. Every code block is complete.

**Type consistency:**
- `ItemOutcome` enum values used in `OutcomeDot`, `OutcomePicker`, `ListRow`, showcase — all identical to `@ics-select/shared` exports.
- Tailwind class names (`bg-paper`, `text-ink`, `font-serif`, `tracking-eyebrow`, `rounded-card`, `rounded-pill`) are consistent across all component files.
- Component file paths match the File Structure section.

**Ambiguities fixed inline:**
- Task 13 Step 1 handles the possible `middleware.ts` auth gate on `/dev/*` — either it's open or the user is logged in as admin during test, no code changes needed.
- Task 14 Step 3 handles two possible Playwright script names (`test:update` or `exec playwright test --update-snapshots`).
- Task 1 includes HeroUI compatibility shims (`background`, `foreground`, `border`, `foreground-muted`, `foreground-subtle`) so admin pages don't crash on unresolved classes during this PR. The shims will be removed when PR 3 rewrites admin.

**Out-of-scope items correctly deferred:**
- Daily home `/me` page, item page `/me/item/[id]`, week list `/me/plan`: PR 2b.
- Cohort page `/me/cohort`, retro `/me/retro`, settings `/me/settings`, onboarding `/me/onboarding`: PR 2c.
- Backend endpoints `/me/home`, `/me/cohort`, `/me/retro/*`: PR 2b.
- Admin UI: PR 3.
