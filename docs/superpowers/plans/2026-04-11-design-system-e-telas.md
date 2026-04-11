# Design System e Telas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a primeira passada de design intencional no `apps/web`: tokens, tipografia Inter, shell sidebar+topbar, componentes assinatura, re-tematização do HeroUI, e layouts das 4 telas vitrine (Login, Admin Dashboard, Plano Semanal) — propagando o novo visual por herança de tokens para as 11 páginas restantes sem redesign manual de cada uma.

**Architecture:** HeroUI re-tematizado para controles (inherited automaticamente por todas as páginas existentes) + Tailwind puro para componentes de layout e signature (shell, sidebar, stat cards, login card). Light-first com `forcedTheme="light"` — dark mode fica deferido. Navegação migra de topbar-only para sidebar canônica + topbar fino.

**Tech Stack:** Next.js 15 App Router, HeroUI 2.x, Tailwind CSS 3, next-themes, `next/font/google` (Inter), lucide-react, TypeScript. Tests via `pnpm --filter @ics-select/web build` (typecheck) + Playwright `auth-flow.spec.ts` existente.

**Spec:** `docs/superpowers/specs/2026-04-11-design-system-e-telas.md`

---

## Note sobre testes

**Este plano é visual/estrutural, não algoritmo.** O `apps/web` só tem Playwright e2e (`tests/auth-flow.spec.ts`), não há infraestrutura de component testing (sem Jest/Vitest pro front). Portanto:

- **"Verificação" de cada task criação-de-componente** = `pnpm --filter @ics-select/web build` passa (typecheck + compile) + smoke manual via `pnpm dev` onde aplicável.
- **Tasks que tocam o login ou o shell autenticado** adicionalmente rodam `pnpm --filter @ics-select/web test` (Playwright) pra garantir que o auth flow não quebrou.
- **Snapshots visuais são intencionalmente EVITADOS** — o snapshot flakey foi removido no commit `3960b27` e a spec explicita "não reintroduzir".
- **Smoke final (Task 22)** é um walkthrough manual das 11 páginas herdadas com uma checklist de "o que procurar".

Executores: não gastem tempo tentando escrever unit tests pra esses componentes. Foquem em: código compila, build passa, Playwright passa, telas abrem e parecem certas.

---

## File Structure

### Created

```
apps/web/components/shell/
  app-shell.tsx            shell client component (sidebar + topbar + main)
  sidebar.tsx              sidebar conteúdo, não se auto-posiciona
  sidebar-item.tsx         linha de nav com active state via usePathname
  topbar.tsx               barra superior fina, botão de menu mobile
  brand-lockup.tsx         "IS" mark + "ICS Select" wordmark, 4 sizes
  page-header.tsx          eyebrow + title + description + actions

apps/web/components/ui/
  stat-card.tsx            métrica do dashboard admin
  member-card.tsx          card de membro da grid
  library-item-row.tsx     linha de item no plano semanal
  status-chip.tsx          inline chip com 5 estados
  ai-assistant-card.tsx    hero card gradient brand (CTA de IA)
  data-table.tsx           wrapper frame pra HeroUI Table

packages/shared/src/design/
  tokens.ts                hex/typography objects reusáveis
  index.ts                 re-export
```

### Modified

```
apps/web/app/layout.tsx               +Inter next/font, html className
apps/web/app/globals.css               CSS vars (:root) + base styles
apps/web/tailwind.config.ts            colors, fonts, shadows, heroui theme
apps/web/app/providers.tsx             forcedTheme="light"
apps/web/app/(app)/layout.tsx          <AppNav/> → <AppShell>
apps/web/app/login/page.tsx            rewrite LoginCard + BrandLockup
apps/web/app/admin/dashboard/page.tsx  rewrite com PageHeader + StatCard + MemberCard
apps/web/app/me/page.tsx               rewrite 2-col + LibraryItemRow + AiAssistantCard
apps/web/app/admin/cycles/page.tsx     wrap com DataTable
apps/web/app/admin/library/page.tsx    wrap com DataTable
packages/shared/src/index.ts           + re-export de design/tokens
```

### Deleted

```
apps/web/components/nav/app-nav.tsx    substituído pelo AppShell
```

---

## Task 1: Design tokens em `packages/shared`

**Files:**
- Create: `packages/shared/src/design/tokens.ts`
- Create: `packages/shared/src/design/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Criar `packages/shared/src/design/tokens.ts`**

```ts
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
```

- [ ] **Step 2: Criar `packages/shared/src/design/index.ts`**

```ts
export * from './tokens';
```

- [ ] **Step 3: Adicionar re-export em `packages/shared/src/index.ts`**

Read o arquivo atual primeiro pra ver o que já existe. Adicionar a linha:

```ts
export * from './design';
```

no final do arquivo (depois do `export const APP_VERSION` existente).

- [ ] **Step 4: Build do shared package**

Run: `pnpm --filter @ics-select/shared build`
Expected: `> tsc -p tsconfig.build.json` exit 0, `packages/shared/dist/design/tokens.js` existe.

- [ ] **Step 5: Verificar que o arquivo compilado existe**

Run: `ls packages/shared/dist/design/`
Expected: `index.d.ts  index.js  tokens.d.ts  tokens.js`

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/design packages/shared/src/index.ts
git commit -m "feat(shared): add design tokens module"
```

---

## Task 2: Fonts e CSS vars no web app

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Substituir `apps/web/app/layout.tsx` completamente**

Novo conteúdo:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ICS Select',
  description: 'Programa de Preparação Avançada para Entrevistas Técnicas',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Notas: o `className="min-h-screen bg-background text-foreground antialiased"` antigo virou só `min-h-screen` porque `bg-background` etc vão virar regras `@apply` no `globals.css` aplicadas em `html, body`.

- [ ] **Step 2: Substituir `apps/web/app/globals.css` completamente**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 220 29% 99%;
  --foreground: 222 47% 11%;
  --surface: 0 0% 100%;
  --surface-muted: 220 14% 97%;
  --surface-subtle: 220 14% 95%;
  --border: 220 13% 91%;
  --border-strong: 220 13% 83%;
  --foreground-muted: 215 25% 32%;
  --foreground-subtle: 215 20% 65%;
  --brand: 202 96% 54%;
  --brand-hover: 203 89% 48%;
  --brand-soft: 204 94% 94%;
  --brand-soft-foreground: 202 80% 24%;
  --success: 160 84% 39%;
  --success-soft: 152 76% 90%;
  --warning: 38 92% 50%;
  --warning-soft: 48 96% 89%;
  --danger: 0 84% 60%;
  --danger-soft: 0 93% 94%;
  --info: 217 91% 60%;
  --info-soft: 214 95% 92%;
}

html,
body {
  height: 100%;
}

body {
  @apply font-sans bg-background text-foreground antialiased;
}
```

- [ ] **Step 3: Verificar que build NÃO passa ainda (vai falhar por não ter `bg-background` no tailwind config)**

Run: `pnpm --filter @ics-select/web build`
Expected: Falha de compilação do Tailwind com algo como "The `bg-background` class does not exist" ou similar. **Essa falha é esperada** — tailwind config vai ser atualizado em Task 3.

Se passar mesmo assim (porque Tailwind 3 tolera classes em `@apply` via PostCSS), prossiga normalmente — não é um problema.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "feat(web): add Inter font + CSS vars for design tokens"
```

---

## Task 3: Tailwind config com tokens e HeroUI re-theme

**Files:**
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Substituir `apps/web/tailwind.config.ts` completamente**

```ts
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
```

- [ ] **Step 2: Verificar que o build do web passa**

Run: `pnpm --filter @ics-select/web build`
Expected: build completa sem erro. As páginas existentes compilam porque `bg-background`, `text-foreground`, etc. agora existem no Tailwind. Atenção aos warnings de Tailwind sobre `border` — deve funcionar com `colors.border.DEFAULT`.

Se houver erro de "border" não encontrado em alguma classe `border-border`, confirme que o config tem `border: { DEFAULT: 'hsl(var(--border) / <alpha-value>)' }`.

- [ ] **Step 3: Rodar dev server e abrir /login rapidamente pra smoke test**

Run: `pnpm --filter @ics-select/web dev`

Abrir http://localhost:3000/login e confirmar: página carrega, fonte agora é Inter (não system default), botão "Entrar com Google" ficou azul `#18a0fb` (antes era cinza/primary HeroUI default). **Não** precisa estar bonito — só precisa carregar sem erro. Matar o dev server depois (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "feat(web): map design tokens in tailwind + heroui theme"
```

---

## Task 4: Forced light no next-themes

**Files:**
- Modify: `apps/web/app/providers.tsx`

- [ ] **Step 1: Editar `apps/web/app/providers.tsx`**

Trocar a linha:

```tsx
<NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
```

por:

```tsx
<NextThemesProvider attribute="class" forcedTheme="light">
```

O arquivo inteiro depois da edição:

```tsx
'use client';

import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '../lib/auth/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
        <NextThemesProvider attribute="class" forcedTheme="light">
          <AuthProvider>{children}</AuthProvider>
        </NextThemesProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm --filter @ics-select/web build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/providers.tsx
git commit -m "feat(web): force light theme until dark mode is redesigned"
```

---

## Task 5: `BrandLockup` component

**Files:**
- Create: `apps/web/components/shell/brand-lockup.tsx`

- [ ] **Step 1: Criar o arquivo com o conteúdo completo abaixo**

```tsx
type BrandLockupSize = 'sm' | 'md' | 'lg' | 'xl';

interface BrandLockupProps {
  size?: BrandLockupSize;
  showWordmark?: boolean;
  className?: string;
}

const markSizes: Record<BrandLockupSize, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-12 w-12 text-xl',
  xl: 'h-14 w-14 text-2xl',
};

const wordmarkSizes: Record<BrandLockupSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

const gaps: Record<BrandLockupSize, string> = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-4',
};

export function BrandLockup({
  size = 'md',
  showWordmark = true,
  className = '',
}: BrandLockupProps) {
  return (
    <div className={`flex items-center ${gaps[size]} ${className}`}>
      <div
        className={`rounded-lg bg-brand text-white flex items-center justify-center font-black tracking-tighter shadow-sm flex-shrink-0 ${markSizes[size]}`}
        aria-hidden="true"
      >
        IS
      </div>
      {showWordmark && (
        <span className={`font-bold tracking-tight text-foreground ${wordmarkSizes[size]}`}>
          ICS Select
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm --filter @ics-select/web build`
Expected: build passa. Componente não é usado em lugar nenhum ainda, mas compila (typecheck + bundle).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/shell/brand-lockup.tsx
git commit -m "feat(web): add BrandLockup component"
```

---

## Task 6: `PageHeader` component

**Files:**
- Create: `apps/web/components/shell/page-header.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-6 pb-8 border-b border-border mb-8">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-foreground-muted mt-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/shell/page-header.tsx
git commit -m "feat(web): add PageHeader component"
```

---

## Task 7: `StatusChip` component

**Files:**
- Create: `apps/web/components/ui/status-chip.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
export type StatusChipStatus =
  | 'pending'
  | 'in_progress'
  | 'done_easy'
  | 'done_hard'
  | 'stuck';

interface StatusChipProps {
  status: StatusChipStatus;
  label?: string;
}

const statusStyles: Record<StatusChipStatus, { className: string; defaultLabel: string }> = {
  pending: {
    className: 'bg-surface-subtle text-foreground-muted',
    defaultLabel: 'Pendente',
  },
  in_progress: {
    className: 'bg-info-soft text-info',
    defaultLabel: 'Em progresso',
  },
  done_easy: {
    className: 'bg-success-soft text-success',
    defaultLabel: 'Concluído · Fácil',
  },
  done_hard: {
    className: 'bg-warning-soft text-warning',
    defaultLabel: 'Concluído · Difícil',
  },
  stuck: {
    className: 'bg-danger-soft text-danger',
    defaultLabel: 'Travado',
  },
};

export function StatusChip({ status, label }: StatusChipProps) {
  const config = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {label ?? config.defaultLabel}
    </span>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/status-chip.tsx
git commit -m "feat(web): add StatusChip component"
```

---

## Task 8: `StatCard` component

**Files:**
- Create: `apps/web/components/ui/stat-card.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    direction: 'up' | 'down';
  };
}

export function StatCard({ icon: Icon, label, value, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          {label}
        </p>
      </div>
      <div className="flex items-end justify-between gap-4 mt-6">
        <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              trend.direction === 'up' ? 'text-success' : 'text-danger'
            }`}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/stat-card.tsx
git commit -m "feat(web): add StatCard component"
```

---

## Task 9: `MemberCard` component

**Files:**
- Create: `apps/web/components/ui/member-card.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client';

import { Avatar, Button } from '@heroui/react';
import { ArrowRight } from 'lucide-react';

interface MemberCardProps {
  member: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  currentPlan?: {
    label: string;
    progressPercent: number;
  };
  stats?: {
    done: number;
    stuck: number;
  };
  onViewPlan?: () => void;
}

export function MemberCard({ member, currentPlan, stats, onViewPlan }: MemberCardProps) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-xs hover:shadow-sm hover:border-border-strong transition-all">
      <header className="flex items-center gap-3">
        <Avatar
          src={member.avatarUrl ?? undefined}
          name={member.name}
          size="md"
          className="flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
          <p className="text-xs text-foreground-muted truncate">{member.email}</p>
        </div>
      </header>

      <div className="border-t border-border my-4" />

      {currentPlan ? (
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-foreground-muted">
              Plano atual:{' '}
              <span className="text-foreground font-medium">{currentPlan.label}</span>
            </span>
            <span className="text-foreground-muted tabular-nums">
              {currentPlan.progressPercent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${Math.min(100, Math.max(0, currentPlan.progressPercent))}%` }}
              role="progressbar"
              aria-valuenow={currentPlan.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-foreground-subtle italic">Sem plano ativo</p>
      )}

      {stats && (
        <div className="flex items-center gap-4 mt-4 text-xs text-foreground-muted">
          <span>
            Concluídos: <span className="text-foreground font-medium">{stats.done}</span>
          </span>
          <span>
            Travados: <span className="text-foreground font-medium">{stats.stuck}</span>
          </span>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button
          size="sm"
          color="default"
          variant="flat"
          fullWidth
          endContent={<ArrowRight className="h-3.5 w-3.5" />}
          onPress={onViewPlan}
        >
          Ver plano
        </Button>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/member-card.tsx
git commit -m "feat(web): add MemberCard component"
```

---

## Task 10: `LibraryItemRow` component

**Files:**
- Create: `apps/web/components/ui/library-item-row.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client';

import { Button } from '@heroui/react';
import { BookOpen, ChevronRight, type LucideIcon } from 'lucide-react';
import { StatusChip, type StatusChipStatus } from './status-chip';

interface LibraryItemRowProps {
  icon?: LucideIcon;
  title: string;
  source: string;
  estimatedMinutes?: number | null;
  tags?: string[];
  status: StatusChipStatus;
  onClick?: () => void;
}

export function LibraryItemRow({
  icon: Icon = BookOpen,
  title,
  source,
  estimatedMinutes,
  tags = [],
  status,
  onClick,
}: LibraryItemRowProps) {
  const metadata: string[] = [source];
  if (estimatedMinutes) metadata.push(`~${estimatedMinutes}min`);
  if (tags.length) metadata.push(tags.slice(0, 2).join(', '));

  return (
    <div className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted transition-colors flex items-center gap-4">
      <div className="h-10 w-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground truncate">{title}</p>
        <p className="text-xs text-foreground-muted mt-0.5 truncate">
          {metadata.join(' · ')}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusChip status={status} />
        <Button
          size="sm"
          variant="light"
          color="default"
          isIconOnly
          onPress={onClick}
          aria-label="Ver detalhes"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/library-item-row.tsx
git commit -m "feat(web): add LibraryItemRow component"
```

---

## Task 11: `AiAssistantCard` component

**Files:**
- Create: `apps/web/components/ui/ai-assistant-card.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client';

import { ArrowRight, Sparkles } from 'lucide-react';

interface AiAssistantCardProps {
  title: string;
  description: string;
  ctaLabel: string;
  onCtaClick?: () => void;
}

export function AiAssistantCard({
  title,
  description,
  ctaLabel,
  onCtaClick,
}: AiAssistantCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-brand to-brand-hover text-white shadow-brand">
      <div
        className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative">
        <p className="text-xs font-medium opacity-80 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          IA Assistant
        </p>
        <h3 className="text-lg font-bold mt-3 tracking-tight">{title}</h3>
        <p className="text-sm opacity-90 mt-2 leading-relaxed">{description}</p>
        <button
          type="button"
          onClick={onCtaClick}
          className="bg-white text-brand rounded-md px-4 py-2 text-sm font-semibold hover:bg-white/90 mt-5 inline-flex items-center gap-2 transition-colors"
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/ai-assistant-card.tsx
git commit -m "feat(web): add AiAssistantCard component"
```

---

## Task 12: `DataTable` wrapper component

**Files:**
- Create: `apps/web/components/ui/data-table.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
import type { ReactNode } from 'react';

interface DataTableProps {
  header?: ReactNode;
  children: ReactNode;
}

export function DataTable({ header, children }: DataTableProps) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
      {header && (
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          {header}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/data-table.tsx
git commit -m "feat(web): add DataTable wrapper for HeroUI Table"
```

---

## Task 13: `SidebarItem` component

**Files:**
- Create: `apps/web/components/shell/sidebar-item.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export function SidebarItem({ href, label, icon: Icon, exact = false }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  const base =
    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors';
  const state = isActive
    ? 'bg-brand-soft text-brand-soft-foreground'
    : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle';

  return (
    <Link href={href} className={`${base} ${state}`}>
      <Icon
        className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-brand' : ''}`}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/shell/sidebar-item.tsx
git commit -m "feat(web): add SidebarItem component"
```

---

## Task 14: `Sidebar` component

**Files:**
- Create: `apps/web/components/shell/sidebar.tsx`

- [ ] **Step 1: Criar arquivo**

Nota importante: Sidebar NÃO se auto-posiciona. É um componente que renderiza conteúdo e assume que o parent (AppShell) controla o posicionamento (fixed desktop vs drawer mobile).

```tsx
'use client';

import {
  BookOpen,
  Calendar,
  Clock,
  LayoutDashboard,
  ListTodo,
  LogOut,
  type LucideIcon,
  Sparkles,
  Users,
} from 'lucide-react';
import { BrandLockup } from './brand-lockup';
import { SidebarItem } from './sidebar-item';

type Role = 'ADMIN' | 'MEMBER';

export interface SidebarUser {
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const adminItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/cycles', label: 'Ciclos', icon: Calendar },
  { href: '/admin/members', label: 'Membros', icon: Users },
  { href: '/admin/library', label: 'Acervo', icon: BookOpen },
  { href: '/admin/ai-usage', label: 'Uso de IA', icon: Sparkles },
];

const memberItems: NavItem[] = [
  { href: '/me', label: 'Meu plano', icon: ListTodo, exact: true },
  { href: '/me/availability', label: 'Disponibilidade', icon: Clock },
];

interface SidebarProps {
  user: SidebarUser;
  onLogout?: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const items = user.role === 'ADMIN' ? adminItems : memberItems;
  const initial = user.name.charAt(0).toUpperCase() || 'U';

  return (
    <aside className="h-screen w-60 border-r border-border bg-surface-muted flex flex-col">
      <div className="h-14 px-5 flex items-center border-b border-border flex-shrink-0">
        <BrandLockup size="md" />
      </div>

      <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
        {items.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            exact={item.exact}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md">
          <div className="h-8 w-8 rounded-full bg-brand-soft text-brand flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-[10px] text-foreground-muted truncate">{user.email}</p>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sair"
              className="h-8 w-8 flex items-center justify-center rounded-md text-foreground-muted hover:bg-surface-subtle hover:text-foreground transition-colors flex-shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/shell/sidebar.tsx
git commit -m "feat(web): add Sidebar component with role-based nav"
```

---

## Task 15: `Topbar` component

**Files:**
- Create: `apps/web/components/shell/topbar.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client';

import { Bell, Menu, Search } from 'lucide-react';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 h-14 bg-background/80 backdrop-blur-md border-b border-border lg:ml-60">
      <div className="h-full px-4 sm:px-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="h-9 w-9 flex items-center justify-center rounded-md text-foreground-muted hover:bg-surface-subtle transition-colors lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          disabled
          aria-label="Buscar (em breve)"
          className="hidden sm:flex h-9 px-3 items-center gap-2 text-xs text-foreground-subtle border border-border rounded-md disabled:opacity-60 cursor-default"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Buscar
          <kbd className="ml-2 text-[10px] font-mono">⌘K</kbd>
        </button>
        <button
          type="button"
          disabled
          aria-label="Notificações"
          className="h-9 w-9 flex items-center justify-center rounded-md text-foreground-muted disabled:opacity-60 cursor-default"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/shell/topbar.tsx
git commit -m "feat(web): add Topbar component"
```

---

## Task 16: `AppShell` component

**Files:**
- Create: `apps/web/components/shell/app-shell.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar, type SidebarUser } from './sidebar';
import { Topbar } from './topbar';

interface AppShellProps {
  user: SidebarUser;
  onLogout?: () => void;
  children: ReactNode;
}

export function AppShell({ user, onLogout, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar: fixed left, visible ≥lg */}
      <div className="fixed left-0 top-0 z-30 hidden lg:block">
        <Sidebar user={user} onLogout={onLogout} />
      </div>

      {/* Mobile drawer: overlay + sidebar, visible only when mobileOpen */}
      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <div className="fixed left-0 top-0 z-50 lg:hidden">
            <Sidebar user={user} onLogout={onLogout} />
          </div>
        </>
      )}

      <Topbar onMenuClick={() => setMobileOpen(true)} />

      <main className="lg:ml-60 min-h-[calc(100vh-3.5rem)]">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/shell/app-shell.tsx
git commit -m "feat(web): add AppShell with desktop sidebar + mobile drawer"
```

---

## Task 17: Swap do shell no `(app)/layout.tsx` + delete `AppNav`

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx`
- Delete: `apps/web/components/nav/app-nav.tsx`

**Contexto:** O `AppNav` antigo usa `useAuth()` do `lib/auth/auth-context` para pegar `user` (com `name`, `email`, `pictureUrl`, `role`) e `logout`. O `AppShell` novo aceita as mesmas informações via prop `user` e `onLogout`. O `(app)/layout.tsx` já chama `useAuth`, então só precisa passar os valores pro AppShell.

- [ ] **Step 1: Substituir `apps/web/app/(app)/layout.tsx` completamente**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { AppShell } from '../../components/shell/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (!user.privacyAcceptedAt) router.replace('/privacy');
  }, [user, isLoading, router]);

  if (isLoading || !user || !user.privacyAcceptedAt) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-foreground-muted text-sm">Carregando...</p>
      </main>
    );
  }

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.pictureUrl ?? null,
      }}
      onLogout={logout}
    >
      {children}
    </AppShell>
  );
}
```

**Nota:** Se `useAuth()` não expuser `logout` (só `user` e `isLoading`), abra `apps/web/lib/auth/auth-context.tsx` pra confirmar o shape. O AppNav antigo chama `logout` direto, então o hook precisa expor. Ajuste o import se necessário.

**Nota 2:** Se `user.email` não existir no shape retornado (e.g. é `user.profile.email`), ajuste o mapping. O plano assume um shape flat. Confirme olhando `auth-context.tsx`.

- [ ] **Step 2: Deletar `apps/web/components/nav/app-nav.tsx`**

```bash
rm apps/web/components/nav/app-nav.tsx
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa. Typecheck confirma que `user.email` e `user.role` existem no tipo retornado por `useAuth`. Se falhar com "Property 'email' does not exist", ajuste o mapping conforme o shape real de `useAuth`.

- [ ] **Step 4: Rodar Playwright pra garantir que auth flow ainda passa**

Run: `pnpm --filter @ics-select/web test`
Expected: `auth-flow.spec.ts` passa. Se falhar, provavelmente o `AppShell` está quebrando a renderização em alguma condição que o teste visita. Debugar olhando o relatório do Playwright.

- [ ] **Step 5: Smoke test dev**

Run: `pnpm --filter @ics-select/web dev`

Abrir http://localhost:3000 logado (ou fazer login). Confirmar:
- Sidebar aparece à esquerda com "IS" logomark + "ICS Select" wordmark
- Nav items do role correto (admin: 5 itens, member: 2 itens)
- Active state destaca a página atual em azul (`bg-brand-soft`)
- Topbar fino no topo com botões Search e Bell desabilitados
- Footer da sidebar mostra inicial do usuário + nome + email + botão logout
- Clicar em logout funciona (redireciona para /login)

Matar dev server.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(app)/layout.tsx apps/web/components/nav/app-nav.tsx
git commit -m "feat(web): swap AppNav for AppShell with sidebar navigation"
```

---

## Task 18: Rewrite `/login` page

**Files:**
- Modify: `apps/web/app/login/page.tsx`

**Contexto:** A página atual é simples — um botão que redireciona pra `${apiBase}/auth/google`. A rewrite preserva esse comportamento mas usa o `LoginCard` layout da spec. Responsivo pra funcionar como desktop + mobile numa única rota.

- [ ] **Step 1: Substituir `apps/web/app/login/page.tsx` completamente**

```tsx
'use client';

import { Building2 } from 'lucide-react';
import { BrandLockup } from '../../components/shell/brand-lockup';

export default function LoginPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const loginUrl = `${apiBase}/auth/google`;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration — blobs sutis (light mode friendly) */}
      <div
        className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-brand/8 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] h-[30%] w-[30%] rounded-full bg-brand/5 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Brand mobile: lockup fora do card */}
        <div className="mb-8 sm:mb-0 sm:hidden">
          <BrandLockup size="xl" />
        </div>

        <div className="w-full rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-md">
          {/* Brand desktop: lockup dentro do card */}
          <div className="hidden sm:flex justify-center mb-6">
            <BrandLockup size="lg" />
          </div>

          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Bem-vindo ao ICS Select
            </h1>
            <p className="text-sm text-foreground-muted leading-relaxed mt-2">
              Acesse a plataforma de preparação técnica para consultoria.
            </p>
          </div>

          <a
            href={loginUrl}
            className="mt-8 w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-surface text-foreground text-sm font-semibold rounded-lg border border-border hover:border-brand/50 hover:bg-brand-soft/30 transition-all active:scale-[0.98]"
          >
            <GoogleIcon />
            Entrar com Google
          </a>

          <div className="flex items-center gap-4 py-6">
            <div className="h-px flex-grow bg-border" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-foreground-subtle">
              Segurança
            </span>
            <div className="h-px flex-grow bg-border" />
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-brand-soft/40 border border-brand/10">
            <Building2 className="h-4 w-4 text-brand flex-shrink-0" aria-hidden="true" />
            <p className="text-xs text-foreground-muted leading-tight">
              Use seu e-mail institucional{' '}
              <span className="text-brand font-semibold">@inteli.edu.br</span> para autenticação
              automática.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <a
              href="#"
              className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted hover:text-brand transition-colors"
            >
              Problemas com o acesso? Fale com o suporte
            </a>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-6 mt-10 opacity-50">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-foreground tracking-tighter">SSO</span>
            <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">
              Ativo
            </span>
          </div>
          <div className="w-1 h-1 rounded-full bg-border-strong" />
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-foreground tracking-tighter">DATA</span>
            <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">
              Criptografado
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 3: Rodar Playwright**

Run: `pnpm --filter @ics-select/web test`
Expected: `auth-flow.spec.ts` passa. Se o teste procura por texto/botão específico (`text=Entrar com Google` ou similar), o novo layout preserva esses mesmos textos — deve continuar funcionando. Se falhar, ver o Playwright report e ajustar apenas o que for selector obsoleto.

- [ ] **Step 4: Smoke test manual**

Run: `pnpm --filter @ics-select/web dev`

Abrir http://localhost:3000/login em duas larguras:
- Desktop (≥1024px): logo dentro do card, card centralizado com shadow-md, blobs de fundo sutis, SSO/DATA badges decorativos abaixo
- Mobile (<640px): logo grande acima do card, card sem `max-w-md` ocupando largura disponível, sem badges inferiores

Confirmar que o botão Google ainda redireciona (clicar deve ir pro endpoint do backend — pode retornar erro se o backend não estiver rodando, tudo bem, o teste é só o redirect).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/login/page.tsx
git commit -m "feat(web): rewrite login with LoginCard + BrandLockup"
```

---

## Task 19: Rewrite `/admin/dashboard` page

**Files:**
- Modify: `apps/web/app/admin/dashboard/page.tsx`

**Contexto:** A página atual renderiza um grid de cards de membro com stats (plans, done items, stuck items) — precisa rewrite usando `PageHeader`, `StatCard`, e `MemberCard`. A query/endpoint de dados não muda. Antes de editar, **read o arquivo atual pra entender o shape dos dados que ele consome**.

- [ ] **Step 1: Ler arquivo atual pra entender dados**

Run: Read `apps/web/app/admin/dashboard/page.tsx`

Anotar: qual hook/query é usado (provavelmente TanStack Query + um cliente `api.*`), qual o shape de cada item (campos disponíveis: `member.name`, `member.email`, `stats.*`, etc).

- [ ] **Step 2: Rewrite da página preservando a fetching logic original**

Substituir o arquivo completamente com o template abaixo, **adaptando o mapping dos dados reais pro shape esperado por `StatCard` e `MemberCard`**:

```tsx
'use client';

import { Button } from '@heroui/react';
import { Activity, AlertTriangle, CheckCircle2, Plus, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from '../../../components/shell/page-header';
import { StatCard } from '../../../components/ui/stat-card';
import { MemberCard } from '../../../components/ui/member-card';
// IMPORTANTE: preservar os imports de data fetching do arquivo atual.
// Exemplo (ajustar ao que realmente está lá):
// import { useQuery } from '@tanstack/react-query';
// import { api } from '../../../lib/api';

export default function AdminDashboardPage() {
  // PRESERVAR a lógica original de fetching aqui.
  // Exemplo placeholder — substituir pelo que o arquivo antigo fazia:
  // const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api.adminDashboard() });
  //
  // O resto do componente assume que você tem:
  //   - data.cycle:     { number: number, title: string, weekNumber: number }
  //   - data.stats:     { activeMembers: number, averageProgress: number, stuckItems: number, weeksOfFocus: number }
  //   - data.members:   Array<{ id, name, email, avatarUrl, currentPlanLabel, progressPercent, stats: { done, stuck } }>
  //
  // Se o shape atual do endpoint é diferente, MAPEIE aqui antes de passar pros componentes.

  // Stub temporário pra o componente ser typeable. Remover quando plugar os dados reais.
  const data: {
    cycle: { number: number; title: string; weekNumber: number };
    stats: { activeMembers: number; averageProgress: number; stuckItems: number; weeksOfFocus: number };
    members: Array<{
      id: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
      currentPlanLabel?: string;
      progressPercent?: number;
      stats?: { done: number; stuck: number };
    }>;
  } | undefined = undefined;

  if (!data) {
    return (
      <div className="text-sm text-foreground-muted">Carregando dashboard...</div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`Ciclo ${String(data.cycle.number).padStart(2, '0')}`}
        title={data.cycle.title}
        description={`Semana ${data.cycle.weekNumber} · Visão do administrador`}
        actions={
          <>
            <Button variant="bordered" size="md">
              Relatório
            </Button>
            <Button color="primary" size="md" startContent={<Plus className="h-4 w-4" />}>
              Novo ciclo
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Membros ativos"
          value={data.stats.activeMembers}
        />
        <StatCard
          icon={TrendingUp}
          label="Progresso médio"
          value={`${data.stats.averageProgress}%`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Itens travados"
          value={data.stats.stuckItems}
        />
        <StatCard
          icon={Activity}
          label="Semanas de foco"
          value={data.stats.weeksOfFocus}
        />
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            Membros do ciclo
          </h2>
          <p className="text-sm text-foreground-muted">
            {data.members.length} {data.members.length === 1 ? 'membro' : 'membros'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.members.map((m) => (
            <MemberCard
              key={m.id}
              member={{
                id: m.id,
                name: m.name,
                email: m.email,
                avatarUrl: m.avatarUrl,
              }}
              currentPlan={
                m.currentPlanLabel && m.progressPercent !== undefined
                  ? { label: m.currentPlanLabel, progressPercent: m.progressPercent }
                  : undefined
              }
              stats={m.stats}
            />
          ))}
        </div>
      </section>
    </>
  );
}
```

**IMPORTANTE para o executor:** Esse template tem um `data = undefined` stub que vai quebrar o dashboard em runtime. Você DEVE substituir pelo fetching real copiado do arquivo antigo, mapeando os campos conforme a sua API de verdade retorna. Se o backend retorna shape diferente do assumido (ex: não tem `cycle.title`, `stats.weeksOfFocus`, etc), ADAPTE o mapping ou remova o StatCard correspondente — não invente dados no backend.

- [ ] **Step 3: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa se o mapping de dados for type-safe. Se falhar, o typescript vai apontar exatamente qual campo não existe — ajuste o mapping.

- [ ] **Step 4: Smoke test manual**

Run: `pnpm --filter @ics-select/web dev`

Login como ADMIN, ir pra `/admin/dashboard`. Confirmar:
- PageHeader com eyebrow azul "Ciclo XX"
- 4 StatCards em grid (pode ser menos que 4 se você ajustou o mapping)
- Grid de MemberCards com avatar, nome, email, progress bar brand, botão "Ver plano"
- Layout respira, não está quebrado horizontalmente

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/dashboard/page.tsx
git commit -m "feat(web): rewrite admin dashboard with PageHeader + StatCard + MemberCard"
```

---

## Task 20: Rewrite `/me` page

**Files:**
- Modify: `apps/web/app/me/page.tsx`

**Contexto:** A página atual mostra o plano semanal do membro com progress bar e lista de itens. Rewrite usa `PageHeader`, `LibraryItemRow` em coluna principal, e `AiAssistantCard` + "Atividade Recente" mock em aside. Preservar fetching original.

- [ ] **Step 1: Ler arquivo atual**

Run: Read `apps/web/app/me/page.tsx`

Anotar: estrutura da query, shape dos items, como o status de cada item é determinado (fácil/difícil/pendente/travado), função que lida com clicar num item (provavelmente navega pra `/me/plan/[planId]/item/[itemId]`).

- [ ] **Step 2: Rewrite preservando fetching**

Template abaixo — adaptar ao shape real dos dados:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '../../components/shell/page-header';
import { LibraryItemRow } from '../../components/ui/library-item-row';
import type { StatusChipStatus } from '../../components/ui/status-chip';
import { AiAssistantCard } from '../../components/ui/ai-assistant-card';
// PRESERVAR imports originais de data fetching aqui

type RecentActivity = {
  id: string;
  whenLabel: string;
  text: string;
};

// MOCK HARDCODED — spec deferred o feed real pra uma fase futura
const RECENT_ACTIVITY_MOCK: RecentActivity[] = [
  { id: '1', whenLabel: 'Ontem', text: 'Marcou "Array & Hashing" como concluído' },
  { id: '2', whenLabel: '2 dias atrás', text: 'Começou "Two Pointers & Sliding Window"' },
  { id: '3', whenLabel: '3 dias atrás', text: 'Assistiu aula "Fundamentos de Algoritmos"' },
];

export default function MyPlanPage() {
  const router = useRouter();

  // PRESERVAR a lógica original de fetching aqui.
  // Assume shape (ajustar conforme realidade):
  //   data.plan: { weekNumber: number, title: string, dateRange: string (e.g. "8 a 14 de abril") }
  //   data.items: Array<{ id, title, source, estimatedMinutes, tags, status: StatusChipStatus, planId }>
  //   data.progress: { done: number, total: number, percent: number }

  // Stub temporário — remover quando plugar endpoint real
  const data: {
    plan: { weekNumber: number; title: string; dateRange: string };
    items: Array<{
      id: string;
      title: string;
      source: string;
      estimatedMinutes?: number | null;
      tags?: string[];
      status: StatusChipStatus;
      planId: string;
    }>;
    progress: { done: number; total: number; percent: number };
  } | undefined = undefined;

  if (!data) {
    return <div className="text-sm text-foreground-muted">Carregando seu plano...</div>;
  }

  const handleItemClick = (planId: string, itemId: string) => {
    router.push(`/me/plan/${planId}/item/${itemId}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      <div className="min-w-0">
        <PageHeader
          eyebrow={`Semana ${String(data.plan.weekNumber).padStart(2, '0')}`}
          title={data.plan.title}
          description={data.plan.dateRange}
        />

        <div>
          <div className="flex justify-between text-xs text-foreground-muted mb-2">
            <span>Progresso semanal</span>
            <span className="font-medium text-foreground tabular-nums">
              {data.progress.done} de {data.progress.total} · {data.progress.percent}%
            </span>
          </div>
          <div
            className="h-2 rounded-full bg-surface-subtle overflow-hidden"
            role="progressbar"
            aria-valuenow={data.progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${data.progress.percent}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-8">
          {data.items.map((item) => (
            <LibraryItemRow
              key={item.id}
              title={item.title}
              source={item.source}
              estimatedMinutes={item.estimatedMinutes}
              tags={item.tags}
              status={item.status}
              onClick={() => handleItemClick(item.planId, item.id)}
            />
          ))}
        </div>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <AiAssistantCard
          title="Otimize seu plano"
          description="Sugestões baseadas no seu histórico e dificuldades ao longo do ciclo."
          ctaLabel="Gerar sugestões"
          onCtaClick={() => {
            // Abrir context chat existente ou chamar endpoint de IA.
            // Implementação do click fica como followup se ContextChat já tem trigger próprio.
          }}
        />

        <section>
          <h2 className="text-xs uppercase tracking-wider font-semibold text-foreground-muted mb-3">
            Atividade recente
          </h2>
          <ul className="space-y-3">
            {RECENT_ACTIVITY_MOCK.map((activity) => (
              <li key={activity.id} className="text-sm">
                <p className="text-xs text-foreground-subtle">{activity.whenLabel}</p>
                <p className="text-foreground-muted leading-snug mt-0.5">{activity.text}</p>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-foreground-subtle italic mt-4">
            Feed real em breve
          </p>
        </section>
      </aside>
    </div>
  );
}
```

**IMPORTANTE:** substitua o stub `data = undefined` pela fetching real copiada do arquivo antigo. Mapeie o shape retornado pela API pro shape que os componentes esperam (pode ser necessário converter status strings do backend pros 5 estados do `StatusChipStatus`).

- [ ] **Step 3: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 4: Smoke test manual**

Run: `pnpm --filter @ics-select/web dev`

Login como MEMBER, ir pra `/me`. Confirmar:
- Layout 2-col em desktop, empilhado em mobile
- PageHeader com eyebrow "Semana XX"
- Progress bar brand azul
- Lista de LibraryItemRow cada um com ícone colorido, título, metadata, StatusChip, botão chevron
- Aside direita: AiAssistantCard com gradiente brand + shadow-brand + decoração blur
- "Atividade recente" com 3 items mock + disclaimer "Feed real em breve"
- Clicar num item navega pra detail page

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/me/page.tsx
git commit -m "feat(web): rewrite /me with 2-col layout + LibraryItemRow + AiAssistantCard"
```

---

## Task 21: Aplicar `DataTable` em `/admin/cycles` e `/admin/library`

**Files:**
- Modify: `apps/web/app/admin/cycles/page.tsx`
- Modify: `apps/web/app/admin/library/page.tsx`

**Contexto:** Essas páginas usam HeroUI `<Table>` diretamente. O wrapper `DataTable` só adiciona o frame externo (`rounded-xl border border-border bg-surface shadow-xs overflow-hidden`) e opcionalmente um header slot com título/filtros/actions. Mudança mínima, não toca na estrutura interna da table.

- [ ] **Step 1: Ler `apps/web/app/admin/cycles/page.tsx` atual**

Run: Read `apps/web/app/admin/cycles/page.tsx`

Identificar: onde está o `<Table>`, onde estão os botões "Novo ciclo" e filtros (provavelmente acima da table).

- [ ] **Step 2: Wrap a Table existente com `DataTable`**

Edit mínimo: encontrar o bloco que renderiza o `<Table>`, envolvê-lo com `<DataTable header={...}>...</DataTable>`. Mover os botões "Novo ciclo"/filtros pra dentro do `header` prop.

Exemplo de transformação — **antes**:

```tsx
<div>
  <div className="flex justify-between mb-4">
    <h1 className="text-2xl font-semibold">Ciclos</h1>
    <Button color="primary" onPress={onOpen}>Novo ciclo</Button>
  </div>
  <Table aria-label="Ciclos">
    ...
  </Table>
  <Modal isOpen={isOpen} ...>...</Modal>
</div>
```

**Depois** (usando PageHeader + DataTable):

```tsx
<>
  <PageHeader
    title="Ciclos"
    description="Gerencie os ciclos do programa"
    actions={
      <Button color="primary" startContent={<Plus className="h-4 w-4" />} onPress={onOpen}>
        Novo ciclo
      </Button>
    }
  />
  <DataTable>
    <Table aria-label="Ciclos" removeWrapper>
      ...
    </Table>
  </DataTable>
  <Modal isOpen={isOpen} ...>...</Modal>
</>
```

Importante: adicionar `removeWrapper` no HeroUI `<Table>` pra evitar card duplicado (HeroUI Table por padrão renderiza um wrapper interno com borda e shadow — conflita com o frame do `DataTable`).

Imports novos a adicionar:

```tsx
import { Plus } from 'lucide-react';
import { PageHeader } from '../../../components/shell/page-header';
import { DataTable } from '../../../components/ui/data-table';
```

- [ ] **Step 3: Build após mudança em cycles**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 4: Ler `apps/web/app/admin/library/page.tsx` atual**

Run: Read `apps/web/app/admin/library/page.tsx`

Identificar mesma estrutura: header/actions + Table.

- [ ] **Step 5: Aplicar mesma transformação em library**

Mesmo padrão do Step 2, adaptando title/description/actions. Adicionar `removeWrapper` no `<Table>`.

- [ ] **Step 6: Build final**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 7: Smoke test manual**

Run: `pnpm --filter @ics-select/web dev`

Login como ADMIN. Confirmar `/admin/cycles` e `/admin/library`:
- PageHeader no topo com título, descrição, actions
- Table dentro de um card com border + shadow-xs (não dois frames)
- Linhas da table legíveis, cores coerentes com o resto do app

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/admin/cycles/page.tsx apps/web/app/admin/library/page.tsx
git commit -m "feat(web): wrap admin tables with DataTable + PageHeader"
```

---

## Task 22: Smoke test e correções pontuais nas páginas herdadas

**Files:**
- Potentially modify: various pages under `apps/web/app/` (only if issues found)

**Contexto:** As seguintes páginas herdaram o re-theme do HeroUI mas não foram redesenhadas. Precisa revisitar cada uma e confirmar que ficou legível/coerente. Problemas típicos: (a) cor hardcoded `text-foreground/70` continua funcionando mas parece estranha em light, (b) HeroUI `classNames` com cor fixa não respeita o novo tema, (c) algum `<Card>` com padding inadequado pro novo estilo, (d) botões com `variant="ghost"` que ficam invisíveis no fundo branco.

- [ ] **Step 1: Rodar dev server**

Run: `pnpm --filter @ics-select/web dev`

- [ ] **Step 2: Checklist de páginas pra visitar**

Pra cada página abaixo, fazer login com o role apropriado e abrir:

- [ ] `/privacy` (qualquer role, acesso antes do `privacyAcceptedAt`)
- [ ] `/me/availability` (MEMBER)
- [ ] `/me/plan/{someValidPlanId}/item/{someValidItemId}` (MEMBER) — pode precisar ir via /me e clicar num item
- [ ] `/admin/cycles/{id}` (ADMIN) — clicar num ciclo do /admin/cycles
- [ ] `/admin/cycles/{id}/classes` (ADMIN) — dentro do detalhe do ciclo
- [ ] `/admin/library/new` (ADMIN)
- [ ] `/admin/library/{id}` (ADMIN) — clicar num item
- [ ] `/admin/members` (ADMIN)
- [ ] `/admin/members/{id}` (ADMIN)
- [ ] `/admin/ai-usage` (ADMIN)

- [ ] **Step 3: Pra cada página, verificar:**

1. **Layout não quebrou** — não tem conteúdo cortado, overflow inesperado, sobreposição com sidebar
2. **Texto legível** — nenhum texto cinza muito claro sobre fundo branco (`text-foreground/30` etc)
3. **Botões visíveis** — botões `ghost`/`light` ainda têm hitbox claro, botões `primary` estão azul brand
4. **Inputs/Selects** — focus ring azul brand, placeholder legível
5. **Cards não-duplicados** — nenhum frame HeroUI default conflitando com um wrapper custom
6. **Modals** — backdrop com blur sutil, card dentro com shadow-md

- [ ] **Step 4: Aplicar correções pontuais onde necessário**

Se encontrar problema, ajustar inline. Padrões comuns de fix:

- **Texto pálido demais:** trocar `text-foreground/50` ou `text-foreground/70` por `text-foreground-muted` ou `text-foreground-subtle` apropriado.
- **Botão sem contorno visível:** adicionar `variant="bordered"` se for ghost sobre fundo claro demais.
- **Progress bar cor errada:** passar `color="primary"` explicitamente se HeroUI não herdar.
- **Card duplicado:** remover o `<Card>` externo e usar `<div className="rounded-xl border border-border bg-surface p-6 shadow-xs">` manual.
- **Texto em português quebrado:** não mexer — a spec não altera copy.

- [ ] **Step 5: Build final pra confirmar que nada quebrou**

Run: `pnpm --filter @ics-select/web build`
Expected: passa.

- [ ] **Step 6: Rodar Playwright uma última vez**

Run: `pnpm --filter @ics-select/web test`
Expected: `auth-flow.spec.ts` passa.

- [ ] **Step 7: Commit (se houve ajustes)**

Se corrigiu alguma coisa:

```bash
git add apps/web/app/
git commit -m "fix(web): polish inherited pages after design system rollout"
```

Se não precisou ajustar nada, pular o commit e só mencionar no resumo final que as páginas herdadas passaram intactas.

---

## Self-Review (checklist realizada pelo autor do plano)

**Spec coverage:**
- [x] Fundações/tokens (paleta, tipografia, spacing, radius, shadows) — Tasks 1, 2, 3
- [x] Re-tematização HeroUI — Task 3
- [x] Font loading (Inter) — Task 2
- [x] Forced light — Task 4
- [x] Tokens compartilhados — Task 1
- [x] Shell layout (sidebar w-60, topbar h-14, main ml-60, breakpoints) — Tasks 13-16
- [x] Componentes assinatura (BrandLockup, PageHeader, StatCard, MemberCard, LibraryItemRow, StatusChip, AiAssistantCard, DataTable) — Tasks 5-12
- [x] Shell components (AppShell, Sidebar, SidebarItem, Topbar) — Tasks 13-16
- [x] /login desktop + mobile responsivo — Task 18
- [x] /admin/dashboard rewrite — Task 19
- [x] /me rewrite — Task 20
- [x] DataTable em /admin/cycles e /admin/library — Task 21
- [x] Propagação por re-theme — Task 3 (automático) + Task 22 (validação manual)
- [x] Ordem de implementação (tokens→tailwind→signature→shell→swap→pages) — Tasks 1-22 seguem essa ordem
- [x] Testes e verificação (build + Playwright + smoke manual) — nas tasks que tocam shell/login/pages

**Placeholder scan:** Nenhum "TBD", "TODO" ou "implement later". Os stubs `data = undefined` nas tasks 19 e 20 são explicitamente marcados como "executor DEVE substituir pela lógica real" — não são placeholders mas instruções de adaptação ao código existente.

**Type consistency:**
- `SidebarUser` definido em `sidebar.tsx`, consumido em `app-shell.tsx` via re-export — Tasks 14, 16
- `StatusChipStatus` definido em `status-chip.tsx`, consumido em `library-item-row.tsx` — Tasks 7, 10
- `MemberCard` props shape (`member: { id, name, email, avatarUrl }`) consistente com o consumo em Task 19
- `LibraryItemRow` props shape consistente com consumo em Task 20
- `useAuth()` hook: plano assume `{ user: { name, email, role, pictureUrl }, logout, isLoading }` — Task 17 instrui o executor a confirmar shape olhando `lib/auth/auth-context.tsx` antes de fazer o mapping

**Sem gaps identificados.**
