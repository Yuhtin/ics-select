# Academy Fellow Studio Member Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every authenticated fellow surface as the approved Academy Fellow Studio workspace, including conversational Retro and post-study flows, while preserving all current product behavior.

**Architecture:** Replace the desktop member top bar with a shared rail while retaining the mobile bottom bar, then recompose each route from its existing query and domain components. Add three presentation-only guided-input primitives; Retro and Item Focus continue to own their values, conditional rules, and mutations. Page changes remain inside the web app and use existing Academy tokens, Lucide, HeroUI, and Framer Motion.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3, HeroUI 2, Framer Motion 11, Lucide React, TanStack Query 5, Playwright, Vitest

**Spec:** `docs/superpowers/specs/2026-09-09-academy-fellow-studio-member-experience-design.md`

## Global Constraints

- Preserve every current route, query, mutation, payload field, permission, gate, schedule rule, and copy field.
- Desktop member navigation is a labeled 94-pixel rail from 768 pixels upward.
- Mobile member navigation remains a labeled four-destination bottom bar below 768 pixels and exposes Retro when it is open.
- Academy blue is reserved for current location, current task, focus, selection, and primary action.
- Add the structural rail colors to the Academy token set; do not place literal palette values in member components.
- Group ordinary content with spacing, alignment, and dividers; reserve enclosing surfaces for interactive, selected, modal, or semantically distinct regions.
- Metadata is plain text; pills are limited to actions and actual states.
- Lucide is the only icon family; standard stroke width is 1.5.
- Reflective text uses the approved transparent, large-type, bottom-rule presentation.
- Retro and Item Focus submit through their existing mutations; no autosave or API change is added.
- Settings remains direct-edit and retains its current autosave behavior.
- Do not add shadcn/ui or any other package.
- Every animated path supports `prefers-reduced-motion` through Framer Motion's `useReducedMotion`.
- Every touch target is at least 44 by 44 pixels, and the product remains usable at 200 percent zoom.
- Follow `/Users/daviduarte/.codex/RTK.md`: every shell command starts with `rtk`; use `rtk proxy pnpm` for filtered pnpm commands.

---

### Task 1: Studio member shell and navigation

**Files:**
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/components/member-shell/member-nav.ts`
- Create: `apps/web/components/member-shell/member-rail.tsx`
- Create: `apps/web/components/member-shell/member-mobile-retro-action.tsx`
- Modify: `apps/web/components/member-shell/member-shell.tsx`
- Modify: `apps/web/components/member-shell/bottom-tab-bar.tsx`
- Modify: `apps/web/components/ui/theme-toggle.tsx`
- Delete: `apps/web/components/member-shell/topbar-member.tsx`
- Create: `apps/web/tests/member-studio.spec.ts`

**Interfaces:**
- Produces: `MEMBER_NAV_ITEMS: readonly MemberNavItem[]`
- Produces: `isMemberNavActive(pathname: string, item: MemberNavItem): boolean`
- Produces: `MemberRail(): JSX.Element`
- Produces: `MemberMobileRetroAction(): JSX.Element`
- Produces: `--member-rail-bg`, `--member-rail-fg`, and `--member-rail-hover` Academy color tokens
- Produces: `presentation?: 'default' | 'rail'` on `ThemeToggle`; default is `default`
- Consumes: existing `useAuth`, `useMeRetroCurrent`, `ThemeToggle`, and official `BrandLockup`

- [ ] **Step 1: Write the failing desktop and mobile shell tests**

Create a focused member fixture in `member-studio.spec.ts`. Mock `/me`, `/me/home`, `/me/cohort`, and `/me/retro/current`, then assert labeled navigation, dimensions, active state, Retro access, and mobile replacement:

```ts
import { expect, test, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:3001';
const member = {
  id: 'studio-member', name: 'Eduardo Santos', email: 'eduardo@test.com',
  role: 'MEMBER', pictureUrl: null, privacyAcceptedAt: '2026-01-01T00:00:00Z',
  whatsappPhone: '+5511999999999', targetTrack: 'BIG_TECH', googleConnected: true,
};
const item = {
  id: 'binary-search', planId: 'plan-1', order: 1, title: 'Binary search patterns',
  format: 'PROBLEM', estimatedMinutes: 45, url: 'https://leetcode.com/problems/binary-search',
  topic: { slug: 'binary-search', label: 'Binary Search' }, outcome: 'PENDING',
  skippable: true, scheduledAt: '2026-04-17T19:00:00Z', scheduledMinutes: 45,
  carriedFromItemId: null,
};

async function mockStudioMember(page: Page, retroOpen = true) {
  await page.addInitScript(() => localStorage.setItem('ics_access_token', 'studio-token'));
  await page.route(`${API_BASE}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body: Record<string, unknown> = {
      '/me': member,
      '/me/home': {
        hero: { state: 'now', item }, today: [item], late: [], days: [], unscheduled: [],
        streak: { current: 7, last7: [true, true, true, true, true, true, true] },
        carryOverReflection: null, topicCoverage: [], studyTime: null,
      },
      '/me/cohort': { cycleName: '2026.2', memberCount: 0, members: [], ranking: [], feed: [] },
      '/me/retro/current': {
        open: retroOpen, retro: null, weekRecap: null,
        windowOpensAt: '2026-04-17T21:00:00Z', windowClosesAt: '2026-04-22T23:59:00Z',
      },
    };
    return route.fulfill({ json: body[path] ?? {} });
  });
}

test('Studio uses a labeled rail on desktop', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/me');
  const rail = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(rail).toBeVisible();
  expect((await rail.boundingBox())?.width).toBe(94);
  for (const label of ['Today', 'Calendar', 'Cohort', 'Retro', 'Theme', 'Settings', 'Profile', 'Sign out']) {
    await expect(rail.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(rail.getByRole('link', { name: 'Today', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('Studio uses bottom navigation and a Retro action on mobile', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/me');
  await expect(page.getByTestId('member-rail')).toBeHidden();
  const bottom = page.getByRole('navigation', { name: 'Main navigation' });
  for (const label of ['Today', 'Calendar', 'Cohort', 'Profile']) {
    await expect(bottom.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: /Retro open/i })).toHaveAttribute('href', '/me/retro');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
```

- [ ] **Step 2: Run the shell tests and confirm the old top bar fails them**

Run:

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium
```

Expected: FAIL because no `member-rail` exists and the desktop navigation is not 94 pixels wide.

- [ ] **Step 3: Add the rail tokens and create one navigation model shared by desktop and mobile**

Add the structural rail colors beside the existing Academy surface tokens in `globals.css`:

```css
--member-rail-bg: 240 8% 11%;
--member-rail-fg: 240 6% 70%;
--member-rail-hover: 240 7% 17%;
```

The rail intentionally stays dark in both themes, so the root values remain authoritative in dark mode as well. Components consume these variables through Tailwind arbitrary color utilities instead of repeating color literals.

Implement `member-nav.ts` with exact route matching for Today and prefix matching elsewhere:

```ts
import { CalendarDays, House, UsersRound, type LucideIcon } from 'lucide-react';

export interface MemberNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  mobile: boolean;
}

export const MEMBER_NAV_ITEMS: readonly MemberNavItem[] = [
  { href: '/me', label: 'Today', icon: House, exact: true, mobile: true },
  { href: '/me/calendar', label: 'Calendar', icon: CalendarDays, mobile: true },
  { href: '/me/cohort', label: 'Cohort', icon: UsersRound, mobile: true },
];

export function isMemberNavActive(pathname: string, item: MemberNavItem): boolean {
  return item.exact === true
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
```

- [ ] **Step 4: Build the desktop rail and conditional mobile Retro action**

Use the official IA mark, existing auth actions, `ThemeToggle`, and current Retro query. Keep every item labeled and use a single Lucide family:

```tsx
export function MemberRail() {
  const pathname = usePathname();
  const { data: retro } = useMeRetroCurrent();
  const { user, logout } = useAuth();
  const showRetro = retro?.open === true || pathname === '/me/retro';
  const itemClass = 'flex min-h-12 flex-col items-center justify-center gap-1 rounded-input px-1 font-sans text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <aside data-testid="member-rail" className="sticky top-0 hidden h-[100dvh] w-[94px] shrink-0 bg-[hsl(var(--member-rail-bg))] md:flex md:flex-col">
      <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col px-2 py-3">
        <Link href="/me" aria-label="Academy Fellow home" className="mb-3 grid min-h-11 place-items-center">
          <BrandLockup size="sm" showWordmark={false} tone="inverse" />
        </Link>
        {MEMBER_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isMemberNavActive(pathname, item);
          return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={clsx(itemClass, active ? 'bg-primary text-primary-fg' : 'text-[hsl(var(--member-rail-fg))] hover:bg-[hsl(var(--member-rail-hover))] hover:text-primary-fg')}><Icon aria-hidden className="h-4 w-4" strokeWidth={active ? 2 : 1.5} /><span>{item.label}</span></Link>;
        })}
        {showRetro && <Link href="/me/retro" aria-current={pathname === '/me/retro' ? 'page' : undefined} className={clsx(itemClass, pathname === '/me/retro' ? 'bg-primary text-primary-fg' : 'text-[hsl(var(--member-rail-fg))] hover:bg-[hsl(var(--member-rail-hover))] hover:text-primary-fg')}><MessageSquareText aria-hidden className="h-4 w-4" strokeWidth={1.5} /><span>{retro?.retro ? 'Update retro' : 'Retro'}</span>{retro?.open && <span className="sr-only">open</span>}</Link>}
        <div className="mt-auto space-y-1">
          <ThemeToggle presentation="rail" className={itemClass} />
          <Link href="/me/settings" aria-current={pathname.startsWith('/me/settings') ? 'page' : undefined} className={clsx(itemClass, pathname.startsWith('/me/settings') ? 'bg-primary text-primary-fg' : 'text-[hsl(var(--member-rail-fg))] hover:bg-[hsl(var(--member-rail-hover))] hover:text-primary-fg')}><Settings2 aria-hidden className="h-4 w-4" strokeWidth={1.5} /><span>Settings</span></Link>
          {user && <Link href="/me/settings/profile" className={clsx(itemClass, 'text-[hsl(var(--member-rail-fg))] hover:bg-[hsl(var(--member-rail-hover))] hover:text-primary-fg')}><span className="grid h-6 w-6 place-items-center rounded-full bg-[hsl(var(--member-rail-hover))] text-[9px]">{initialsOf(user.name)}</span><span>Profile</span></Link>}
          <button type="button" onClick={() => void logout()} className={clsx(itemClass, 'w-full text-[hsl(var(--member-rail-fg))] hover:bg-[hsl(var(--member-rail-hover))] hover:text-primary-fg')}><LogOut aria-hidden className="h-4 w-4" strokeWidth={1.5} /><span>Sign out</span></button>
        </div>
      </nav>
    </aside>
  );
}
```

Keep `initialsOf` as the existing private name helper and import `MessageSquareText`, `Settings2`, and `LogOut` from Lucide. Implement the mobile action as:

```tsx
export function MemberMobileRetroAction() {
  const pathname = usePathname();
  const { data } = useMeRetroCurrent();
  if (data?.open !== true || pathname === '/me/retro') return null;
  return (
    <Link
      href="/me/retro"
      className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+12px)] right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-input bg-[hsl(var(--member-rail-bg))] px-4 font-sans text-xs font-semibold text-primary-fg shadow-lg md:hidden"
    >
      <MessageSquareText aria-hidden className="h-4 w-4" strokeWidth={1.5} />
      {data.retro ? 'Update retro' : 'Retro open'}
    </Link>
  );
}
```

- [ ] **Step 5: Recompose `MemberShell` and reuse the navigation model in the bottom bar**

Replace the column/top-bar structure with a desktop flex shell while preserving onboarding behavior:

```tsx
export function MemberShell({ children }: MemberShellProps) {
  const pathname = usePathname();
  const isOnboarding = pathname === '/me/onboarding';

  return (
    <div className="min-h-[100dvh] bg-bg text-fg md:flex">
      {!isOnboarding && <MemberRail />}
      <div className="min-w-0 flex-1">
        <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="mx-auto w-full max-w-[1360px] px-5 py-7 sm:px-6 md:px-6 md:py-9 xl:px-8 min-[1440px]:px-10">
            <OnboardingGate><GoogleReconnectGate>{children}</GoogleReconnectGate></OnboardingGate>
          </div>
        </main>
        {!isOnboarding && <MemberMobileRetroAction />}
        {!isOnboarding && <BottomTabBar />}
      </div>
    </div>
  );
}
```

Update `BottomTabBar` to map `MEMBER_NAV_ITEMS.filter((item) => item.mobile)` plus the existing Profile destination. Delete `TopbarMember` after no imports remain.

Add a `presentation` prop to `ThemeToggle`. Its `default` output remains unchanged. Its `rail` output uses the supplied rail item class, has no independent border or surface, and renders a visible `Theme` label beneath the icon inside the same button. Keep the dynamic accessible name (`Switch to light theme` or `Switch to dark theme`) and set both icons to the standard `strokeWidth={1.5}`.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium
rtk proxy pnpm --filter @ics-select/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the shell**

```bash
rtk git add apps/web/app/globals.css apps/web/components/member-shell apps/web/components/ui/theme-toggle.tsx apps/web/tests/member-studio.spec.ts
rtk git commit -m "feat(web): introduce Academy Fellow Studio shell"
```

---

### Task 2: Today workspace and open context rail

**Files:**
- Create: `apps/web/components/member/studio-context-rail.tsx`
- Create: `apps/web/components/member/studio-page-header.tsx`
- Modify: `apps/web/app/(member)/me/page.tsx`
- Modify: `apps/web/components/member/hero-scene.tsx`
- Modify: `apps/web/components/member/day-list.tsx`
- Modify: `apps/web/components/ui/list-row.tsx`
- Modify: `apps/web/components/member/carry-over-reflection-card.tsx`
- Modify: `apps/web/components/member/top-ranking-card.tsx`
- Modify: `apps/web/components/ui/streak-card.tsx`
- Modify: `apps/web/components/member/study-time-card.tsx`
- Modify: `apps/web/tests/member-studio.spec.ts`

**Interfaces:**
- Produces: `StudioContextRail({ children, className }: { children: ReactNode; className?: string }): JSX.Element`
- Produces: `StudioPageHeader({ eyebrow, title, description, action, className }: StudioPageHeaderProps): JSX.Element`
- Produces: `presentation?: 'card' | 'context'` on `TopRankingCard`, `StreakCard`, and `StudyTimeCard`; default is `card`
- Consumes: shell from Task 1 and all existing `useMeHome`/`useMeCohort` response types

- [ ] **Step 1: Add failing assertions for the current-focus and context composition**

Extend the Today fixture with ranking and study-time data, then add:

```ts
test('Today uses an open focus band and divided context rail', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/me');
  const focus = page.getByTestId('current-focus');
  await expect(focus).toBeVisible();
  await expect(focus).toHaveCSS('border-left-width', '4px');
  await expect(focus).toHaveCSS('border-top-width', '0px');
  const context = page.getByTestId('studio-context-rail');
  await expect(context).toHaveCSS('border-left-width', '1px');
  await expect(page.getByText('LeetCode', { exact: true })).toBeVisible();
  await expect(page.locator('[data-metadata-pill]')).toHaveCount(0);
});
```

- [ ] **Step 2: Run the test and confirm current cards fail it**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium -g "Today uses"
```

Expected: FAIL because the hero is a bordered tile and no Studio context rail exists.

- [ ] **Step 3: Add the context layout primitive and presentation variants**

Create the layout-only rail:

```tsx
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export function StudioContextRail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside data-testid="studio-context-rail" className={clsx('min-w-0 border-t border-border-token pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0', className)}>
      <div className="divide-y divide-border-token">{children}</div>
    </aside>
  );
}
```

Create the shared route header for Calendar, Cohort, and Settings:

```tsx
export interface StudioPageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function StudioPageHeader({ eyebrow, title, description, action, className }: StudioPageHeaderProps) {
  return (
    <header className={clsx('flex flex-wrap items-end justify-between gap-5 border-b border-border-token pb-6', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="font-mono text-[11px] uppercase tracking-label text-fg-mute">{eyebrow}</p>}
        <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.045em] text-fg sm:text-[40px]">{title}</h1>
        {description && <p className="mt-3 max-w-prose font-sans text-sm leading-relaxed text-fg-soft">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
```

For each metric component, keep its current `card` default and map `context` to open-section classes:

```ts
const PRESENTATION = {
  card: 'rounded-tile border border-border-token bg-surface p-6',
  context: 'py-5 first:pt-0 last:pb-0',
} as const;
```

This keeps `/dev/design-system` stable while Today opts into `presentation="context"`.

- [ ] **Step 4: Rebuild current focus and day rows**

In `hero-scene.tsx`, remove enclosing radius/background/border from each state. Use a four-pixel semantic left rule, a lower divider, one CTA, and plain metadata:

```tsx
<article
  data-testid="current-focus"
  className={clsx(
    'grid gap-5 border-b border-l-4 border-border-token pb-6 pl-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end',
    HERO_BORDER[eyebrowStyle],
  )}
>
  <div>
    <p className={clsx('font-sans text-xs font-semibold', EYEBROW_TONE[eyebrowStyle])}>{eyebrow}</p>
    <h1 className="mt-3 max-w-[24ch] text-[30px] font-semibold leading-[1.12] tracking-[-0.045em] sm:text-[38px]">{item.title}</h1>
    <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-fg-mute">
      <span>{item.estimatedMinutes} min</span><span>{platformLabel(platform)}</span>
      {item.topic && <span>{item.topic.label}</span>}
    </p>
  </div>
  <Link className="inline-flex min-h-11 items-center justify-center rounded-input bg-primary px-5 text-sm font-semibold text-primary-fg" href={ctaHref}>{ctaLabel}</Link>
</article>
```

Keep list rows full-width and divided. Remove platform stripes and metadata pills; preserve outcome dots, late/carried text, click behavior, line-through completion, and focus ring.

- [ ] **Step 5: Recompose the Today route**

Add a date/greeting header above current focus, retain the existing ordering, and wrap metrics in `StudioContextRail`. Define the greeting locally from the member and browser time:

```tsx
const { user } = useAuth();
const now = new Date();
const firstName = user?.name.split(' ')[0];
const partOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening';
const greeting = firstName ? `Good ${partOfDay}, ${firstName}.` : `Good ${partOfDay}.`;
const todayLabel = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
}).format(now);

<div data-testid="studio-home" className="space-y-8">
  <StudioPageHeader eyebrow={todayLabel} title={greeting} />
  <div className="grid gap-9 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,0.62fr)]">
    <div className="min-w-0 space-y-7">
      <HeroScene hero={data.hero} />
      {lateItems.length > 0 && <section><DayList label="Earlier this week" hint={`${lateItems.length} pending · ${formatMinutes(lateMinutes)} total`} items={lateItems} activeItemId={activeItemId} /></section>}
      <section><DayList label="Today" hint={todayHint} items={data.today} activeItemId={activeItemId} /></section>
      {data.days.map((day) => <DayList key={day.date} label={day.label} items={day.items} />)}
      {(data.unscheduled?.length ?? 0) > 0 && <DayList label="Unscheduled" hint="Sem horário no calendário" items={data.unscheduled ?? []} />}
      {data.carryOverReflection && <CarryOverReflectionCard reflection={data.carryOverReflection} />}
    </div>
    <StudioContextRail>
      {cohort?.ranking && cohort.ranking.length > 0 && <TopRankingCard ranking={cohort.ranking} presentation="context" />}
      <StreakCard current={data.streak.current} last7={data.streak.last7} presentation="context" />
      {data.studyTime && data.studyTime.itemsWithTime > 0 && <StudyTimeCard studyTime={data.studyTime} presentation="context" />}
      {data.topicCoverage.length > 0 && <section className="py-5"><p className="text-xs text-fg-mute">Topic coverage</p><div className="mt-4"><TopicCoverageHeatmap topics={data.topicCoverage} tileSize={18} /></div></section>}
    </StudioContextRail>
  </div>
</div>
```

Keep the existing data calculations above this render block and add the `useAuth` import. If user data is unavailable, the derived greeting omits the name.

Recompose the existing Today loading and failure branches as open sections aligned to the primary column. Preserve `Loading…` and `Could not load your home.` exactly, give the status a readable heading relationship, and do not introduce a generic card wrapper.

- [ ] **Step 6: Verify Today states and update only its snapshots**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium
rtk proxy pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts --project=chromium -g "member (routes|empty|reference)" --update-snapshots
rtk proxy pnpm --filter @ics-select/web typecheck
```

Expected: PASS. Inspect every changed Today/reference image before accepting it.

- [ ] **Step 7: Commit Today**

```bash
rtk git add "apps/web/app/(member)/me/page.tsx" apps/web/components/member apps/web/components/ui/list-row.tsx apps/web/components/ui/streak-card.tsx apps/web/tests
rtk git commit -m "feat(web): recompose the Fellow Today workspace"
```

---

### Task 3: Calendar planning workspace

**Files:**
- Modify: `apps/web/app/(member)/me/calendar/page.tsx`
- Modify: `apps/web/components/member/calendar/calendar-header.tsx`
- Modify: `apps/web/components/member/calendar/calendar-sidebar.tsx`
- Modify: `apps/web/components/member/calendar/calendar-legend.tsx`
- Modify: `apps/web/components/member/calendar/calendar-connect-banner.tsx`
- Modify: `apps/web/components/member/calendar/calendar-skeleton.tsx`
- Modify: `apps/web/components/member/calendar/calendar-grid-skeleton.tsx`
- Modify: `apps/web/components/member/calendar/event-card-ics.tsx`
- Modify: `apps/web/components/member/calendar/event-card-external.tsx`
- Modify: `apps/web/tests/member-studio.spec.ts`
- Modify: `apps/web/tests/academy-visual-system.spec.ts`

**Interfaces:**
- Consumes: `StudioPageHeader` from Task 2 plus existing `CalendarHeader`, `CalendarSidebar`, `WeekGrid`, `CalendarLegend`, `CalendarConnectBanner`, and `RescheduleModal` props unchanged
- Produces: no new data interface; the route composition changes only

- [ ] **Step 1: Add a failing Calendar structure and behavior test**

Extend the Studio fixture with the current calendar response, then assert the open grid composition and unchanged reschedule payload:

```ts
test('Calendar makes the week grid the primary planning surface', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/me/calendar');
  const workspace = page.getByTestId('calendar-workspace');
  await expect(workspace).toBeVisible();
  await expect(page.getByTestId('calendar-agenda')).toHaveCSS('border-right-width', '1px');
  await expect(page.getByText('Binary search patterns', { exact: true }).last()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
```

Retain the existing request assertion for `PATCH /me/calendar/events/:id` in `academy-visual-system.spec.ts`.

- [ ] **Step 2: Run the Calendar test and confirm it fails structurally**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium -g "Calendar makes"
```

Expected: FAIL because the workspace and agenda test IDs and divider composition do not exist.

- [ ] **Step 3: Recompose the route around the existing grid**

Keep state and callbacks unchanged. Replace the outer spacing stack with:

```tsx
<div data-testid="calendar-workspace" className="min-w-0 space-y-5">
  <CalendarHeader
    weekStart={weekStart}
    weekEnd={weekEnd}
    onPrev={handlePrev}
    onNext={handleNext}
    onToday={handleToday}
    isRefreshing={isFetching && !isLoading}
  />
  {!data ? <CalendarSkeleton /> : (
    <>
      {!data.hasGoogleConnection && <CalendarConnectBanner variant="not_connected" />}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div data-testid="calendar-agenda" className="border-b border-border-token pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
          <CalendarSidebar events={data.events} timezone={data.timezone} />
        </div>
        <div className="min-w-0">
          <CalendarApp weekStart={weekStart} timezone={data.timezone} events={data.events} onRescheduleClick={setEditing} />
          <CalendarLegend />
        </div>
      </div>
    </>
  )}
  <RescheduleModal
    event={editing}
    timezone={data?.timezone ?? 'America/Sao_Paulo'}
    onClose={() => setEditing(null)}
    onSubmit={(input) => reschedule.mutate(input)}
  />
</div>
```

Style the header as a page title plus compact controls. Remove card shells from sidebar rows and banner where they do not indicate a separate interaction.

Inside `CalendarHeader`, keep its current props and callbacks but delegate composition to `StudioPageHeader`:

```tsx
const controls = (
  <div className="flex items-center gap-1">
    <button type="button" onClick={onToday} className="min-h-11 rounded-input border border-border-token px-4 text-sm font-medium text-fg-soft">Today</button>
    <button type="button" onClick={onPrev} aria-label="Previous week" className="grid h-11 w-11 place-items-center rounded-input text-fg-soft focus-visible:ring-2 focus-visible:ring-primary"><ChevronLeft className="h-4 w-4" strokeWidth={1.5} /></button>
    <button type="button" onClick={onNext} aria-label="Next week" className="grid h-11 w-11 place-items-center rounded-input text-fg-soft focus-visible:ring-2 focus-visible:ring-primary"><ChevronRight className="h-4 w-4" strokeWidth={1.5} /></button>
  </div>
);

return <StudioPageHeader eyebrow="Weekly planning" title={formatRange(weekStart, weekEnd).replace(' – ', ' to ')} action={controls} />;
```

Keep the current refreshing announcement beside the formatted range, using visible text for screen readers and a small semantic marker for sighted users.

- [ ] **Step 4: Align calendar events, legend, and skeletons**

Use quiet event fills, a three-pixel platform or semantic left rule, readable text, and visible focus. Keep event positioning, `kind: 'ICS'`, clicks, external links, reschedule entry, times, and grid calculations untouched. Skeletons must match the new header, agenda divider, and grid geometry.

```tsx
export function EventCardIcs({ event, timeLabel }: EventCardIcsProps) {
  const platform = detectPlatform(event.ics?.url, event.ics?.format);
  const outcome = event.ics?.outcome ?? 'PENDING';
  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-md border border-border-token bg-primary-soft/70">
      <span aria-hidden className={clsx('w-[3px] shrink-0', PLATFORM_CLASS[platform])} />
      <div className="min-w-0 flex-1 px-2 py-1">
        <span className="block truncate font-sans text-xs font-semibold text-fg">{event.title}</span>
        <span className="block truncate font-mono text-[10px] text-fg-mute">{timeLabel} · {platformLabel(platform)}</span>
      </div>
      <span aria-hidden className={clsx('absolute right-1 top-1 h-2 w-2 rounded-full', OUTCOME_CLASS[outcome])} />
      <span className="sr-only">Outcome: {outcome}</span>
    </div>
  );
}
```

- [ ] **Step 5: Verify Calendar interaction and visual output**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts tests/academy-visual-system.spec.ts --project=chromium -g "Calendar|member routes" --update-snapshots
rtk proxy pnpm --filter @ics-select/web typecheck
```

Expected: PASS; existing invalid-end validation and PATCH body remain identical.

- [ ] **Step 6: Commit Calendar**

```bash
rtk git add "apps/web/app/(member)/me/calendar/page.tsx" apps/web/components/member/calendar apps/web/tests
rtk git commit -m "feat(web): turn Calendar into a Studio workspace"
```

---

### Task 4: Cohort roster and activity composition

**Files:**
- Modify: `apps/web/app/(member)/me/cohort/page.tsx`
- Modify: `apps/web/components/member/cohort-roster.tsx`
- Modify: `apps/web/components/member/cohort-feed.tsx`
- Modify: `apps/web/tests/member-studio.spec.ts`
- Modify: `apps/web/tests/academy-visual-system.spec.ts`

**Interfaces:**
- Keeps: `CohortRoster({ members, ranking })` and `CohortFeed({ feed, className })` signatures unchanged
- Consumes: `StudioPageHeader` and `StudioContextRail` from Task 2

- [ ] **Step 1: Add a failing test for the split roster and current-member row**

Use a two-member cohort fixture with ranking and feed:

```ts
test('Cohort separates roster and activity without a card grid', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/me/cohort');
  await expect(page.getByTestId('cohort-roster')).toBeVisible();
  await expect(page.getByTestId('studio-context-rail')).toHaveCSS('border-left-width', '1px');
  await expect(page.getByTestId('cohort-member-me')).toHaveCSS('border-left-width', '3px');
  await expect(page.getByText('Recursion intro')).toBeVisible();
});
```

- [ ] **Step 2: Run the Cohort test and confirm the old card fails it**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium -g "Cohort separates"
```

Expected: FAIL because the page stacks sections and the roster has an enclosing card.

- [ ] **Step 3: Recompose the Cohort route**

```tsx
<div className="max-w-[1180px] space-y-9">
  <StudioPageHeader eyebrow={`Cohort · ${data.cycleName || 'active cycle'}`} title={data.memberCount === 0 ? 'No cohort yet.' : `${data.memberCount} classmates this cycle`} />
  <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
    {hasMembers ? <CohortRoster members={data.members} ranking={data.ranking} /> : <p className="border-t border-border-token py-6 text-sm text-fg-mute">No classmates to show.</p>}
    <StudioContextRail className="lg:pl-8">
      <section data-testid="cohort-activity"><SectionLabel>Activity · last 7d</SectionLabel><CohortFeed feed={data.feed} /></section>
    </StudioContextRail>
  </div>
</div>
```

Destructure the existing query error state. Loading keeps the existing `Loading…` text in the normal content column; a failed request renders a plain `Could not load your cohort.` status section in the same geometry. Neither state receives an enclosing card.

- [ ] **Step 4: Flatten roster and feed rows**

Remove the roster's outer card and inner header. Add `data-testid="cohort-roster"` to the ordered list, `data-testid="cohort-member-me"` to the member's row, a three-pixel blue left rule plus soft selection fill for the current member, and a bottom divider for every row except the last. Keep ranking order, avatar behavior, score, and empty fallback unchanged.

```tsx
<ol data-testid="cohort-roster" role="list" className="border-t border-border-token">
  <li className={clsx('grid min-h-16 grid-cols-[32px_44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border-token py-3', row.isMe && 'border-l-[3px] border-l-primary bg-primary-soft/60 pl-3')}>
    {useRanking && <span className="w-8 font-mono text-xs tabular-nums text-fg-mute">{String(idx + 1).padStart(2, '0')}</span>}
    <Initials name={row.name} pictureUrl={row.pictureUrl} />
    <p className="min-w-0 truncate text-sm font-semibold text-fg">{row.name}{row.isMe && <span className="ml-2 text-xs text-primary dark:text-primary-fg">You</span>}</p>
    {useRanking && row.score !== null && <span className={clsx('font-mono text-sm tabular-nums', scoreColor(row.score))}>{row.score}/100</span>}
  </li>
</ol>
```

Give feed items the same divider rhythm and remove decorative backgrounds.

- [ ] **Step 5: Verify desktop, mobile stacking, empty state, and snapshots**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts tests/academy-visual-system.spec.ts --project=chromium -g "Cohort|member (routes|empty)" --update-snapshots
rtk proxy pnpm --filter @ics-select/web typecheck
```

Expected: PASS with roster first and activity second at 390 pixels.

- [ ] **Step 6: Commit Cohort**

```bash
rtk git add "apps/web/app/(member)/me/cohort/page.tsx" apps/web/components/member/cohort-roster.tsx apps/web/components/member/cohort-feed.tsx apps/web/tests
rtk git commit -m "feat(web): recompose the Fellow cohort view"
```

---

### Task 5: Guided input primitives and conversational Retro

**Files:**
- Create: `apps/web/components/member/guided-flow.tsx`
- Create: `apps/web/components/member/guided-choice.tsx`
- Create: `apps/web/components/member/guided-text-response.tsx`
- Modify: `apps/web/components/member/retro-form.tsx`
- Modify: `apps/web/components/member/retro-recap.tsx`
- Modify: `apps/web/app/(member)/me/retro/page.tsx`
- Modify: `apps/web/tests/retro.spec.ts`

**Interfaces:**
- Produces: `GuidedFlowProps` with `stepKey`, `headingId`, `index`, `total`, `direction`, `title`, `description`, `canContinue`, `final`, `submitLabel`, `submittingLabel`, `submitting`, `exitLabel`, `onExit`, `onPrevious`, `onContinue`, `onSubmit`, and optional `context`
- Produces: `GuidedChoice<T extends string>({ name, labelledBy, options, value, onChange }): JSX.Element`
- Produces: `GuidedTextResponse({ id, labelledBy, value, onChange, placeholder, error }): JSX.Element`
- Produces: `presentation?: 'full' | 'context'` on `RetroRecap`; default is `full`
- Consumes: current `RetroCurrentResponse`, `useSubmitRetro`, conditional outcome sets, and HeroUI toast behavior

- [ ] **Step 1: Rewrite Retro tests around one active question**

Replace the test that expects every question simultaneously. Keep recap data and submission fixtures, and add precise step behavior:

```ts
test('Retro presents one conditional question at a time and preserves answers', async ({ page }) => {
  await page.goto('/me/retro');
  await expect(page.getByRole('heading', { name: 'Qual item dessa semana travou ou ficou com dúvida?' })).toBeVisible();
  await expect(page.getByText('1 of 5')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exit reflection' })).toBeVisible();
  await page.keyboard.press('A');
  await expect(page.getByRole('radio', { name: 'Query Plan Explained' })).toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();
  const stuckHeading = page.getByRole('heading', { name: 'O que falta pra desbloquear?' });
  await expect(stuckHeading).toBeFocused();
  await page.keyboard.press('Tab');
  const stuckAnswer = page.getByRole('textbox', { name: 'O que falta pra desbloquear?' });
  await expect(stuckAnswer).toBeFocused();
  await stuckAnswer.fill('Rever o invariante com um exemplo menor.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Previous question' }).click();
  await expect(stuckAnswer).toHaveValue('Rever o invariante com um exemplo menor.');
});

test('closed Retro renders a review or notice without disabled form controls', async ({ page }) => {
  await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({ json: { ...MOCK_RETRO_CURRENT, open: false } }));
  await page.goto('/me/retro');
  await expect(page.getByText('Retro closed', { exact: false })).toBeVisible();
  await expect(page.locator('textarea, input[type="radio"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /submit retro/i })).toHaveCount(0);
});

test('Retro submits the existing payload only on the final step', async ({ page }) => {
  await page.route(`${API_BASE}/me/retro`, (route) => route.fulfill({ json: {} }));
  await page.goto('/me/retro');
  await page.getByRole('radio', { name: 'Query Plan Explained' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'O que falta pra desbloquear?' }).fill('Rever o invariante.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'SQL Joins Explained' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Por quê?' }).fill('O exemplo conectou teoria e prática.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: '1 coisa que você quer no próximo plano' }).fill('mais system design');
  const request = page.waitForRequest((candidate) => candidate.url().endsWith('/me/retro') && candidate.method() === 'POST');
  await page.getByRole('button', { name: 'Submit retro' }).click();
  expect((await request).postDataJSON()).toEqual({
    whatClicked: 'O exemplo conectou teoria e prática.',
    whatStuck: 'Rever o invariante.',
    nextWeekWish: 'mais system design',
    valuedItemId: 'wpi-1',
    stuckItemId: 'wpi-3',
  });
});

test('Retro keeps the final answer visible after a failed submit', async ({ page }) => {
  await page.route(`${API_BASE}/me/retro`, (route) => route.fulfill({ status: 500, json: { message: 'Unavailable' } }));
  await page.goto('/me/retro');
  await page.getByRole('radio', { name: 'Query Plan Explained' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Nenhum' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const wish = page.getByRole('textbox', { name: '1 coisa que você quer no próximo plano' });
  await wish.fill('uma semana mais leve');
  await page.getByRole('button', { name: 'Submit retro' }).click();
  await expect(page.getByText('Could not save retro')).toBeVisible();
  await expect(wish).toHaveValue('uma semana mais leve');
});
```

Add focused cases for an existing submitted Retro (answers prefill and the final action says `Update retro`), a recap without stuck items (three visible steps), no recap (one visible step), and a pending submit (final action disables and reads `Saving…`). Remove the old stacked-form payload test after these assertions cover the same contract.

- [ ] **Step 2: Run Retro tests and confirm the stacked form fails**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/retro.spec.ts --project=chromium
```

Expected: FAIL because all questions are visible, no progress or Previous control exists, and closed Retro renders disabled fields.

- [ ] **Step 3: Implement the guided-flow presentation boundary**

`GuidedFlow` must not own feature values or submit APIs. It handles focus, progress, direction, and controls:

```tsx
export interface GuidedFlowProps {
  stepKey: string;
  headingId: string;
  index: number;
  total: number;
  direction: 1 | -1;
  title: string;
  description?: string;
  canContinue: boolean;
  final: boolean;
  submitLabel: string;
  submittingLabel: string;
  submitting?: boolean;
  exitLabel: string;
  onExit: () => void;
  onPrevious: () => void;
  onContinue: () => void;
  onSubmit: () => void;
  context?: ReactNode;
  children: ReactNode;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function GuidedFlow(props: GuidedFlowProps) {
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const distance = reduceMotion ? 0 : 24 * props.direction;
  const contentGrid = props.context
    ? 'grid items-center gap-8 lg:grid-cols-[minmax(260px,300px)_minmax(0,680px)] lg:justify-center'
    : 'mx-auto grid w-full max-w-[680px] items-center';
  return (
    <section className="grid min-h-[min(680px,calc(100dvh-72px))] grid-rows-[auto_1fr_auto]">
      <header className="flex items-center gap-4">
        <button type="button" onClick={props.onExit} aria-label={props.exitLabel} className="inline-flex min-h-11 items-center gap-2 rounded-input px-2 text-sm text-fg-soft focus-visible:ring-2 focus-visible:ring-primary"><X aria-hidden className="h-4 w-4" strokeWidth={1.5} /><span>Exit</span></button>
        <span aria-hidden className="h-[3px] flex-1 overflow-hidden bg-bg-subtle"><motion.span className="block h-full origin-left bg-primary" animate={{ scaleX: (props.index + 1) / props.total }} transition={{ duration: reduceMotion ? 0 : 0.3, ease: EASE }} /></span>
        <span className="font-mono text-xs text-fg-mute">{props.index + 1} of {props.total}</span>
        <span className="sr-only" aria-live="polite">Question {props.index + 1} of {props.total}</span>
      </header>
      <div className={contentGrid}>
        {props.context}
        <AnimatePresence mode="wait" initial={false} custom={props.direction}>
          <motion.div key={props.stepKey} initial={{ opacity: 0, y: distance }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -distance }} transition={{ duration: reduceMotion ? 0.1 : 0.3, ease: EASE }} onAnimationComplete={() => { if (headingRef.current?.id === props.headingId) headingRef.current.focus({ preventScroll: true }); }}>
            <h1 id={props.headingId} ref={headingRef} tabIndex={-1} className="text-[28px] font-semibold leading-[1.15] tracking-[-0.045em] outline-none sm:text-[36px]">{props.title}</h1>
            {props.description && <p className="mt-3 max-w-prose text-sm text-fg-soft">{props.description}</p>}
            <div className="mt-7">{props.children}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="flex items-center justify-between gap-3 py-5">
        <button type="button" aria-label="Previous question" onClick={props.onPrevious} disabled={props.index === 0} className="min-h-11 rounded-input px-3 text-sm text-fg-soft disabled:invisible">Previous</button>
        {props.final ? (
          <motion.button type="button" whileTap={reduceMotion ? undefined : { scale: 0.98 }} onClick={props.onSubmit} disabled={!props.canContinue || props.submitting} className="min-h-11 rounded-input bg-primary px-5 text-sm font-semibold text-primary-fg disabled:bg-bg-subtle disabled:text-fg-mute">{props.submitting ? props.submittingLabel : props.submitLabel}</motion.button>
        ) : (
          <motion.button type="button" whileTap={reduceMotion ? undefined : { scale: 0.98 }} onClick={props.onContinue} disabled={!props.canContinue} className="min-h-11 rounded-input bg-primary px-5 text-sm font-semibold text-primary-fg disabled:bg-bg-subtle disabled:text-fg-mute">Continue</motion.button>
        )}
      </footer>
    </section>
  );
}
```

Expose a polite status such as `Question ${index + 1} of ${total}`. Hide the visual progress line from assistive technology. The `id` guard on `onAnimationComplete` prevents the exiting panel from taking focus while `AnimatePresence` is waiting to mount the next panel. Import `X` from Lucide and keep it decorative beside the visible Exit label.

- [ ] **Step 4: Implement native guided choices and borderless text response**

`GuidedChoice` uses native radios and A-D shortcuts only while a text field is not focused:

```tsx
export interface GuidedChoiceOption<T extends string> { value: T; label: string }

export interface GuidedChoiceProps<T extends string> {
  name: string;
  labelledBy: string;
  options: readonly GuidedChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

export function GuidedChoice<T extends string>({ name, labelledBy, options, value, onChange }: GuidedChoiceProps<T>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!/^[a-d]$/i.test(event.key)) return;
      const index = event.key.toUpperCase().charCodeAt(0) - 65;
      const option = options[index];
      if (option) { event.preventDefault(); onChange(option.value); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onChange, options]);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="border-t border-border-token">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <label key={option.value} className="grid min-h-14 cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-border-token py-3">
            <input className="sr-only" type="radio" name={name} value={option.value} checked={selected} onChange={() => onChange(option.value)} />
            {index < 4 ? <kbd aria-hidden className={clsx('grid h-7 w-7 place-items-center rounded-md border font-mono text-xs', selected && 'border-primary bg-primary text-primary-fg')}>{String.fromCharCode(65 + index)}</kbd> : <span aria-hidden className="h-7 w-7" />}
            <span className={clsx('font-sans text-base', selected && 'font-semibold text-primary dark:text-primary-fg')}>{option.label}</span>
            {selected && <Check aria-hidden className="h-4 w-4 text-primary dark:text-primary-fg" strokeWidth={2} />}
          </label>
        );
      })}
    </div>
  );
}
```

`GuidedTextResponse` uses the visible step heading through `aria-labelledby` and renders its error adjacent to the field:

```tsx
export interface GuidedTextResponseProps {
  id: string;
  labelledBy: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}

export function GuidedTextResponse({ id, labelledBy, value, onChange, placeholder, error }: GuidedTextResponseProps) {
  return (
    <div>
      <textarea
        id={id}
        aria-labelledby={labelledBy}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-28 w-full resize-y border-0 border-b-2 border-border-strong bg-transparent px-0 pb-3 font-sans text-xl leading-relaxed text-fg caret-primary outline-none placeholder:text-fg-faint focus:border-primary focus:ring-0 sm:text-2xl"
      />
      {error && <p id={`${id}-error`} role="alert" className="mt-2 font-sans text-xs text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Convert Retro into a derived step list**

Keep current state variables. Derive explicit IDs and remove false conditions before calculating progress:

```ts
type RetroStepId = 'stuck-item' | 'what-stuck' | 'valued-item' | 'what-clicked' | 'next-week';

const steps = useMemo<RetroStepId[]>(() => {
  const visible: RetroStepId[] = [];
  if (showStuckQuestion) visible.push('stuck-item');
  if (showStuckQuestion) visible.push('what-stuck');
  if (showValuedQuestion) visible.push('valued-item', 'what-clicked');
  visible.push('next-week');
  return visible;
}, [showStuckQuestion, showValuedQuestion]);

const activeStep = steps[stepIndex] ?? 'next-week';
const headingId = `retro-${activeStep}-question`;
```

Pass `headingId` to `GuidedFlow` and to the active `GuidedChoice` or `GuidedTextResponse`. Pass `exitLabel="Exit reflection"` and navigate back to Today from `onExit`. Clamp the active index if query data changes the visible steps. Preserve the existing `Nenhum` choice and map its local sentinel to `null`. Retro answers remain optional as they are today, so `canContinue` must not invent new required validation. Wrap `handleSubmit` so only the final action calls `useSubmitRetro`. Keep existing toast titles and descriptions.

Give `RetroRecap` a `presentation` prop whose `full` default preserves its current open section and whose `context` variant tightens the stat and item rhythm for a narrower column. For an open Retro with recap data, pass `<RetroRecap recap={recap} presentation="context" />` through `GuidedFlow.context`; the component then sits beside the question at `lg` and naturally precedes it on smaller screens. Do not duplicate the recap above the flow.

For closed Retro, render the current recap plus either submitted answer sections or the availability notice. Do not mount disabled fields.

In the route page, distinguish loading from query failure and render both as open Studio status sections. Keep `Loading…`; use `Could not load your retro.` for the failure state. Do not flash the guided form until data exists.

- [ ] **Step 6: Verify conditional counts, keyboard, payload, errors, themes, and reduced motion**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/retro.spec.ts --project=chromium --update-snapshots
rtk proxy pnpm --filter @ics-select/web typecheck
```

Expected: PASS. The POST body is unchanged and snapshots show one question at a time in both themes.

- [ ] **Step 7: Commit guided Retro**

```bash
rtk git add apps/web/components/member/guided-flow.tsx apps/web/components/member/guided-choice.tsx apps/web/components/member/guided-text-response.tsx apps/web/components/member/retro-form.tsx apps/web/components/member/retro-recap.tsx "apps/web/app/(member)/me/retro/page.tsx" apps/web/tests/retro.spec.ts
rtk git commit -m "feat(web): turn Retro into a guided reflection"
```

---

### Task 6: Item study workspace and guided outcome

**Files:**
- Modify: `apps/web/app/(member)/me/item/[id]/page.tsx`
- Modify: `apps/web/components/member/item-focus.tsx`
- Modify: `apps/web/components/ui/outcome-picker.tsx`
- Modify: `apps/web/tests/member-studio.spec.ts`
- Modify: `apps/web/tests/academy-visual-system.spec.ts`

**Interfaces:**
- Consumes: `GuidedFlow` and `GuidedTextResponse` from Task 5
- Produces: `presentation?: 'compact' | 'guided'` on `OutcomePicker`; default is `compact`
- Keeps: `ItemFocus({ item }: { item: ItemResponse })` and `useSetItemOutcome` payload unchanged

- [ ] **Step 1: Add failing tests for sequential outcome completion**

Move the existing item payload assertions into an explicit sequence test:

```ts
test('Item outcome asks one decision at a time and keeps the existing payload', async ({ page }) => {
  await mockStudioMember(page);
  await page.goto('/me/item/binary-search');
  await expect(page.getByTestId('item-focus-header')).toHaveCSS('border-left-width', '4px');
  await page.getByRole('button', { name: 'How did it go?' }).click();
  await page.getByRole('button', { name: 'Nailed it' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const reflection = page.getByRole('textbox', { name: /nota/i });
  await reflection.fill('Entendi o invariante.');
  await page.getByRole('button', { name: 'Continue' }).click();
  const minutes = page.getByRole('spinbutton', { name: 'Tempo gasto (min)' });
  await minutes.fill('0');
  await expect(page.getByText('Use um número inteiro entre 1 e 1440.')).toBeVisible();
  await minutes.fill('45');
  const request = page.waitForRequest((candidate) => candidate.url().endsWith('/plans/plan-1/items/binary-search/outcome') && candidate.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save outcome' }).click();
  expect((await request).postDataJSON()).toEqual({ outcome: 'DONE_EASY', reflection: 'Entendi o invariante.', actualMinutes: 45 });
});
```

Extend `mockStudioMember` with a complete `ItemResponse` fixture at `/me/item/binary-search`; do not reuse the flatter `HomeItem` object as the item-route response. Add a second test that makes the final PATCH return 500 and confirms the active answer, minutes, and inline error remain visible. Retain the existing skip, undo, completed-edit, and optimistic-cache assertions from `academy-visual-system.spec.ts`, updating only their step navigation.

- [ ] **Step 2: Run the item test and confirm the inline stack fails**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium -g "Item outcome"
```

Expected: FAIL because reflection and time appear together and there is no Continue action.

- [ ] **Step 3: Recompose the item reading workspace**

Replace the title card and metadata separators with an open single-column layout no wider than 800 pixels:

```tsx
const headerAccent = isRunningLate ? 'border-l-warn' : isDone ? 'border-l-success' : 'border-l-primary';

<div className="max-w-[800px] space-y-8">
  <Link href="/me" className="inline-flex min-h-11 items-center gap-2 text-sm text-fg-mute focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft /> Back to Today</Link>
  <header data-testid="item-focus-header" className={clsx('border-b border-l-4 border-border-token pb-7 pl-5', headerAccent)}>
    <Eyebrow>{eyebrowText}</Eyebrow>
    <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.045em] sm:text-[40px]">{item.libraryItem.title}</h1>
    <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-fg-mute">
      <span>{platformLabel(platform)}</span>
      <span>{item.libraryItem.estimatedMinutes} min</span>
      {item.libraryItem.topic && <span>{item.libraryItem.topic.label}</span>}
    </p>
  </header>
</div>
```

Place the current resource action, description, carry-over context, outcome editor, completed result, and stuck notice after this header in their current order. Change only carry-over and stuck wrappers to open semantic sections with left rules; preserve all text and conditional rendering.

Align the item route's existing `Loading…` and `Item not found.` branches to the same 800-pixel reading column with open status geometry. Keep both messages and query conditions unchanged.

- [ ] **Step 4: Add a guided presentation to `OutcomePicker` and drive local steps**

Keep the current compact mode for the design-system page. Guided mode renders full-width row buttons with `aria-pressed`, bottom dividers, outcome dot, and selected check.

In `ItemFocus`, change the existing `editing` initialization and introduce the explicit step state:

```ts
type OutcomeStep = 'outcome' | 'reflection' | 'time';
const [outcomeStep, setOutcomeStep] = useState<OutcomeStep>('outcome');
const [editing, setEditing] = useState(false);

const outcomeSteps: OutcomeStep[] = outcome === null
  ? ['outcome']
  : [
      'outcome',
      ...(outcome !== 'PENDING' && outcome !== 'SKIPPED' ? ['reflection' as const] : []),
      ...(TIME_REQUIRED_OUTCOMES.has(outcome) ? ['time' as const] : []),
    ];
```

Render one active step with the Task 5 primitives. Pass `submitLabel="Save outcome"` and `submittingLabel="Saving…"`; Retro passes `submitLabel={isUpdate ? 'Update retro' : 'Submit retro'}` and `submittingLabel="Saving…"`. The last visible step uses the submit label; prior steps use `Continue`. Do not call the mutation before Save. On success retain the existing optimistic update and close editing. Undo and edit return to the correct first step without clearing existing reflection.

For a pending item, render a full-width secondary action labeled `How did it go?` beneath the study content. It opens the flow and moves focus to the outcome question. For completed items, retain the current readable outcome plus Edit action. Pass `exitLabel="Exit outcome editor"`; `onExit` closes the guided editor without clearing local answers.

Keep the time field native and accessible, but align it with the response surface instead of retaining the boxed control:

```tsx
<input
  aria-labelledby={headingId}
  type="number"
  inputMode="numeric"
  min={1}
  max={1440}
  step={1}
  value={actualMinutesInput}
  onChange={(event) => setActualMinutesInput(event.target.value)}
  className="min-h-14 w-full max-w-48 border-0 border-b-2 border-border-strong bg-transparent px-0 font-mono text-3xl tabular-nums text-fg outline-none focus:border-primary focus:ring-0"
/>
```

Call `mutation.mutate(payload, { onSuccess, onError })`: keep the existing optimistic cache update, close the editor only in `onSuccess`, and expose the failure beside the final action while leaving every local answer intact. Clear the error when the fellow edits a value or retries.

- [ ] **Step 5: Verify pending, time-required, skipped, completed, and stuck behavior**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts tests/academy-visual-system.spec.ts --project=chromium -g "Item outcome|member outcome|member routes" --update-snapshots
rtk proxy pnpm --filter @ics-select/web typecheck
```

Expected: PASS with unchanged PATCH payloads, one active outcome question, explicit entry and exit, and preserved answers after failure.

- [ ] **Step 6: Commit Item Focus**

```bash
rtk git add "apps/web/app/(member)/me/item/[id]/page.tsx" apps/web/components/member/item-focus.tsx apps/web/components/ui/outcome-picker.tsx apps/web/tests
rtk git commit -m "feat(web): rebuild the Fellow study workspace"
```

---

### Task 7: Direct-edit Studio settings

**Files:**
- Modify: `apps/web/app/(member)/me/settings/layout.tsx`
- Modify: `apps/web/app/(member)/me/settings/profile/page.tsx`
- Modify: `apps/web/app/(member)/me/settings/appearance/page.tsx`
- Modify: `apps/web/app/(member)/me/settings/availability/page.tsx`
- Modify: `apps/web/components/member/settings-nav.tsx`
- Modify: `apps/web/components/member/profile-fields.tsx`
- Modify: `apps/web/components/member/phone-input.tsx`
- Modify: `apps/web/components/member/google-status-card.tsx`
- Modify: `apps/web/components/member/theme-picker.tsx`
- Modify: `apps/web/components/member/availability-grid.tsx`
- Modify: `apps/web/components/member/availability-slot-editor.tsx`
- Modify: `apps/web/components/member/global-save-indicator.tsx`
- Modify: `apps/web/tests/settings-tabs.spec.ts`

**Interfaces:**
- Keeps: all settings query, mutation, autosave, overlap, time-picker, and theme interfaces unchanged
- Keeps: `SettingsNav`, `ProfileFields`, `PhoneInput`, `ThemePicker`, `AvailabilityGrid`, and `GlobalSaveIndicator` public props unchanged
- Consumes: `StudioPageHeader` from Task 2

- [ ] **Step 1: Add failing tests for the new local navigation and light fields**

Extend `settings-tabs.spec.ts`:

```ts
test('settings uses ruled local navigation and low-emphasis fields', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/me/settings/profile');
  const nav = page.getByRole('navigation', { name: 'Settings sections' });
  await expect(nav.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
  await expect(nav).toHaveCSS('border-right-width', '1px');
  const phone = page.getByRole('textbox');
  await expect(phone).toHaveCSS('border-bottom-width', '2px');
  await expect(phone).toHaveCSS('border-top-width', '0px');
  await expect(page.getByRole('status')).toContainText('Saved');
});

test('mobile settings tabs use an active underline and never clip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/me/settings/appearance');
  const active = page.getByRole('link', { name: 'Appearance' });
  await expect(active).toHaveCSS('border-bottom-width', '2px');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
```

- [ ] **Step 2: Run focused Settings tests and confirm they fail visually**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/settings-tabs.spec.ts --project=chromium -g "ruled local|active underline"
```

Expected: FAIL because desktop links use filled rounded states and the phone input is boxed.

- [ ] **Step 3: Recompose the Settings shell and navigation**

```tsx
<div className="max-w-[1120px] space-y-9">
  <StudioPageHeader eyebrow="Settings" title="Your preferences." />
  <div className="grid gap-8 md:grid-cols-[180px_minmax(0,720px)] md:gap-10">
    <SettingsNav />
    <div className="min-w-0 space-y-10">{children}</div>
  </div>
  <div className="flex justify-end border-t border-border-token pt-4"><GlobalSaveIndicator /></div>
</div>
```

Desktop nav uses plain 44-pixel rows and a three-pixel active left rule. Mobile nav uses text tabs with a two-pixel active bottom rule. Remove filled rounded active backgrounds.

- [ ] **Step 4: Apply low-emphasis field and section styling**

Restyle `PhoneInput` and timezone to use a transparent background, zero side/top borders, two-pixel bottom rule, and blue focused rule. Keep native input type, mask, validation, debounce, and labels.

```tsx
className={clsx(
  'min-h-12 w-full border-0 border-b-2 bg-transparent px-0 py-2 font-sans text-base text-fg outline-none transition-colors placeholder:text-fg-faint focus:ring-0',
  hasError ? 'border-danger focus:border-danger' : 'border-border-strong focus:border-primary',
)}
```

Replace enclosing cards in `GoogleStatusCard`, `AvailabilityGrid` busy toggle, and each availability day with divided sections or rows. Theme choices remain bounded interactive controls because the entire visual preview is clickable. Preserve every accessibility label and 44-pixel target.

Keep Profile and Availability loading messages in the normal settings content column. Distinguish an Availability query failure from loading and render `Could not load availability.` without a card; mutation errors continue through the existing `SettingsErrorProvider` and global save indicator.

- [ ] **Step 5: Verify autosave, overlap, popovers, zoom, themes, and screenshots**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/settings-tabs.spec.ts tests/availability-slots.spec.ts --project=chromium --update-snapshots
rtk proxy pnpm --filter @ics-select/web typecheck
```

Expected: PASS, including 200 percent zoom and time picker tests. Inspect all three mobile Settings snapshots in both themes.

- [ ] **Step 6: Commit Settings**

```bash
rtk git add "apps/web/app/(member)/me/settings" apps/web/components/member apps/web/tests/settings-tabs.spec.ts apps/web/tests/availability-slots.spec.ts
rtk git commit -m "feat(web): align Fellow settings with Studio"
```

---

### Task 8: Onboarding, gates, previews, and complete member verification

**Files:**
- Modify: `apps/web/app/(member)/me/onboarding/page.tsx`
- Modify: `apps/web/components/member-shell/onboarding-gate.tsx`
- Modify: `apps/web/components/member-shell/google-reconnect-gate.tsx`
- Modify: `apps/web/app/dev/me-preview/page.tsx`
- Modify: `apps/web/tests/member-studio.spec.ts`
- Modify: `apps/web/tests/settings-tabs.spec.ts`
- Modify: `apps/web/tests/academy-visual-system.spec.ts`
- Update: `apps/web/tests/**/*-snapshots/*.png` only for member surfaces changed by this plan
- Update: `apps/web/public/landing/product-me-home.png`

**Interfaces:**
- Consumes: shell from Task 1, context presentation from Task 2, and guided motion language from Task 5
- Keeps: onboarding mutations and write order, `OnboardingGate`, `GoogleReconnectGate`, and `/dev/me-preview` route contracts unchanged

- [ ] **Step 1: Add failing tests for gate composition and reduced motion**

Add to `member-studio.spec.ts` and retain the existing onboarding behavior test:

```ts
test('reconnect gate uses the Studio canvas and keeps the OAuth target', async ({ page }) => {
  await mockStudioMember(page);
  await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({ json: { ...member, googleConnected: false } }));
  await page.goto('/me');
  const gate = page.getByTestId('google-reconnect-gate');
  await expect(gate).toBeVisible();
  await expect(gate).toHaveCSS('border-top-width', '0px');
  await expect(gate.getByRole('link', { name: 'Reconnect Google' })).toHaveAttribute('href', 'http://localhost:3001/auth/google');
});

test('guided member motion becomes static with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockStudioMember(page);
  await page.goto('/me/retro');
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length)).toBe(0);
});
```

- [ ] **Step 2: Run the gate and motion tests and confirm the old gate fails**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium -g "reconnect gate|guided member motion"
```

Expected: reconnect composition FAILS before the open Studio gate is implemented.

- [ ] **Step 3: Align onboarding and gates with the approved motion language**

Reuse the Task 5 focused easing, vertical motion, thin progress line, question scale, and reduced-motion distance. Do not replace onboarding's state or mutation sequence.

```ts
const reduceMotion = useReducedMotion();
const stepVariants = {
  enter: (direction: 1 | -1) => ({ opacity: 0, y: reduceMotion ? 0 : direction * 24 }),
  center: { opacity: 1, y: 0 },
  exit: (direction: 1 | -1) => ({ opacity: 0, y: reduceMotion ? 0 : direction * -20 }),
};
```

Replace `Card` wrappers in redirect and reconnect gates with open centered sections, keep `role="status"`, add `data-testid="google-reconnect-gate"`, and preserve the existing OAuth URL.

Audit every route-level loading, empty, closed, and failure branch touched in Tasks 2 through 7 against the open Studio geometry. Confirm that Today, Calendar, Item Focus, Cohort, Retro, and Settings retain a visible status or recovery message without falling back to a generic card or indefinitely showing loading after a query error.

- [ ] **Step 4: Update the deterministic member preview**

Rebuild `/dev/me-preview` with a preview-only shell driven by its existing static data. Keep auth and API hooks out of this deterministic route, while reusing `MEMBER_NAV_ITEMS`, `HeroScene`, `DayList`, metric components, and `StudioContextRail`.

```tsx
<div data-testid="academy-member-preview" className="min-h-[100dvh] bg-bg text-fg md:flex">
  <aside className="hidden h-[100dvh] w-[94px] shrink-0 bg-[hsl(var(--member-rail-bg))] px-2 py-3 md:flex md:flex-col">
    <Link href="/me" aria-label="Academy Fellow home" className="mb-3 grid min-h-11 place-items-center">
      <BrandLockup size="sm" showWordmark={false} tone="inverse" />
    </Link>
    <nav aria-label="Main navigation" className="space-y-1">
      {MEMBER_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={href === '/me' ? 'page' : undefined} className={clsx('flex min-h-12 flex-col items-center justify-center gap-1 rounded-input text-[10px]', href === '/me' ? 'bg-primary text-primary-fg' : 'text-[hsl(var(--member-rail-fg))]')}>
          <Icon aria-hidden className="h-4 w-4" strokeWidth={1.5} /><span>{label}</span>
        </Link>
      ))}
    </nav>
  </aside>
  <main className="min-w-0 flex-1 px-5 py-7 md:px-6 md:py-9 xl:px-8 min-[1440px]:px-10">
    <div className="mx-auto max-w-[1360px] space-y-8">
      <header><p className="font-mono text-[11px] uppercase tracking-label text-fg-mute">Friday, April 17</p><h1 className="mt-2 text-[32px] font-semibold tracking-[-0.045em] sm:text-[40px]">Good afternoon, Eduardo.</h1></header>
      <div className="grid gap-9 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,0.62fr)]">
        <div className="min-w-0 space-y-7">
          <HeroScene hero={{ state: 'now', item: current }} />
          <DayList label="Today" hint="1/3 done · 2 h total" items={today} activeItemId={current.id} now={NOW} />
          <DayList label="Sat, Apr 18" hint="2 items · 1 h 30 min" items={tomorrow} now={NOW} />
        </div>
        <StudioContextRail>
          <TopRankingCard ranking={previewRanking} presentation="context" />
          <StreakCard current={12} last7={[true, true, true, false, true, true, true]} presentation="context" />
          <StudyTimeCard studyTime={{ actualMinutes: 255, estimatedMinutes: 300, itemsWithTime: 6, itemsTotal: 8 }} presentation="context" />
          <section className="py-5"><p className="text-xs text-fg-mute">Topic coverage</p><div className="mt-4"><TopicCoverageHeatmap topics={topics} tileSize={18} /></div></section>
        </StudioContextRail>
      </div>
    </div>
  </main>
  <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-border-token bg-surface md:hidden">
    {[...MEMBER_NAV_ITEMS, { href: '/me/settings', label: 'Profile', icon: UserRound, mobile: true }].map(({ href, label, icon: Icon }) => (
      <Link key={href} href={href} className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs text-fg-mute"><Icon aria-hidden className="h-5 w-5" strokeWidth={1.5} />{label}</Link>
    ))}
  </nav>
</div>
```

Move the existing static ranking array into a `previewRanking` constant and add the `UserRound`, `MEMBER_NAV_ITEMS`, and `StudioContextRail` imports. Do not add product data beyond the existing deterministic preview fixture.

- [ ] **Step 5: Run the member-focused suite and update inspected snapshots**

```bash
rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts tests/retro.spec.ts tests/settings-tabs.spec.ts tests/availability-slots.spec.ts tests/academy-visual-system.spec.ts --project=chromium --update-snapshots
```

Expected: PASS. Inspect screenshots for 390, 768, and 1,440 pixels in both themes; confirm no clipping, covered controls, nested-card regressions, metadata pills, or unlabeled rail icons.

Add this viewport coverage to `member-studio.spec.ts` before running the command:

```ts
for (const width of [390, 768, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`Studio reference at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.goto('/dev/me-preview');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page).toHaveScreenshot(`academy-studio-${theme}-${width}.png`, { fullPage: true, animations: 'disabled' });
    });
  }
}

test('Retro response remains reachable at 200 percent mobile zoom', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/me/retro');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  const response = page.getByRole('textbox');
  await response.focus();
  await response.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const bounds = await response.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport!;
    return {
      left: rect.left - viewport.offsetLeft,
      right: rect.right - viewport.offsetLeft,
      top: rect.top - viewport.offsetTop,
      bottom: rect.bottom - viewport.offsetTop,
      width: viewport.width,
      height: viewport.height,
    };
  });
  expect.soft(bounds.left).toBeGreaterThanOrEqual(0);
  expect.soft(bounds.right).toBeLessThanOrEqual(bounds.width);
  expect.soft(bounds.top).toBeGreaterThanOrEqual(0);
  expect.soft(bounds.bottom).toBeLessThanOrEqual(bounds.height);
});
```

The deterministic preview is the cross-width shell reference, but it does not replace route review. Add a second table-driven matrix in `member-studio.spec.ts` for Today, Calendar, Item Focus, Cohort, and open Retro at the same three widths and two themes. Reuse `mockStudioMember`; for Item Focus, open `How did it go?` before capture so the guided state is visible. Name the snapshots `academy-studio-{route}-{theme}-{width}.png`. Extend the existing Settings snapshot loop in `settings-tabs.spec.ts` from mobile-only to 390, 768, and 1,440 pixels for Profile, Appearance, and Availability. Capture reconnect and onboarding at 390 and 1,440 pixels in both themes after their behavior assertions pass.

The route matrix must use `page.emulateMedia({ reducedMotion: 'reduce' })`, hide the Next development portal, verify the selected theme on `html`, and assert `documentElement.scrollWidth <= innerWidth` on every route. Calendar keeps horizontal movement contained inside its explicit grid scroller rather than widening the document. At 200 percent zoom, use the dedicated Retro and Settings assertions instead of image comparison.

The existing Settings tests retain their separate 200 percent time-control coverage.

- [ ] **Step 6: Refresh the landing product image from the deterministic preview**

With the existing development server running on port 3000, run:

```bash
rtk proxy pnpm --filter @ics-select/web exec node scripts/capture-academy-product.mjs
```

Expected: `apps/web/public/landing/product-me-home.png` is regenerated from `/dev/me-preview`. Open the image and confirm it shows the Studio rail, current focus, workstream, and context rail without development chrome.

- [ ] **Step 7: Run complete repository verification**

```bash
rtk proxy pnpm --filter @ics-select/shared build
rtk proxy pnpm --filter @ics-select/web test:unit
rtk proxy pnpm --filter @ics-select/web typecheck
rtk proxy pnpm --filter @ics-select/web test
rtk proxy pnpm --filter @ics-select/web build
rtk proxy pnpm --filter @ics-select/web brand:audit
rtk git diff --check
```

Expected: shared build PASS, unit suite PASS, TypeScript PASS, complete Playwright suite PASS, production build PASS, brand audit PASS, and no whitespace errors.

- [ ] **Step 8: Commit the final Studio polish**

```bash
rtk git add "apps/web/app/(member)/me/onboarding/page.tsx" apps/web/components/member-shell apps/web/app/dev/me-preview/page.tsx apps/web/tests apps/web/public/landing/product-me-home.png
rtk git commit -m "feat(web): finish Academy Fellow Studio experience"
```

- [ ] **Step 9: Verify the committed branch is clean**

```bash
rtk git status --short --branch
rtk git log -10 --oneline --decorate
```

Expected: clean `feat/academy-fellow-visual` worktree with the Studio commits above the approved specification commit.
