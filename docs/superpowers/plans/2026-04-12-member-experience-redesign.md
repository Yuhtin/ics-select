# Member Experience Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the corporate dashboard member experience with a gamified learning map (Super Mario/Candy Crush style progression), a Google Calendar-style weekly view, and a team mural — all wrapped in a warm, inviting visual identity.

**Architecture:** New member layout with transparent topbar + map area + stats sidebar. The map is DOM-based (React components positioned with CSS absolute + SVG bezier paths). Framer Motion handles animations. Admin layout is untouched. Three new API endpoints support the worlds view, members progress, and expanded feedback.

**Tech Stack:** Next.js 15 App Router, React, Framer Motion, SVG, Tailwind CSS, HeroUI, TanStack Query, NestJS, Prisma.

**Spec:** `docs/superpowers/specs/2026-04-12-member-experience-redesign.md`

---

## File Structure

### New files (frontend)

```
apps/web/
├── app/(member)/                          # New route group for member experience
│   ├── layout.tsx                         # Member layout: topbar + main + stats sidebar
│   ├── page.tsx                           # Redirects to /map
│   ├── map/
│   │   └── page.tsx                       # World select + node map (main experience)
│   ├── calendar/
│   │   └── page.tsx                       # Weekly calendar view
│   └── members/
│       └── page.tsx                       # Team mural
├── components/member/
│   ├── topbar-member.tsx                  # Transparent floating topbar for members
│   ├── bottom-tab-bar.tsx                 # Mobile bottom nav
│   ├── stats-sidebar.tsx                  # Right sidebar with progress ring, modules, streak
│   ├── stats-banner-mobile.tsx            # Compact horizontal stats for mobile
│   ├── world-select.tsx                   # World cards grid (plan history)
│   ├── world-card.tsx                     # Individual world card (completed/active/locked)
│   ├── node-map.tsx                       # Main map: SVG path + positioned nodes
│   ├── map-node.tsx                       # Individual node circle with status styling
│   ├── map-path.tsx                       # SVG bezier path between nodes
│   ├── map-decorations.tsx                # Decorative SVGs (stars, flags, bushes)
│   ├── node-hover-card.tsx                # Hover tooltip with title, time, platform border
│   ├── node-expanded-card.tsx             # Click-expanded card with full info + feedback form
│   ├── feedback-form.tsx                  # Status buttons (Consegui/Travei/Duvidas) + textarea
│   ├── calendar-weekly.tsx                # Weekly grid calendar component
│   ├── calendar-mini.tsx                  # Mini month calendar
│   ├── calendar-session-card.tsx          # Session card positioned in time grid
│   ├── calendar-day-list.tsx              # Mobile: day session list
│   ├── member-card.tsx                    # Team member card with progress + ranking
│   └── platform-colors.ts                # Platform color map (YouTube red, LeetCode orange, etc.)
```

### Modified files (frontend)

```
apps/web/app/globals.css                   # Replace color palette (warm theme)
apps/web/tailwind.config.ts                # Update color tokens
apps/web/app/(app)/layout.tsx              # Add role-based redirect: MEMBER → (member) group
apps/web/components/shell/sidebar.tsx       # Remove member nav items (members use new layout)
```

### New files (API)

```
apps/api/src/me/me.controller.ts           # Add GET /me/plans endpoint
apps/api/src/me/me.service.ts              # Add listPlans method
apps/api/src/weekly-plans/weekly-plans.controller.ts  # Extend markDone with feedback fields
apps/api/src/weekly-plans/dto.ts           # Extend MarkItemDoneSchema with completionStatus + feedback
apps/api/src/cycles/cycles.controller.ts   # Add GET /cycles/:id/members/progress
apps/api/src/cycles/cycles.service.ts      # Add membersProgress method
```

---

## Phase 1: Foundation (Palette + Member Layout Shell)

### Task 1: Update Color Palette

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Replace CSS variables in globals.css**

In `apps/web/app/globals.css`, replace the `:root` color block:

```css
:root {
  /* Warm base */
  --background: 30 50% 98%;          /* #FDF8F3 creme */
  --foreground: 30 30% 12%;          /* #2D2418 marrom escuro */

  --surface: 0 0% 100%;
  --surface-muted: 30 30% 96%;
  --surface-subtle: 30 20% 94%;

  --border: 30 10% 82%;
  --border-strong: 30 6% 52%;

  --foreground-muted: 30 10% 32%;
  --foreground-subtle: 30 6% 52%;

  /* Accent — coral quente */
  --brand: 24 95% 53%;               /* #F97316 */
  --brand-hover: 21 90% 45%;
  --brand-soft: 24 100% 93%;
  --brand-soft-foreground: 21 80% 20%;

  /* Status */
  --success: 160 84% 39%;            /* #10B981 */
  --success-soft: 152 76% 90%;
  --warning: 38 92% 50%;             /* #F59E0B */
  --warning-soft: 48 96% 89%;
  --danger: 0 72% 51%;               /* #EF4444 */
  --danger-soft: 0 100% 94%;
  --info: 24 95% 53%;
  --info-soft: 24 100% 93%;

  /* Platform colors (used in Tailwind as custom classes) */
  --platform-youtube: 0 100% 50%;
  --platform-leetcode: 36 100% 54%;
  --platform-medium: 0 0% 10%;
  --platform-github: 263 70% 58%;
  --platform-article: 174 84% 29%;
  --platform-book: 33 90% 43%;

  /* Map-specific */
  --map-path: 30 20% 80%;
  --map-path-done: 24 95% 53%;
  --map-bg-start: 30 50% 98%;
  --map-bg-end: 24 40% 96%;
}
```

- [ ] **Step 2: Update tailwind.config.ts with platform colors and map tokens**

Add to the `colors` object in `apps/web/tailwind.config.ts`:

```typescript
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
```

- [ ] **Step 3: Update HeroUI theme primary color**

In `apps/web/tailwind.config.ts`, update the HeroUI plugin config to use the new coral brand:

```typescript
themes: {
  light: {
    colors: {
      primary: { DEFAULT: '#F97316', foreground: '#FFFFFF' },
    },
  },
},
```

- [ ] **Step 4: Verify the app compiles**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm --filter @ics-select/web build`
Expected: Build succeeds. The existing pages will now use the warm palette.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/globals.css apps/web/tailwind.config.ts
git commit -m "style(web): replace corporate blue palette with warm coral theme"
```

---

### Task 2: Platform Color Map Utility

**Files:**
- Create: `apps/web/components/member/platform-colors.ts`

- [ ] **Step 1: Create the platform color utility**

```typescript
// apps/web/components/member/platform-colors.ts

type PlatformKey = 'youtube' | 'leetcode' | 'medium' | 'github' | 'article' | 'book' | 'default';

const URL_PATTERNS: Array<{ pattern: RegExp; key: PlatformKey }> = [
  { pattern: /youtube\.com|youtu\.be/i, key: 'youtube' },
  { pattern: /leetcode\.com/i, key: 'leetcode' },
  { pattern: /medium\.com/i, key: 'medium' },
  { pattern: /github\.com/i, key: 'github' },
];

const FORMAT_FALLBACKS: Record<string, PlatformKey> = {
  VIDEO: 'youtube',
  ARTICLE: 'article',
  BOOK: 'book',
  PROBLEM: 'leetcode',
};

export function getPlatformKey(url: string | null, format: string): PlatformKey {
  if (url) {
    for (const { pattern, key } of URL_PATTERNS) {
      if (pattern.test(url)) return key;
    }
  }
  return FORMAT_FALLBACKS[format] ?? 'default';
}

export const PLATFORM_BORDER_CLASS: Record<PlatformKey, string> = {
  youtube: 'border-platform-youtube',
  leetcode: 'border-platform-leetcode',
  medium: 'border-platform-medium',
  github: 'border-platform-github',
  article: 'border-platform-article',
  book: 'border-platform-book',
  default: 'border-border-strong',
};

export const PLATFORM_BG_CLASS: Record<PlatformKey, string> = {
  youtube: 'bg-platform-youtube/10',
  leetcode: 'bg-platform-leetcode/10',
  medium: 'bg-platform-medium/10',
  github: 'bg-platform-github/10',
  article: 'bg-platform-article/10',
  book: 'bg-platform-book/10',
  default: 'bg-surface-subtle',
};

export const PLATFORM_LABEL: Record<PlatformKey, string> = {
  youtube: 'YouTube',
  leetcode: 'LeetCode',
  medium: 'Medium',
  github: 'GitHub',
  article: 'Artigo',
  book: 'Livro',
  default: 'Material',
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/member/platform-colors.ts
git commit -m "feat(web): add platform color mapping utility"
```

---

### Task 3: Member Topbar

**Files:**
- Create: `apps/web/components/member/topbar-member.tsx`
- Create: `apps/web/components/member/bottom-tab-bar.tsx`

- [ ] **Step 1: Create the transparent floating topbar**

```typescript
// apps/web/components/member/topbar-member.tsx
'use client';

import { Calendar, Compass, LogOut, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { BrandLockup } from '../shell/brand-lockup';

interface TopbarMemberProps {
  userName: string;
  avatarUrl?: string | null;
  onLogout?: () => void;
}

const NAV_ITEMS = [
  { href: '/map', label: 'Mapa', icon: Compass },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/members', label: 'Membros', icon: Users },
] as const;

export function TopbarMember({ userName, avatarUrl, onLogout }: TopbarMemberProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const initial = userName.charAt(0).toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 hidden lg:flex items-center justify-between h-14 px-6 backdrop-blur-xl bg-background/70 border-b border-border/40">
      <BrandLockup size="md" />

      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand/10 text-brand'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="h-9 w-9 rounded-full bg-brand-soft text-brand flex items-center justify-center text-sm font-bold overflow-hidden"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-12 w-48 bg-surface border border-border rounded-xl shadow-md py-2 z-50">
            <Link
              href="/me/availability"
              className="flex items-center gap-2 px-4 py-2 text-sm text-foreground-muted hover:bg-surface-subtle"
              onClick={() => setMenuOpen(false)}
            >
              <Settings className="h-4 w-4" />
              Disponibilidade
            </Link>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger-soft w-full text-left"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create the mobile bottom tab bar**

```typescript
// apps/web/components/member/bottom-tab-bar.tsx
'use client';

import { Calendar, Compass, User, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/map', label: 'Mapa', icon: Compass },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/members', label: 'Membros', icon: Users },
  { href: '/me/availability', label: 'Perfil', icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden flex items-center justify-around h-16 bg-surface/90 backdrop-blur-xl border-t border-border/40 safe-area-pb">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
              active ? 'text-brand' : 'text-foreground-muted'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/topbar-member.tsx apps/web/components/member/bottom-tab-bar.tsx
git commit -m "feat(web): add member topbar and mobile bottom tab bar"
```

---

### Task 4: Stats Sidebar + Mobile Banner

**Files:**
- Create: `apps/web/components/member/stats-sidebar.tsx`
- Create: `apps/web/components/member/stats-banner-mobile.tsx`

- [ ] **Step 1: Create the stats sidebar**

```typescript
// apps/web/components/member/stats-sidebar.tsx
'use client';

import { BookOpen, Clock, Flame } from 'lucide-react';

interface StatsSidebarProps {
  done: number;
  total: number;
  daysRemaining: number;
  streak: number;
}

function RingProgress({ percent, size, strokeWidth }: { percent: number; size: number; strokeWidth: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--surface-subtle))" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--brand))" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-extrabold text-foreground">{percent}%</span>
      </div>
    </div>
  );
}

export function StatsSidebar({ done, total, daysRemaining, streak }: StatsSidebarProps) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-[300px] flex-shrink-0 sticky top-20 self-start">
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col items-center">
        <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-4 self-start">
          Progresso Semanal
        </h3>
        <RingProgress percent={percent} size={130} strokeWidth={10} />
      </div>

      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-soft flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{done}/{total}</p>
            <p className="text-xs text-foreground-muted">modulos concluidos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-warning-soft flex items-center justify-center">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{daysRemaining}</p>
            <p className="text-xs text-foreground-muted">dias restantes</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-danger-soft flex items-center justify-center">
            <Flame className="h-5 w-5 text-danger" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{streak}</p>
            <p className="text-xs text-foreground-muted">dias consecutivos</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create the mobile stats banner**

```typescript
// apps/web/components/member/stats-banner-mobile.tsx
'use client';

import { BookOpen, Clock, Flame } from 'lucide-react';

interface StatsBannerMobileProps {
  done: number;
  total: number;
  daysRemaining: number;
  streak: number;
}

export function StatsBannerMobile({ done, total, daysRemaining, streak }: StatsBannerMobileProps) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="lg:hidden flex items-center gap-4 px-4 py-3 bg-surface/80 backdrop-blur-sm border-b border-border/40 overflow-x-auto">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="h-8 w-8 rounded-full border-2 border-brand flex items-center justify-center">
          <span className="text-xs font-bold text-brand">{percent}%</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-foreground-muted">
        <BookOpen className="h-3.5 w-3.5" />
        <span className="font-medium">{done}/{total}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-foreground-muted">
        <Clock className="h-3.5 w-3.5" />
        <span className="font-medium">{daysRemaining}d</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-foreground-muted">
        <Flame className="h-3.5 w-3.5" />
        <span className="font-medium">{streak}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/stats-sidebar.tsx apps/web/components/member/stats-banner-mobile.tsx
git commit -m "feat(web): add stats sidebar and mobile stats banner"
```

---

### Task 5: Member Layout + Route Group

**Files:**
- Create: `apps/web/app/(member)/layout.tsx`
- Modify: `apps/web/app/(app)/layout.tsx`

- [ ] **Step 1: Create the (member) route group layout**

```typescript
// apps/web/app/(member)/layout.tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { TopbarMember } from '../../components/member/topbar-member';
import { BottomTabBar } from '../../components/member/bottom-tab-bar';

export default function MemberLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.privacyAcceptedAt) {
      router.replace('/privacy');
      return;
    }
    if (user.role === 'ADMIN') {
      router.replace('/admin/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role === 'ADMIN') {
    return <p className="text-sm text-foreground-muted p-8">Carregando...</p>;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopbarMember
        userName={user.name}
        avatarUrl={user.pictureUrl}
        onLogout={logout}
      />
      <main className="pt-14 lg:pt-14 pb-20 lg:pb-0">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
```

- [ ] **Step 2: Update (app) layout to redirect members to the new layout**

In `apps/web/app/(app)/layout.tsx`, add a redirect check. After the auth checks, if the user is a MEMBER and the pathname doesn't start with `/me/availability` (still under old layout for now), redirect to `/map`:

Read the current `(app)/layout.tsx` first to understand the exact structure, then add the redirect logic. The key change is: if `user.role === 'MEMBER'` and pathname is `/me` or starts with `/me` (but not `/me/availability`), redirect to `/map`.

Actually, the simpler approach: keep `/me/availability` working under `(app)` for admin sidebar access. The `(member)` group handles `/map`, `/calendar`, `/members`. Update the root `page.tsx` redirect to send MEMBERs to `/map` instead of `/me`.

Read `apps/web/app/page.tsx` to see the current root redirect logic and update it.

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm --filter @ics-select/web build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(member\)/layout.tsx apps/web/app/\(app\)/layout.tsx apps/web/app/page.tsx
git commit -m "feat(web): add member route group with topbar layout"
```

---

## Phase 2: API Extensions

### Task 6: GET /me/plans Endpoint

**Files:**
- Modify: `apps/api/src/weekly-plans/weekly-plans.controller.ts`
- Modify: `apps/api/src/weekly-plans/weekly-plans.service.ts`

- [ ] **Step 1: Add listAllForMember method to the service**

In `apps/api/src/weekly-plans/weekly-plans.service.ts`, add:

```typescript
async listAllForMember(userId: string) {
  return this.prisma.weeklyPlan.findMany({
    where: { userId },
    orderBy: { weekStart: 'asc' },
    select: {
      id: true,
      weekStart: true,
      weekEnd: true,
      status: true,
      cycleId: true,
      cycle: { select: { name: true } },
      items: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });
}
```

- [ ] **Step 2: Add the controller endpoint**

In `apps/api/src/weekly-plans/weekly-plans.controller.ts`, add before the existing `myWeek` method:

```typescript
@Get('me/plans')
myPlans(@CurrentUser() user: JwtStrategyPayload) {
  return this.plans.listAllForMember(user.sub);
}
```

- [ ] **Step 3: Write a test for the new endpoint**

Add a test in the existing weekly-plans test file that verifies `listAllForMember` returns plans ordered by weekStart ascending with item status counts.

- [ ] **Step 4: Run tests**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm --filter @ics-select/api test -- --testPathPattern weekly-plans`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/weekly-plans/
git commit -m "feat(api): add GET /me/plans endpoint for plan history"
```

---

### Task 7: Extend markDone with Completion Status + Feedback

**Files:**
- Modify: `apps/api/src/weekly-plans/dto.ts`
- Modify: `apps/api/src/weekly-plans/weekly-plans.service.ts`

- [ ] **Step 1: Extend the DTO schema**

In `apps/api/src/weekly-plans/dto.ts`, update `MarkItemDoneSchema`:

```typescript
export const MarkItemDoneSchema = z.object({
  rating: z.enum(['EASY', 'HARD']).optional(),
  reflection: z.string().optional(),
  completionStatus: z.enum(['DONE', 'STUCK', 'DOUBTS']).optional(),
  feedback: z.string().max(2000).optional(),
});
```

- [ ] **Step 2: Add completionStatus and feedback fields to Prisma schema**

In `packages/prisma/prisma/schema.prisma`, add to the `WeeklyPlanItem` model:

```prisma
completionStatus CompletionStatus?
feedback         String?
```

And add the enum:

```prisma
enum CompletionStatus {
  DONE
  STUCK
  DOUBTS
}
```

- [ ] **Step 3: Generate and run migration**

Run:
```bash
cd /Users/daviduarte/development/personal/ics-select
pnpm --filter @ics-select/prisma exec prisma migrate dev --name add_completion_status_feedback
```

- [ ] **Step 4: Update the service markItemDone method**

In `apps/api/src/weekly-plans/weekly-plans.service.ts`, update the `markItemDone` method to persist the new fields:

```typescript
// Inside the update call, add:
completionStatus: parsed.completionStatus ?? 'DONE',
feedback: parsed.feedback ?? null,
// Keep existing: stuck set to true if completionStatus === 'STUCK'
stuck: parsed.completionStatus === 'STUCK',
stuckAt: parsed.completionStatus === 'STUCK' ? new Date() : null,
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm --filter @ics-select/api test -- --testPathPattern weekly-plans`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/prisma/ apps/api/src/weekly-plans/
git commit -m "feat(api): extend markDone with completionStatus and feedback"
```

---

### Task 8: GET /cycles/:id/members/progress Endpoint

**Files:**
- Modify: `apps/api/src/cycles/cycles.controller.ts`
- Modify: `apps/api/src/cycles/cycles.service.ts`

- [ ] **Step 1: Add membersProgress method to cycles service**

In `apps/api/src/cycles/cycles.service.ts`, add:

```typescript
async membersProgress(cycleId: string) {
  const memberships = await this.prisma.cycleMembership.findMany({
    where: { cycleId },
    include: {
      user: {
        select: { id: true, name: true, pictureUrl: true },
      },
    },
  });

  const plans = await this.prisma.weeklyPlan.findMany({
    where: {
      cycleId,
      status: 'PUBLISHED',
    },
    orderBy: { weekStart: 'desc' },
    include: {
      items: { select: { id: true, status: true } },
    },
  });

  return memberships.map((m) => {
    const userPlans = plans.filter((p) => p.userId === m.userId);
    const currentPlan = userPlans[0];
    const done = currentPlan?.items.filter((i) => i.status === 'DONE').length ?? 0;
    const total = currentPlan?.items.length ?? 0;

    return {
      userId: m.user.id,
      name: m.user.name,
      pictureUrl: m.user.pictureUrl,
      done,
      total,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }).sort((a, b) => b.percent - a.percent);
}
```

- [ ] **Step 2: Add the controller endpoint**

In `apps/api/src/cycles/cycles.controller.ts`, add:

```typescript
@Get(':id/members/progress')
membersProgress(@Param('id') id: string) {
  return this.cycles.membersProgress(id);
}
```

This endpoint is available to both ADMIN and MEMBER roles (any authenticated user can see their cohort's progress).

- [ ] **Step 3: Run tests**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm --filter @ics-select/api test -- --testPathPattern cycles`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/cycles/
git commit -m "feat(api): add GET /cycles/:id/members/progress endpoint"
```

---

## Phase 3: The Learning Map

### Task 9: Map Path SVG Component

**Files:**
- Create: `apps/web/components/member/map-path.tsx`

- [ ] **Step 1: Create the SVG path component**

This component renders the winding S-curve path connecting all nodes. It accepts node positions and draws bezier curves between them.

```typescript
// apps/web/components/member/map-path.tsx
'use client';

interface MapPathProps {
  points: Array<{ x: number; y: number }>;
  completedCount: number;
}

function buildPathD(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midY = (prev.y + curr.y) / 2;
    parts.push(`C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`);
  }
  return parts.join(' ');
}

export function MapPath({ points, completedCount }: MapPathProps) {
  if (points.length < 2) return null;

  const fullD = buildPathD(points);

  const donePoints = points.slice(0, completedCount + 1);
  const doneD = donePoints.length >= 2 ? buildPathD(donePoints) : '';

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
      {/* Background path */}
      <path
        d={fullD}
        fill="none"
        stroke="hsl(var(--map-path))"
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray="0 0"
      />
      {/* Completed path overlay */}
      {doneD && (
        <path
          d={doneD}
          fill="none"
          stroke="hsl(var(--map-path-done))"
          strokeWidth={8}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/member/map-path.tsx
git commit -m "feat(web): add SVG map path component with bezier curves"
```

---

### Task 10: Map Node Component

**Files:**
- Create: `apps/web/components/member/map-node.tsx`

- [ ] **Step 1: Create the node component**

```typescript
// apps/web/components/member/map-node.tsx
'use client';

import { BookOpen, Check, FileText, HelpCircle, Lock, Video, X } from 'lucide-react';
import { motion } from 'framer-motion';

type NodeStatus = 'pending' | 'active' | 'done' | 'stuck' | 'doubts' | 'locked';

interface MapNodeProps {
  status: NodeStatus;
  format: string;
  x: number;
  y: number;
  onHover: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
}

const FORMAT_ICONS: Record<string, typeof BookOpen> = {
  PROBLEM: FileText,
  VIDEO: Video,
  ARTICLE: BookOpen,
  BOOK: BookOpen,
};

const STATUS_STYLES: Record<NodeStatus, string> = {
  pending: 'bg-white border-2 border-[hsl(var(--map-path))] text-foreground-muted',
  active: 'bg-white border-3 border-brand text-brand shadow-lg shadow-brand/20',
  done: 'bg-success/10 border-2 border-success text-success',
  stuck: 'bg-danger/10 border-2 border-danger text-danger',
  doubts: 'bg-warning/10 border-2 border-warning text-warning',
  locked: 'bg-surface-subtle border-2 border-border text-foreground-subtle opacity-50',
};

const STATUS_OVERLAY_ICON: Partial<Record<NodeStatus, typeof Check>> = {
  done: Check,
  stuck: X,
  doubts: HelpCircle,
  locked: Lock,
};

export function MapNode({ status, format, x, y, onHover, onHoverEnd, onClick }: MapNodeProps) {
  const FormatIcon = FORMAT_ICONS[format] ?? BookOpen;
  const OverlayIcon = STATUS_OVERLAY_ICON[status];
  const isActive = status === 'active';
  const isLocked = status === 'locked';
  const size = isActive ? 80 : 68;

  return (
    <motion.button
      type="button"
      className={`absolute rounded-full flex items-center justify-center transition-colors ${STATUS_STYLES[status]}`}
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
      whileHover={isLocked ? undefined : { scale: 1.1 }}
      whileTap={isLocked ? undefined : { scale: 0.95 }}
      animate={isActive ? { boxShadow: ['0 0 0 0 rgba(249,115,22,0.3)', '0 0 0 12px rgba(249,115,22,0)', '0 0 0 0 rgba(249,115,22,0.3)'] } : undefined}
      transition={isActive ? { repeat: Infinity, duration: 2 } : undefined}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      aria-label={isLocked ? 'Modulo bloqueado' : `Modulo ${format}`}
    >
      {OverlayIcon ? (
        <OverlayIcon className="h-7 w-7" strokeWidth={2.5} />
      ) : (
        <FormatIcon className="h-7 w-7" strokeWidth={1.5} />
      )}
    </motion.button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/member/map-node.tsx
git commit -m "feat(web): add map node component with status-based styling"
```

---

### Task 11: Hover Card + Expanded Card

**Files:**
- Create: `apps/web/components/member/node-hover-card.tsx`
- Create: `apps/web/components/member/node-expanded-card.tsx`
- Create: `apps/web/components/member/feedback-form.tsx`

- [ ] **Step 1: Create the hover card**

```typescript
// apps/web/components/member/node-hover-card.tsx
'use client';

import { motion } from 'framer-motion';
import { getPlatformKey, PLATFORM_BORDER_CLASS, PLATFORM_LABEL } from './platform-colors';

interface NodeHoverCardProps {
  title: string;
  estimatedMinutes: number;
  format: string;
  url: string | null;
  x: number;
  y: number;
  above: boolean;
}

export function NodeHoverCard({ title, estimatedMinutes, format, url, x, y, above }: NodeHoverCardProps) {
  const platform = getPlatformKey(url, format);
  const borderClass = PLATFORM_BORDER_CLASS[platform];
  const label = PLATFORM_LABEL[platform];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className={`absolute z-30 pointer-events-none bg-surface border-2 ${borderClass} rounded-xl px-4 py-3 shadow-md w-56`}
      style={{
        left: x - 112,
        top: above ? y - 110 : y + 50,
      }}
    >
      <p className="text-sm font-bold text-foreground truncate">{title}</p>
      <p className="text-xs text-foreground-muted mt-1">
        {label} · ~{estimatedMinutes}min
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create the feedback form**

```typescript
// apps/web/components/member/feedback-form.tsx
'use client';

import { useState } from 'react';
import { Check, HelpCircle, X } from 'lucide-react';

type CompletionStatus = 'DONE' | 'STUCK' | 'DOUBTS';

interface FeedbackFormProps {
  onSubmit: (status: CompletionStatus, feedback: string) => void;
  isSubmitting: boolean;
}

const STATUS_OPTIONS: Array<{ value: CompletionStatus; label: string; icon: typeof Check; colorClass: string }> = [
  { value: 'DONE', label: 'Consegui', icon: Check, colorClass: 'bg-success/10 border-success text-success hover:bg-success/20' },
  { value: 'STUCK', label: 'Travei', icon: X, colorClass: 'bg-danger/10 border-danger text-danger hover:bg-danger/20' },
  { value: 'DOUBTS', label: 'Tive duvidas', icon: HelpCircle, colorClass: 'bg-warning/10 border-warning text-warning hover:bg-warning/20' },
];

export function FeedbackForm({ onSubmit, isSubmitting }: FeedbackFormProps) {
  const [selected, setSelected] = useState<CompletionStatus | null>(null);
  const [feedback, setFeedback] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {STATUS_OPTIONS.map(({ value, label, icon: Icon, colorClass }) => (
          <button
            key={value}
            type="button"
            onClick={() => setSelected(value)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
              selected === value ? colorClass : 'border-border text-foreground-muted hover:border-border-strong'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Deixe um feedback sobre este estudo..."
        rows={3}
        className="w-full rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none"
      />
      <button
        type="button"
        disabled={!selected || isSubmitting}
        onClick={() => selected && onSubmit(selected, feedback)}
        className="w-full bg-brand text-white rounded-xl py-2.5 text-sm font-bold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Enviando...' : 'Enviar'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create the expanded card**

```typescript
// apps/web/components/member/node-expanded-card.tsx
'use client';

import { motion } from 'framer-motion';
import { ExternalLink, X as XIcon, Check, HelpCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';
import { getPlatformKey, PLATFORM_BORDER_CLASS, PLATFORM_LABEL } from './platform-colors';
import { FeedbackForm } from './feedback-form';

interface NodeExpandedCardProps {
  planId: string;
  itemId: string;
  title: string;
  description?: string | null;
  estimatedMinutes: number;
  format: string;
  url: string | null;
  status: 'PENDING' | 'DONE';
  completionStatus?: 'DONE' | 'STUCK' | 'DOUBTS' | null;
  feedback?: string | null;
  onClose: () => void;
}

const COMPLETION_DISPLAY: Record<string, { label: string; icon: typeof Check; colorClass: string }> = {
  DONE: { label: 'Consegui', icon: Check, colorClass: 'text-success' },
  STUCK: { label: 'Travei', icon: XIcon, colorClass: 'text-danger' },
  DOUBTS: { label: 'Tive duvidas', icon: HelpCircle, colorClass: 'text-warning' },
};

export function NodeExpandedCard({
  planId, itemId, title, description, estimatedMinutes, format, url,
  status, completionStatus, feedback, onClose,
}: NodeExpandedCardProps) {
  const platform = getPlatformKey(url, format);
  const borderClass = PLATFORM_BORDER_CLASS[platform];
  const label = PLATFORM_LABEL[platform];
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: { completionStatus: string; feedback: string }) =>
      apiFetch(`/plans/${planId}/items/${itemId}/done`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-week'] });
      queryClient.invalidateQueries({ queryKey: ['me-plans'] });
      onClose();
    },
  });

  const display = completionStatus ? COMPLETION_DISPLAY[completionStatus] : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        layoutId="expanded-card"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-w-[90vw] bg-surface border-2 ${borderClass} rounded-2xl shadow-xl p-6 lg:relative lg:top-auto lg:left-auto lg:translate-x-0 lg:translate-y-0`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-foreground-muted hover:text-foreground"
          aria-label="Fechar"
        >
          <XIcon className="h-5 w-5" />
        </button>

        <div className="space-y-4">
          <div>
            <span className="text-xs font-medium text-foreground-muted">{label} · ~{estimatedMinutes}min</span>
            <h3 className="text-lg font-bold text-foreground mt-1">{title}</h3>
          </div>

          {description && (
            <p className="text-sm text-foreground-muted">{description}</p>
          )}

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-brand-hover transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir material
            </a>
          )}

          {status === 'PENDING' ? (
            <FeedbackForm
              onSubmit={(s, f) => mutation.mutate({ completionStatus: s, feedback: f })}
              isSubmitting={mutation.isPending}
            />
          ) : display ? (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className={`flex items-center gap-2 ${display.colorClass}`}>
                <display.icon className="h-5 w-5" />
                <span className="font-medium text-sm">{display.label}</span>
              </div>
              {feedback && (
                <p className="text-sm text-foreground-muted italic">"{feedback}"</p>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/node-hover-card.tsx apps/web/components/member/node-expanded-card.tsx apps/web/components/member/feedback-form.tsx
git commit -m "feat(web): add hover card, expanded card, and feedback form components"
```

---

### Task 12: Map Decorations

**Files:**
- Create: `apps/web/components/member/map-decorations.tsx`

- [ ] **Step 1: Create decorative SVG elements**

```typescript
// apps/web/components/member/map-decorations.tsx
'use client';

interface DecorationProps {
  x: number;
  y: number;
  className?: string;
}

function Star({ x, y, className = '' }: DecorationProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className={`absolute text-warning/40 ${className}`}
      style={{ left: x, top: y }}
    >
      <path
        d="M10 1l2.5 6.5H19l-5.3 4 2 6.5L10 14l-5.7 4 2-6.5L1 7.5h6.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function Flag({ x, y, className = '' }: DecorationProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className={`absolute text-brand/30 ${className}`}
      style={{ left: x, top: y }}
    >
      <path d="M4 2v20M4 4h12l-3 4 3 4H4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cloud({ x, y, className = '' }: DecorationProps) {
  return (
    <svg
      width="48"
      height="28"
      viewBox="0 0 48 28"
      className={`absolute text-foreground/5 ${className}`}
      style={{ left: x, top: y }}
    >
      <ellipse cx="24" cy="18" rx="16" ry="10" fill="currentColor" />
      <ellipse cx="16" cy="14" rx="12" ry="9" fill="currentColor" />
      <ellipse cx="32" cy="14" rx="10" ry="8" fill="currentColor" />
    </svg>
  );
}

interface MapDecorationsProps {
  nodePositions: Array<{ x: number; y: number }>;
  mapWidth: number;
}

export function MapDecorations({ nodePositions, mapWidth }: MapDecorationsProps) {
  const decorations: Array<{ type: 'star' | 'flag' | 'cloud'; x: number; y: number }> = [];

  nodePositions.forEach((pos, i) => {
    if (i % 2 === 0) {
      decorations.push({
        type: 'star',
        x: pos.x > mapWidth / 2 ? pos.x - 80 : pos.x + 60,
        y: pos.y - 15,
      });
    }
    if (i % 3 === 0) {
      decorations.push({
        type: 'flag',
        x: pos.x > mapWidth / 2 ? pos.x + 55 : pos.x - 70,
        y: pos.y + 10,
      });
    }
    if (i % 4 === 1) {
      decorations.push({
        type: 'cloud',
        x: pos.x > mapWidth / 2 ? 20 : mapWidth - 80,
        y: pos.y - 40,
      });
    }
  });

  return (
    <>
      {decorations.map((d, i) => {
        const key = `${d.type}-${i}`;
        switch (d.type) {
          case 'star': return <Star key={key} x={d.x} y={d.y} />;
          case 'flag': return <Flag key={key} x={d.x} y={d.y} />;
          case 'cloud': return <Cloud key={key} x={d.x} y={d.y} />;
        }
      })}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/member/map-decorations.tsx
git commit -m "feat(web): add decorative SVG elements for the learning map"
```

---

### Task 13: Node Map (orchestrator)

**Files:**
- Create: `apps/web/components/member/node-map.tsx`

- [ ] **Step 1: Create the node map component**

This is the main orchestrator that positions nodes along the S-curve path, renders the SVG path, decorations, and manages hover/click state.

```typescript
// apps/web/components/member/node-map.tsx
'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MapPath } from './map-path';
import { MapNode } from './map-node';
import { MapDecorations } from './map-decorations';
import { NodeHoverCard } from './node-hover-card';
import { NodeExpandedCard } from './node-expanded-card';

type NodeStatus = 'pending' | 'active' | 'done' | 'stuck' | 'doubts' | 'locked';

interface PlanItem {
  id: string;
  status: 'PENDING' | 'DONE';
  stuck: boolean;
  completionStatus?: 'DONE' | 'STUCK' | 'DOUBTS' | null;
  feedback?: string | null;
  order: number;
  libraryItem: {
    id: string;
    title: string;
    description?: string | null;
    estimatedMinutes: number;
    url: string | null;
    format: string;
  };
}

interface NodeMapProps {
  planId: string;
  items: PlanItem[];
}

const MAP_WIDTH = 600;
const NODE_SPACING_Y = 140;
const PADDING_TOP = 80;
const AMPLITUDE = 160;

function computeNodeStatus(item: PlanItem, index: number, items: PlanItem[]): NodeStatus {
  if (item.status === 'DONE') {
    if (item.completionStatus === 'STUCK' || item.stuck) return 'stuck';
    if (item.completionStatus === 'DOUBTS') return 'doubts';
    return 'done';
  }
  const firstPending = items.findIndex((i) => i.status === 'PENDING');
  if (index === firstPending) return 'active';
  return 'pending';
}

export function NodeMap({ planId, items }: NodeMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const orderedItems = useMemo(
    () => [...items].sort((a, b) => a.order - b.order).reverse(),
    [items],
  );

  const positions = useMemo(() => {
    return orderedItems.map((_, i) => {
      const y = PADDING_TOP + i * NODE_SPACING_Y;
      const x = MAP_WIDTH / 2 + Math.sin((i * Math.PI) / 2) * AMPLITUDE;
      return { x, y };
    });
  }, [orderedItems]);

  const totalHeight = PADDING_TOP + orderedItems.length * NODE_SPACING_Y + 80;
  const completedCount = orderedItems.filter((i) => i.status === 'DONE').length;

  const hoveredItem = hoveredId ? orderedItems.find((i) => i.id === hoveredId) : null;
  const hoveredPos = hoveredId ? positions[orderedItems.findIndex((i) => i.id === hoveredId)] : null;

  const expandedItem = expandedId ? orderedItems.find((i) => i.id === expandedId) : null;

  const handleClose = useCallback(() => setExpandedId(null), []);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[600px] mx-auto"
      style={{ height: totalHeight }}
    >
      <MapDecorations nodePositions={positions} mapWidth={MAP_WIDTH} />
      <MapPath points={positions} completedCount={completedCount} />

      {orderedItems.map((item, i) => (
        <MapNode
          key={item.id}
          status={computeNodeStatus(item, i, orderedItems)}
          format={item.libraryItem.format}
          x={positions[i].x}
          y={positions[i].y}
          onHover={() => !expandedId && setHoveredId(item.id)}
          onHoverEnd={() => setHoveredId(null)}
          onClick={() => { setHoveredId(null); setExpandedId(item.id); }}
        />
      ))}

      <AnimatePresence>
        {hoveredItem && hoveredPos && !expandedId && (
          <NodeHoverCard
            key="hover"
            title={hoveredItem.libraryItem.title}
            estimatedMinutes={hoveredItem.libraryItem.estimatedMinutes}
            format={hoveredItem.libraryItem.format}
            url={hoveredItem.libraryItem.url}
            x={hoveredPos.x}
            y={hoveredPos.y}
            above={hoveredPos.y > 200}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandedItem && (
          <NodeExpandedCard
            key="expanded"
            planId={planId}
            itemId={expandedItem.id}
            title={expandedItem.libraryItem.title}
            description={expandedItem.libraryItem.description}
            estimatedMinutes={expandedItem.libraryItem.estimatedMinutes}
            format={expandedItem.libraryItem.format}
            url={expandedItem.libraryItem.url}
            status={expandedItem.status}
            completionStatus={expandedItem.completionStatus}
            feedback={expandedItem.feedback}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/member/node-map.tsx
git commit -m "feat(web): add node map orchestrator with S-curve layout"
```

---

### Task 14: World Select

**Files:**
- Create: `apps/web/components/member/world-card.tsx`
- Create: `apps/web/components/member/world-select.tsx`

- [ ] **Step 1: Create the world card**

```typescript
// apps/web/components/member/world-card.tsx
'use client';

import { motion } from 'framer-motion';
import { Check, Lock, Zap } from 'lucide-react';

type WorldStatus = 'completed' | 'active' | 'locked';

interface WorldCardProps {
  label: string;
  weekRange: string;
  status: WorldStatus;
  percent: number;
  onClick?: () => void;
}

const STATUS_STYLES: Record<WorldStatus, string> = {
  completed: 'bg-success/5 border-success/30 hover:border-success/60 cursor-pointer',
  active: 'bg-brand/5 border-brand/40 ring-2 ring-brand/20 cursor-pointer',
  locked: 'bg-surface-subtle border-border opacity-60 cursor-not-allowed',
};

export function WorldCard({ label, weekRange, status, percent, onClick }: WorldCardProps) {
  return (
    <motion.button
      type="button"
      onClick={status !== 'locked' ? onClick : undefined}
      disabled={status === 'locked'}
      whileHover={status !== 'locked' ? { scale: 1.03 } : undefined}
      whileTap={status !== 'locked' ? { scale: 0.97 } : undefined}
      className={`flex-shrink-0 w-56 p-5 rounded-2xl border-2 text-left transition-colors ${STATUS_STYLES[status]}`}
    >
      <div className="flex items-center justify-between mb-3">
        {status === 'completed' && <Check className="h-5 w-5 text-success" />}
        {status === 'active' && (
          <span className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="h-3 w-3" /> Agora
          </span>
        )}
        {status === 'locked' && <Lock className="h-5 w-5 text-foreground-subtle" />}
        {status !== 'locked' && (
          <span className="text-xs font-bold text-foreground-muted">{percent}%</span>
        )}
      </div>
      <h3 className="text-sm font-bold text-foreground truncate">{label}</h3>
      <p className="text-xs text-foreground-muted mt-1">{weekRange}</p>
    </motion.button>
  );
}
```

- [ ] **Step 2: Create the world select view**

```typescript
// apps/web/components/member/world-select.tsx
'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { WorldCard } from './world-card';

interface PlanSummary {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  cycle: { name: string };
  items: Array<{ id: string; status: string }>;
}

interface WorldSelectProps {
  plans: PlanSummary[];
  activePlanId: string | null;
  onSelectWorld: (planId: string) => void;
  onBack: () => void;
}

function formatWeekRange(start: string, end: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${fmt.format(new Date(start))} — ${fmt.format(new Date(end))}`;
  } catch {
    return '';
  }
}

export function WorldSelect({ plans, activePlanId, onSelectWorld, onBack }: WorldSelectProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-6 lg:p-8"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao mapa
      </button>

      <h2 className="text-xl font-bold text-foreground mb-6">Todos os Mundos</h2>

      <div className="flex gap-4 overflow-x-auto pb-4 lg:flex-wrap">
        {plans.map((plan) => {
          const done = plan.items.filter((i) => i.status === 'DONE').length;
          const total = plan.items.length;
          const percent = total === 0 ? 0 : Math.round((done / total) * 100);
          const isActive = plan.id === activePlanId;
          const isCompleted = plan.status === 'COMPLETED' || plan.status === 'ARCHIVED';

          let status: 'completed' | 'active' | 'locked' = 'locked';
          if (isCompleted) status = 'completed';
          else if (isActive) status = 'active';
          else if (plan.status === 'PUBLISHED') status = 'completed';

          return (
            <WorldCard
              key={plan.id}
              label={plan.cycle.name}
              weekRange={formatWeekRange(plan.weekStart, plan.weekEnd)}
              status={status}
              percent={percent}
              onClick={() => onSelectWorld(plan.id)}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/world-card.tsx apps/web/components/member/world-select.tsx
git commit -m "feat(web): add world select view with world cards"
```

---

### Task 15: Map Page (main orchestrator page)

**Files:**
- Create: `apps/web/app/(member)/map/page.tsx`
- Create: `apps/web/app/(member)/page.tsx`

- [ ] **Step 1: Create the map page**

```typescript
// apps/web/app/(member)/map/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Map } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';
import { NodeMap } from '../../../components/member/node-map';
import { WorldSelect } from '../../../components/member/world-select';
import { StatsSidebar } from '../../../components/member/stats-sidebar';
import { StatsBannerMobile } from '../../../components/member/stats-banner-mobile';

type PlanItem = {
  id: string;
  status: 'PENDING' | 'DONE';
  stuck: boolean;
  completionStatus?: 'DONE' | 'STUCK' | 'DOUBTS' | null;
  feedback?: string | null;
  order: number;
  libraryItem: {
    id: string;
    title: string;
    description?: string | null;
    estimatedMinutes: number;
    url: string | null;
    format: string;
  };
  sessions: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
};

type Plan = {
  id: string;
  status: string;
  weekStart: string;
  weekEnd: string;
  items: PlanItem[];
};

type PlanSummary = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  cycle: { name: string };
  items: Array<{ id: string; status: string }>;
};

export default function MapPage() {
  const [view, setView] = useState<'map' | 'worlds'>('map');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: currentPlans, isLoading: loadingCurrent } = useQuery({
    queryKey: ['me-week'],
    queryFn: () => apiFetch<Plan[]>('/me/week'),
  });

  const { data: allPlans, isLoading: loadingAll } = useQuery({
    queryKey: ['me-plans'],
    queryFn: () => apiFetch<PlanSummary[]>('/me/plans'),
  });

  if (loadingCurrent) {
    return <p className="text-sm text-foreground-muted p-8">Carregando seu mapa...</p>;
  }

  const activePlan = currentPlans?.[0];
  const displayPlanId = selectedPlanId ?? activePlan?.id;

  const displayPlan = displayPlanId === activePlan?.id
    ? activePlan
    : null;

  if (!activePlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <Map className="h-16 w-16 text-foreground-subtle mb-4" />
        <h2 className="text-lg font-bold text-foreground">Nenhum plano ativo</h2>
        <p className="text-sm text-foreground-muted mt-2">
          Aguarde o administrador publicar o proximo plano semanal.
        </p>
      </div>
    );
  }

  const done = displayPlan ? displayPlan.items.filter((i) => i.status === 'DONE').length : 0;
  const total = displayPlan?.items.length ?? 0;
  const daysRemaining = displayPlan
    ? Math.max(0, Math.ceil((new Date(displayPlan.weekEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--map-bg-start))] to-[hsl(var(--map-bg-end))]">
      <StatsBannerMobile done={done} total={total} daysRemaining={daysRemaining} streak={0} />

      <AnimatePresence mode="wait">
        {view === 'worlds' && allPlans ? (
          <WorldSelect
            key="worlds"
            plans={allPlans}
            activePlanId={activePlan.id}
            onSelectWorld={(id) => { setSelectedPlanId(id); setView('map'); }}
            onBack={() => setView('map')}
          />
        ) : displayPlan ? (
          <div key="map" className="flex gap-6 px-4 lg:px-8 py-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-lg font-bold text-foreground">Mapa de Estudo</h1>
                  <p className="text-sm text-foreground-muted">
                    {formatDateRange(displayPlan.weekStart, displayPlan.weekEnd)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView('worlds')}
                  className="text-sm text-brand font-medium hover:underline"
                >
                  Ver todos os mundos
                </button>
              </div>
              <NodeMap planId={displayPlan.id} items={displayPlan.items} />
            </div>
            <StatsSidebar done={done} total={total} daysRemaining={daysRemaining} streak={0} />
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function formatDateRange(weekStart: string, weekEnd: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `${fmt.format(new Date(weekStart))} a ${fmt.format(new Date(weekEnd))}`;
  } catch {
    return '';
  }
}
```

- [ ] **Step 2: Create the redirect page at (member) root**

```typescript
// apps/web/app/(member)/page.tsx
import { redirect } from 'next/navigation';

export default function MemberRoot() {
  redirect('/map');
}
```

- [ ] **Step 3: Install framer-motion**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm --filter @ics-select/web add framer-motion`

- [ ] **Step 4: Verify the app compiles**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm --filter @ics-select/web build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(member\)/ apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add map page with world select and node map"
```

---

## Phase 4: Calendar + Members Pages

### Task 16: Calendar Components

**Files:**
- Create: `apps/web/components/member/calendar-mini.tsx`
- Create: `apps/web/components/member/calendar-session-card.tsx`
- Create: `apps/web/components/member/calendar-weekly.tsx`
- Create: `apps/web/components/member/calendar-day-list.tsx`

- [ ] **Step 1: Create the mini calendar**

```typescript
// apps/web/components/member/calendar-mini.tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

interface CalendarMiniProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function CalendarMini({ selectedDate, onSelectDate }: CalendarMiniProps) {
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
    return cells;
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="p-1 hover:bg-surface-subtle rounded-lg">
          <ChevronLeft className="h-4 w-4 text-foreground-muted" />
        </button>
        <span className="text-sm font-bold text-foreground capitalize">{monthLabel}</span>
        <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="p-1 hover:bg-surface-subtle rounded-lg">
          <ChevronRight className="h-4 w-4 text-foreground-muted" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-[10px] font-medium text-foreground-subtle">{d}</span>
        ))}
        {days.map((cell, i) => {
          if (!cell.date) return <span key={i} />;
          const isToday = cell.date.toDateString() === today.toDateString();
          const isSelected = cell.date.toDateString() === selectedDate.toDateString();
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(cell.date!)}
              className={`h-7 w-7 rounded-full text-xs font-medium transition-colors ${
                isSelected ? 'bg-brand text-white' :
                isToday ? 'bg-brand/10 text-brand font-bold' :
                'text-foreground-muted hover:bg-surface-subtle'
              }`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the session card for the calendar grid**

```typescript
// apps/web/components/member/calendar-session-card.tsx
'use client';

import { getPlatformKey, PLATFORM_BG_CLASS, PLATFORM_BORDER_CLASS } from './platform-colors';

interface CalendarSessionCardProps {
  title: string;
  startHour: string;
  durationMinutes: number;
  format: string;
  url: string | null;
  onClick: () => void;
}

export function CalendarSessionCard({ title, startHour, durationMinutes, format, url, onClick }: CalendarSessionCardProps) {
  const platform = getPlatformKey(url, format);
  const bgClass = PLATFORM_BG_CLASS[platform];
  const borderClass = PLATFORM_BORDER_CLASS[platform];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border-l-3 px-2.5 py-1.5 text-xs ${bgClass} ${borderClass} hover:shadow-sm transition-shadow`}
    >
      <p className="font-bold text-foreground truncate">{title}</p>
      <p className="text-foreground-muted">{startHour} · {durationMinutes}min</p>
    </button>
  );
}
```

- [ ] **Step 3: Create the weekly grid calendar**

```typescript
// apps/web/components/member/calendar-weekly.tsx
'use client';

import { useMemo } from 'react';
import { CalendarSessionCard } from './calendar-session-card';

interface Session {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  libraryItem: {
    title: string;
    format: string;
    url: string | null;
  };
}

interface CalendarWeeklyProps {
  weekStart: Date;
  sessions: Session[];
  onSessionClick: (session: Session) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);
const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

export function CalendarWeekly({ weekStart, sessions, onSessionClick }: CalendarWeeklyProps) {
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const today = new Date();

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
        <div />
        {weekDays.map((day, i) => {
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div key={i} className={`text-center py-3 border-l border-border ${isToday ? 'bg-brand/5' : ''}`}>
              <span className="text-xs text-foreground-muted">{DAY_LABELS[i]}</span>
              <span className={`block text-lg font-bold ${isToday ? 'text-brand' : 'text-foreground'}`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[600px] overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="h-16 flex items-start justify-end pr-2 pt-1 text-[10px] text-foreground-subtle border-t border-border/50">
              {hour}:00
            </div>
            {weekDays.map((day, dayIdx) => {
              const daySessions = sessions.filter((s) => {
                const d = new Date(s.scheduledAt);
                return d.toDateString() === day.toDateString() && d.getHours() === hour;
              });
              return (
                <div key={dayIdx} className="h-16 border-l border-t border-border/50 p-0.5">
                  {daySessions.map((s) => (
                    <CalendarSessionCard
                      key={s.id}
                      title={s.libraryItem.title}
                      startHour={new Date(s.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      durationMinutes={s.durationMinutes}
                      format={s.libraryItem.format}
                      url={s.libraryItem.url}
                      onClick={() => onSessionClick(s)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create mobile day list view**

```typescript
// apps/web/components/member/calendar-day-list.tsx
'use client';

import { CalendarSessionCard } from './calendar-session-card';

interface Session {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  libraryItem: {
    title: string;
    format: string;
    url: string | null;
  };
}

interface CalendarDayListProps {
  date: Date;
  sessions: Session[];
  onSessionClick: (session: Session) => void;
}

export function CalendarDayList({ date, sessions, onSessionClick }: CalendarDayListProps) {
  const daySessions = sessions
    .filter((s) => new Date(s.scheduledAt).toDateString() === date.toDateString())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const dateLabel = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <h3 className="text-sm font-bold text-foreground capitalize mb-3">{dateLabel}</h3>
      {daySessions.length === 0 ? (
        <p className="text-xs text-foreground-muted">Nenhuma sessao neste dia.</p>
      ) : (
        <div className="space-y-2">
          {daySessions.map((s) => (
            <CalendarSessionCard
              key={s.id}
              title={s.libraryItem.title}
              startHour={new Date(s.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              durationMinutes={s.durationMinutes}
              format={s.libraryItem.format}
              url={s.libraryItem.url}
              onClick={() => onSessionClick(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/member/calendar-mini.tsx apps/web/components/member/calendar-session-card.tsx apps/web/components/member/calendar-weekly.tsx apps/web/components/member/calendar-day-list.tsx
git commit -m "feat(web): add calendar components (mini, weekly grid, day list, session card)"
```

---

### Task 17: Calendar Page

**Files:**
- Create: `apps/web/app/(member)/calendar/page.tsx`

- [ ] **Step 1: Create the calendar page**

```typescript
// apps/web/app/(member)/calendar/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api/client';
import { CalendarMini } from '../../../components/member/calendar-mini';
import { CalendarWeekly } from '../../../components/member/calendar-weekly';
import { CalendarDayList } from '../../../components/member/calendar-day-list';

type PlanItem = {
  id: string;
  libraryItem: { title: string; format: string; url: string | null };
  sessions: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
};

type Plan = {
  id: string;
  weekStart: string;
  weekEnd: string;
  items: PlanItem[];
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['me-week'],
    queryFn: () => apiFetch<Plan[]>('/me/week'),
  });

  const sessions = useMemo(() => {
    if (!data) return [];
    return data.flatMap((plan) =>
      plan.items.flatMap((item) =>
        item.sessions.map((s) => ({
          ...s,
          libraryItem: item.libraryItem,
        })),
      ),
    );
  }, [data]);

  const shiftWeek = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta * 7);
    setSelectedDate(d);
  };

  if (isLoading) {
    return <p className="text-sm text-foreground-muted p-8">Carregando calendario...</p>;
  }

  return (
    <div className="px-4 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-foreground">Calendario</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shiftWeek(-1)} className="p-2 hover:bg-surface-subtle rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground">
            {weekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} —{' '}
            {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
          </span>
          <button type="button" onClick={() => shiftWeek(1)} className="p-2 hover:bg-surface-subtle rounded-lg">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop: sidebar + weekly grid */}
      <div className="hidden lg:grid grid-cols-[250px_1fr] gap-6">
        <div className="space-y-4">
          <CalendarMini selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <CalendarDayList date={selectedDate} sessions={sessions} onSessionClick={() => {}} />
        </div>
        <CalendarWeekly weekStart={weekStart} sessions={sessions} onSessionClick={() => {}} />
      </div>

      {/* Mobile: day view */}
      <div className="lg:hidden space-y-4">
        <CalendarMini selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <CalendarDayList date={selectedDate} sessions={sessions} onSessionClick={() => {}} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(member\)/calendar/page.tsx
git commit -m "feat(web): add calendar page with weekly grid and mini calendar"
```

---

### Task 18: Members Page

**Files:**
- Create: `apps/web/components/member/member-card.tsx` (new one for member view, different from admin's)
- Create: `apps/web/app/(member)/members/page.tsx`

- [ ] **Step 1: Create the member card for the team mural**

```typescript
// apps/web/components/member/member-card.tsx
'use client';

import { Trophy } from 'lucide-react';

interface MemberCardProps {
  name: string;
  pictureUrl: string | null;
  done: number;
  total: number;
  percent: number;
  rank: number;
  isCurrentUser: boolean;
}

const RANK_STYLES: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-gray-400',
  3: 'text-amber-700',
};

export function MemberMuralCard({ name, pictureUrl, done, total, percent, rank, isCurrentUser }: MemberCardProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={`bg-surface border-2 rounded-2xl p-5 transition-colors ${
      isCurrentUser ? 'border-brand/40 ring-2 ring-brand/10' : 'border-border'
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-brand-soft flex items-center justify-center text-sm font-bold text-brand overflow-hidden flex-shrink-0">
          {pictureUrl ? (
            <img src={pictureUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate">{name}</p>
          <p className="text-xs text-foreground-muted">{done} de {total} modulos</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {rank <= 3 ? (
            <Trophy className={`h-4 w-4 ${RANK_STYLES[rank]}`} />
          ) : (
            <span className="text-xs font-medium text-foreground-subtle">#{rank}</span>
          )}
        </div>
      </div>

      <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-foreground-muted mt-1.5 text-right">{percent}%</p>
    </div>
  );
}
```

- [ ] **Step 2: Create the members page**

```typescript
// apps/web/app/(member)/members/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';
import { useAuth } from '../../../lib/auth/auth-context';
import { MemberMuralCard } from '../../../components/member/member-card';

type MemberProgress = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  done: number;
  total: number;
  percent: number;
};

export default function MembersPage() {
  const { user } = useAuth();

  const { data: members, isLoading } = useQuery({
    queryKey: ['members-progress'],
    queryFn: async () => {
      const cycles = await apiFetch<Array<{ id: string }>>('/cycles?status=ACTIVE');
      if (!cycles.length) return [];
      return apiFetch<MemberProgress[]>(`/cycles/${cycles[0].id}/members/progress`);
    },
  });

  if (isLoading) {
    return <p className="text-sm text-foreground-muted p-8">Carregando turma...</p>;
  }

  return (
    <div className="px-4 lg:px-8 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-5 w-5 text-brand" />
        <div>
          <h1 className="text-lg font-bold text-foreground">Minha Turma</h1>
          <p className="text-sm text-foreground-muted">{members?.length ?? 0} membros</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members?.map((m, i) => (
          <MemberMuralCard
            key={m.userId}
            name={m.name}
            pictureUrl={m.pictureUrl}
            done={m.done}
            total={m.total}
            percent={m.percent}
            rank={i + 1}
            isCurrentUser={m.userId === user?.sub}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/member-card.tsx apps/web/app/\(member\)/members/page.tsx
git commit -m "feat(web): add members page with team mural and ranking"
```

---

## Phase 5: Integration + Polish

### Task 19: Update Root Redirect + Auth Flow

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/(app)/layout.tsx`

- [ ] **Step 1: Read and update root page redirect**

Read `apps/web/app/page.tsx` to understand current redirect logic. Update so that:
- MEMBER users redirect to `/map` instead of `/me`
- ADMIN users continue to `/admin/dashboard` (or `/admin/cycles`)

- [ ] **Step 2: Update (app) layout to redirect stale member URLs**

In `apps/web/app/(app)/layout.tsx`, if a MEMBER navigates to `/me` (old URL), redirect to `/map`. Keep `/me/availability` accessible under the `(app)` layout since it still uses the sidebar pattern.

- [ ] **Step 3: Verify navigation flow**

Start dev server: `cd /Users/daviduarte/development/personal/ics-select && pnpm dev`

Test:
1. Login as MEMBER → should land on `/map`
2. Navigate to `/calendar` via topbar → calendar page loads
3. Navigate to `/members` via topbar → members page loads
4. Click avatar → Disponibilidade → availability page loads (under old layout)
5. Login as ADMIN → should land on `/admin/dashboard` with sidebar layout

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/\(app\)/layout.tsx
git commit -m "feat(web): update auth flow to route members to /map"
```

---

### Task 20: Visual Polish + Decorations

**Files:**
- Modify: `apps/web/components/member/map-decorations.tsx`
- Modify: `apps/web/components/member/node-map.tsx`

- [ ] **Step 1: Add a finish line / flag at the top of the map**

In `map-decorations.tsx`, add a finish banner SVG that renders at the top of the path (above the last node). This could be a checkered flag or a trophy icon.

- [ ] **Step 2: Add a start marker at the bottom**

Add a "Start" label/banner SVG at the bottom of the path below the first node.

- [ ] **Step 3: Test visual appearance**

Start dev server and verify:
1. Map renders with S-curve path
2. Nodes display correct status styles
3. Hover shows platform-colored card
4. Click expands to full card with feedback form
5. Decorations (stars, flags, clouds) appear between nodes
6. Start/finish markers visible

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/
git commit -m "style(web): polish map with start/finish markers and decorations"
```

---

### Task 21: Full Build Verification

- [ ] **Step 1: Run typecheck**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm typecheck`
Expected: No type errors.

- [ ] **Step 2: Run lint**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm lint`
Expected: No lint errors.

- [ ] **Step 3: Run full build**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm build`
Expected: Build succeeds for all packages.

- [ ] **Step 4: Run API tests**

Run: `cd /Users/daviduarte/development/personal/ics-select && pnpm --filter @ics-select/api test`
Expected: All tests pass.

- [ ] **Step 5: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix(web): resolve build/lint issues from member redesign"
```
