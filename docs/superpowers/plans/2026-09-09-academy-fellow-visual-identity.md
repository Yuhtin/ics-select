# Academy Fellow Visual Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every user-facing ICS Select brand treatment with Academy Fellow and apply the approved Inteli Academy visual system to the public, member, admin, authentication, and branded learning surfaces without changing product behavior.

**Architecture:** Establish one semantic token and asset layer, migrate shared primitives and shells onto it, then restyle page families in dependency order. Keep the existing Next.js routes, React Query data flow, mutations, authentication, theme persistence, API contracts, calendar discriminator, and package names intact. Use Playwright reference pages and existing route tests to catch visual and behavioral regressions throughout the rollout.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3, HeroUI, next-themes, Framer Motion, Lucide, Playwright, Vitest, Figma MCP.

**Spec:** [`docs/superpowers/specs/2026-09-09-academy-fellow-visual-identity-design.md`](../specs/2026-09-09-academy-fellow-visual-identity-design.md)

## Global Constraints

- Run every shell command through `rtk` as required by `/Users/daviduarte/.codex/RTK.md`.
- Preserve the current dirty worktree. Before staging, inspect the exact paths named in the current task, and pass those same exact paths to `rtk git commit --only`.
- Do not rename `@ics-select/*`, the repository directory, the `ics-theme` local-storage key, API paths, route segments, database values, or `kind: 'ICS'`.
- Keep all queries, mutations, form payloads, validation rules, permission checks, and analytics behavior unchanged.
- Use the official IA artwork exported from the supplied Figma file. Do not redraw the monogram or invent partner imagery.
- Keep Academy blue as the only decorative accent. Green, amber, red, violet, and platform colors remain semantic.
- Keep Inter for product UI, Newsreader for selected editorial moments, and JetBrains Mono for compact metadata only.
- Remove the custom cursor, continuous decorative pulses, scroll hijacking, and raw `window` scroll listeners. Respect `prefers-reduced-motion` everywhere.
- Avoid visible em dashes, excessive pill containers, equal three-card marketing rows, improvised icons, and fake dashboard artwork.
- Do not update `README.md`, deleted historical plans/specs, stress-test files, diagrams, or the user-added reference images under `assets/` as part of these commits.

---

## Task 1: Establish the Academy foundation and official brand assets

**Files:**

- Create: `apps/web/public/brand/academy/ia-mark.svg`
- Create: `apps/web/public/brand/academy/academy-robot.webp`
- Create: `apps/web/public/brand/academy/academy-community.webp`
- Create: `apps/web/tests/academy-visual-system.spec.ts`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/components/shell/brand-lockup.tsx`
- Modify: `apps/web/app/dev/design-system/page.tsx`

- [ ] **Step 1: Read the Figma implementation rules and export the approved assets**

Read `skill://figma/figma-design-to-code/SKILL.md` before calling `get_design_context`. Use file key `jZFcepE7ZQJbaipCR2pYpO` and inspect nodes `9:2`, `66:115`, `9:55`, `9:56`, and `9:149`. Save the exact IA vector from the returned Figma asset data as `ia-mark.svg`, the isolated robot artwork as `academy-robot.webp`, and the community photograph as `academy-community.webp`.

Verify that the vector has a `viewBox`, the raster files are WebP, and no asset is an image embedded as base64 inside JSX:

```bash
rtk proxy file apps/web/public/brand/academy/ia-mark.svg apps/web/public/brand/academy/academy-robot.webp apps/web/public/brand/academy/academy-community.webp
rtk rg -n 'viewBox' apps/web/public/brand/academy/ia-mark.svg
```

Expected: one SVG with a `viewBox` and two WebP images.

- [ ] **Step 2: Add the first failing Academy identity test**

Create `apps/web/tests/academy-visual-system.spec.ts` with the brand assertion first:

```ts
import { expect, test } from '@playwright/test';

test.describe('Academy Fellow visual identity', () => {
  test('the design-system reference surface uses the Academy brand', async ({ page }) => {
    await page.goto('/dev/design-system');

    await expect(
      page.getByRole('heading', { name: 'Academy Fellow design system' }),
    ).toBeVisible();
    await expect(page.getByText('ICS Select', { exact: true })).toHaveCount(0);
  });
});
```

Run it and confirm it fails because the new heading does not exist yet:

```bash
rtk pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts
```

- [ ] **Step 3: Replace the global palette and typography variables**

In `apps/web/app/globals.css`, replace the old “Focus room” palette with the approved Academy equivalents. Keep the existing semantic outcome and platform tokens, but make the base tokens resolve to these colors:

```css
:root,
[data-theme='light'] {
  --bg: 60 8% 95%;
  --bg-subtle: 228 16% 94%;
  --surface: 60 14% 99%;
  --surface-strong: 231 14% 90%;
  --surface-hover: 228 16% 96%;
  --fg: 240 8% 10%;
  --fg-soft: 233 6% 29%;
  --fg-mute: 230 6% 43%;
  --fg-faint: 230 6% 58%;
  --border: 233 12% 87%;
  --border-strong: 230 11% 77%;
  --primary: 251 100% 50%;
  --primary-soft: 252 100% 95%;
  --primary-fg: 248 100% 98%;
}

[data-theme='dark'] {
  --bg: 240 8% 7%;
  --bg-subtle: 240 10% 10%;
  --surface: 240 9% 13%;
  --surface-strong: 240 9% 17%;
  --surface-hover: 240 9% 16%;
  --fg: 60 12% 95%;
  --fg-soft: 240 6% 81%;
  --fg-mute: 234 6% 65%;
  --fg-faint: 230 5% 49%;
  --border: 234 9% 21%;
  --border-strong: 234 7% 30%;
  --primary: 250 100% 64%;
  --primary-soft: 249 43% 22%;
  --primary-fg: 248 100% 98%;
}
```

Retain the legacy aliases only as mappings to these tokens. Remove landing-only animation helpers for the old split text, bouncing chip, cursor dot, status pulse, and slow-scroll behavior. Add a single reduced-motion rule that disables nonessential animation and smooth scrolling:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Move all three fonts to `next/font`**

In `apps/web/app/layout.tsx`, remove the Google stylesheet tags and instantiate the fonts through `next/font/google`:

```tsx
import { Inter, JetBrains_Mono, Newsreader } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});
```

Apply the variables to `<body>` and replace the metadata with:

```ts
export const metadata: Metadata = {
  title: 'Academy Fellow | Preparação para tech de elite | Inteli Academy',
  description:
    'Programa exclusivo que prepara os 12 melhores alunos do Inteli para Big Tech, consulting tech, competitive programming e startups top.',
  openGraph: {
    title: 'Academy Fellow | Preparação para tech de elite',
    description:
      'Programa exclusivo pra entrevistas técnicas em Big Tech, consulting tech, competitive programming e startups top.',
    type: 'website',
  },
};
```

- [ ] **Step 5: Align Tailwind and HeroUI with the same semantic layer**

In `apps/web/tailwind.config.ts`:

- add `surface-strong` to the semantic color map;
- point `font-sans`, `font-serif`, and `font-mono` to the `next/font` variables;
- set `card: 1rem`, `input: 0.625rem`, `tile: 1rem`, and `img: 0.75rem`;
- update HeroUI light/dark `background` and `foreground` to `#F3F3F1`/`#18181C` and `#111114`/`#F4F4F1`;
- keep the compatibility aliases, but do not add another hard-coded brand palette.

- [ ] **Step 6: Replace the improvised logo with one reusable lockup**

Keep the current `BrandLockup` call signature so existing callers keep compiling, add a `tone?: 'default' | 'inverse'` prop, render `/brand/academy/ia-mark.svg` without a rounded container, and render `Academy Fellow` as the wordmark. When `showWordmark` is false, include a screen-reader label:

```tsx
<div className={clsx('flex items-center', gaps[size], className)}>
  <Image
    src="/brand/academy/ia-mark.svg"
    alt=""
    width={56}
    height={56}
    className={clsx(markSizes[size], tone === 'inverse' && 'brightness-0 invert')}
    aria-hidden="true"
  />
  {showWordmark ? (
    <span className={clsx('font-semibold tracking-[-0.03em]', wordmarkSizes[size])}>
      Academy Fellow
    </span>
  ) : (
    <span className="sr-only">Academy Fellow</span>
  )}
</div>
```

- [ ] **Step 7: Turn the design-system route into the visual contract**

Update `apps/web/app/dev/design-system/page.tsx` to include the `Academy Fellow design system` heading, official lockup, light/dark token swatches, typography specimens, buttons, fields, status/outcome states, progress, tables, cards, and one compact editorial composition. Every component shown here must use production primitives rather than duplicate markup.

Run the brand assertion and typecheck:

```bash
rtk pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts
rtk pnpm --filter @ics-select/web typecheck
```

- [ ] **Step 8: Commit only the foundation paths**

```bash
rtk git diff -- apps/web/app/globals.css apps/web/app/layout.tsx apps/web/tailwind.config.ts apps/web/components/shell/brand-lockup.tsx apps/web/app/dev/design-system/page.tsx apps/web/tests/academy-visual-system.spec.ts apps/web/public/brand/academy/ia-mark.svg apps/web/public/brand/academy/academy-robot.webp apps/web/public/brand/academy/academy-community.webp
rtk git add apps/web/app/globals.css apps/web/app/layout.tsx apps/web/tailwind.config.ts apps/web/components/shell/brand-lockup.tsx apps/web/app/dev/design-system/page.tsx apps/web/tests/academy-visual-system.spec.ts apps/web/public/brand/academy/ia-mark.svg apps/web/public/brand/academy/academy-robot.webp apps/web/public/brand/academy/academy-community.webp
rtk git commit --only apps/web/app/globals.css apps/web/app/layout.tsx apps/web/tailwind.config.ts apps/web/components/shell/brand-lockup.tsx apps/web/app/dev/design-system/page.tsx apps/web/tests/academy-visual-system.spec.ts apps/web/public/brand/academy/ia-mark.svg apps/web/public/brand/academy/academy-robot.webp apps/web/public/brand/academy/academy-community.webp -m "feat(web): establish Academy Fellow visual foundation"
```

---

## Task 2: Migrate shared UI primitives

**Files:**

- Modify: `apps/web/components/ui/ai-assistant-card.tsx`
- Modify: `apps/web/components/ui/button.tsx`
- Modify: `apps/web/components/ui/card.tsx`
- Modify: `apps/web/components/ui/confirm-dialog.tsx`
- Modify: `apps/web/components/ui/data-table.tsx`
- Modify: `apps/web/components/ui/day-header.tsx`
- Modify: `apps/web/components/ui/eyebrow.tsx`
- Modify: `apps/web/components/ui/library-item-row.tsx`
- Modify: `apps/web/components/ui/list-row.tsx`
- Modify: `apps/web/components/ui/member-card.tsx`
- Modify: `apps/web/components/ui/outcome-dot.tsx`
- Modify: `apps/web/components/ui/outcome-picker.tsx`
- Modify: `apps/web/components/ui/pill.tsx`
- Modify: `apps/web/components/ui/progress-bar.tsx`
- Modify: `apps/web/components/ui/progress-ring.tsx`
- Modify: `apps/web/components/ui/section-label.tsx`
- Modify: `apps/web/components/ui/segmented-progress.tsx`
- Modify: `apps/web/components/ui/stat-card.tsx`
- Modify: `apps/web/components/ui/status-chip.tsx`
- Modify: `apps/web/components/ui/streak-card.tsx`
- Modify: `apps/web/components/ui/theme-toggle.tsx`
- Modify: `apps/web/app/dev/design-system/page.tsx`
- Modify: `apps/web/tests/academy-visual-system.spec.ts`

- [ ] **Step 1: Add light and dark visual coverage to the reference test**

Append a screenshot loop to `academy-visual-system.spec.ts`:

```ts
for (const theme of ['light', 'dark'] as const) {
  test(`design system is coherent in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(
      (selectedTheme) => localStorage.setItem('ics-theme', selectedTheme),
      theme,
    );
    await page.goto('/dev/design-system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page).toHaveScreenshot(`academy-design-system-${theme}.png`, {
      animations: 'disabled',
      fullPage: true,
    });
  });
}
```

Run once without snapshot updates. The new screenshot expectations should fail because no baseline exists:

```bash
rtk pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts
```

- [ ] **Step 2: Normalize controls and focus behavior**

Update `button.tsx`, `confirm-dialog.tsx`, `theme-toggle.tsx`, `outcome-picker.tsx`, and `pill.tsx` to use `primary`, `surface`, `border-token`, and `fg` tokens. Keep existing props and click behavior. Make primary buttons Academy blue, ghost buttons neutral with a 10px radius, and visible focus rings blue with a background-colored offset. Ensure touch-first controls are at least 44px high.

- [ ] **Step 3: Normalize surfaces and data containers**

Update `card.tsx`, `data-table.tsx`, `list-row.tsx`, `library-item-row.tsx`, `member-card.tsx`, `stat-card.tsx`, and `ai-assistant-card.tsx` to use the 16px panel radius, quiet borders, and token surfaces. Remove hard-coded white, slate, emerald, or violet decoration where it expresses hierarchy rather than a semantic state. Keep table overflow and existing slots unchanged.

- [ ] **Step 4: Normalize labels, progress, and state components**

Update `day-header.tsx`, `eyebrow.tsx`, `section-label.tsx`, `status-chip.tsx`, `outcome-dot.tsx`, `progress-bar.tsx`, `progress-ring.tsx`, `segmented-progress.tsx`, and `streak-card.tsx`. Use Inter for labels and headings, JetBrains Mono only for values/counts, blue for active/current, green for completed, and the existing outcome colors for outcome meaning.

- [ ] **Step 5: Review every primitive in the production harness**

Open `/dev/design-system` at 390px and 1440px in light and dark. Fix clipping, contrast, keyboard focus, and any accidental serif or mono body text. Then create the reviewed baselines:

```bash
rtk pnpm --filter @ics-select/web test:update -- tests/academy-visual-system.spec.ts
rtk pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts
rtk pnpm --filter @ics-select/web typecheck
```

- [ ] **Step 6: Commit the primitive migration**

Inspect and stage only the exact UI files listed in this task plus their new Playwright snapshots. Commit with:

```bash
rtk git commit --only apps/web/components/ui apps/web/app/dev/design-system/page.tsx apps/web/tests/academy-visual-system.spec.ts apps/web/tests/academy-visual-system.spec.ts-snapshots -m "feat(web): restyle shared UI for Academy Fellow"
```

---

## Task 3: Rebrand the member/admin shells and authentication

**Files:**

- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/components/member-shell/member-shell.tsx`
- Modify: `apps/web/components/member-shell/topbar-member.tsx`
- Modify: `apps/web/components/member-shell/bottom-tab-bar.tsx`
- Modify: `apps/web/components/member-shell/onboarding-gate.tsx`
- Modify: `apps/web/components/member-shell/google-reconnect-gate.tsx`
- Modify: `apps/web/components/admin-shell/admin-shell.tsx`
- Modify: `apps/web/components/admin-shell/topbar-admin.tsx`
- Modify: `apps/web/tests/academy-visual-system.spec.ts`
- Modify: `apps/web/tests/settings-tabs.spec.ts`
- Modify: `apps/web/tests/admin-cockpit.spec.ts`

- [ ] **Step 1: Add failing public and authenticated brand assertions**

Add this public login case to `academy-visual-system.spec.ts`:

```ts
test('login uses Academy Fellow branding', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');

  await expect(page.getByText('Academy Fellow', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /(?:entrar|continuar) com google/i }),
  ).toBeVisible();
  await expect(page.getByText(/ICS Select|Inteli Consulting Society/)).toHaveCount(0);
  await expect(page).toHaveScreenshot('academy-login-desktop.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
```

In the already-authenticated setup of `settings-tabs.spec.ts` and `admin-cockpit.spec.ts`, add:

```ts
await expect(page.getByText('Academy Fellow', { exact: true }).first()).toBeVisible();
await expect(page.getByText('ICS Select', { exact: true })).toHaveCount(0);
```

Run the three tests and confirm the old shell/login fail the new assertions:

```bash
rtk pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts tests/settings-tabs.spec.ts tests/admin-cockpit.spec.ts
```

- [ ] **Step 2: Rebrand the member shell without changing navigation**

Use `BrandLockup` in `topbar-member.tsx` and remove the hand-built ICS square. Keep Today, Calendar, Cohort, profile, retro, theme, logout, route-active logic, and mobile destinations unchanged. Style the current destination with Academy blue and use neutral borders/backgrounds for the shell.

In `member-shell.tsx` and `bottom-tab-bar.tsx`, preserve onboarding/reconnect gates and page-width behavior while applying the new spacing, background, active indicator, focus ring, and 44px mobile targets.

- [ ] **Step 3: Rebrand the admin shell without changing permissions**

Use the same `BrandLockup` in `topbar-admin.tsx`, followed by a small neutral `Admin` label. Keep Members, Cycles, Plans, Library, Waitlist, Meetings, Config, permission checks, and logout unchanged. Make the navigation horizontally scrollable or compact below its natural width instead of allowing it to wrap.

- [ ] **Step 4: Recompose login around the official Academy imagery**

Replace the improvised mark, dot texture, and gradient decoration in `login/page.tsx` with the official lockup and one responsive Academy image panel using `academy-community.webp` or `academy-robot.webp`. Keep Google sign-in, loading, query-param error handling, redirects, and announcements unchanged. Replace only the direct brand references in error copy:

```ts
inactive:
  'Sua participação no Academy Fellow foi encerrada. Se acha que é engano, fale com o diretor educacional.',
notInvited:
  'Sua conta ainda não foi convidada para o Academy Fellow. Peça ao diretor educacional para adicionar seu email.',
```

The private-platform footer should name `Academy Fellow`, and the primary action should use Academy blue.

- [ ] **Step 5: Update reconnect and onboarding brand references**

In `google-reconnect-gate.tsx`, change only the visible organization reference to “Academy Fellow” while preserving the reconnect flow. Restyle the gate and onboarding frame using the new shared surfaces and focus states.

- [ ] **Step 6: Verify shell behavior and approve the new snapshots**

Test desktop and mobile shell navigation, the theme toggle, login error query variants, and keyboard focus. Then update only the expected visual baselines:

```bash
rtk pnpm --filter @ics-select/web test:update -- tests/academy-visual-system.spec.ts tests/settings-tabs.spec.ts tests/admin-cockpit.spec.ts
rtk pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts tests/settings-tabs.spec.ts tests/admin-cockpit.spec.ts
rtk pnpm --filter @ics-select/web typecheck
```

- [ ] **Step 7: Commit the shell and login pass**

Stage the exact files and modified snapshots from this task, inspect the staged diff, and commit:

```bash
rtk git diff --cached -- apps/web/app/login/page.tsx apps/web/components/member-shell apps/web/components/admin-shell apps/web/tests
rtk git commit --only apps/web/app/login/page.tsx apps/web/components/member-shell apps/web/components/admin-shell apps/web/tests/academy-visual-system.spec.ts apps/web/tests/academy-visual-system.spec.ts-snapshots apps/web/tests/settings-tabs.spec.ts apps/web/tests/settings-tabs.spec.ts-snapshots apps/web/tests/admin-cockpit.spec.ts apps/web/tests/admin-cockpit.spec.ts-snapshots -m "feat(web): rebrand authentication and application shells"
```

---

## Task 4: Restyle every member surface and capture the real product image

**Files:**

- Modify: `apps/web/app/(member)/me/page.tsx`
- Modify: `apps/web/app/(member)/me/item/[id]/page.tsx`
- Modify: `apps/web/app/(member)/me/plan/page.tsx`
- Modify: `apps/web/app/(member)/me/calendar/page.tsx`
- Modify: `apps/web/app/(member)/me/cohort/page.tsx`
- Modify: `apps/web/app/(member)/me/retro/page.tsx`
- Modify: `apps/web/app/(member)/me/onboarding/page.tsx`
- Modify: `apps/web/app/(member)/me/settings/layout.tsx`
- Modify: `apps/web/app/(member)/me/settings/page.tsx`
- Modify: `apps/web/app/(member)/me/settings/profile/page.tsx`
- Modify: `apps/web/app/(member)/me/settings/appearance/page.tsx`
- Modify: `apps/web/app/(member)/me/settings/availability/page.tsx`
- Modify: `apps/web/components/member/carry-over-reflection-card.tsx`
- Modify: `apps/web/components/member/cohort-feed.tsx`
- Modify: `apps/web/components/member/cohort-roster.tsx`
- Modify: `apps/web/components/member/day-list.tsx`
- Modify: `apps/web/components/member/global-save-indicator.tsx`
- Modify: `apps/web/components/member/google-status-card.tsx`
- Modify: `apps/web/components/member/hero-scene.tsx`
- Modify: `apps/web/components/member/home-hero.tsx`
- Modify: `apps/web/components/member/item-focus.tsx`
- Modify: `apps/web/components/member/phase-progress-card.tsx`
- Modify: `apps/web/components/member/profile-fields.tsx`
- Modify: `apps/web/components/member/retro-form.tsx`
- Modify: `apps/web/components/member/retro-recap.tsx`
- Modify: `apps/web/components/member/settings-error-context.tsx`
- Modify: `apps/web/components/member/settings-nav.tsx`
- Modify: `apps/web/components/member/study-time-card.tsx`
- Modify: `apps/web/components/member/theme-picker.tsx`
- Modify: `apps/web/components/member/time-pill.tsx`
- Modify: `apps/web/components/member/top-ranking-card.tsx`
- Modify: `apps/web/components/member/topic-coverage-heatmap.tsx`
- Modify: `apps/web/components/member/track-picker.tsx`
- Modify: `apps/web/components/member/availability-grid.tsx`
- Modify: `apps/web/components/member/availability-presets.tsx`
- Modify: `apps/web/components/member/availability-slot-editor.tsx`
- Modify: `apps/web/components/member/availability-slot-presets.tsx`
- Modify: `apps/web/components/member/session-length-presets.tsx`
- Modify: `apps/web/components/member/phone-input.tsx`
- Modify: `apps/web/components/member/calendar/calendar-connect-banner.tsx`
- Modify: `apps/web/components/member/calendar/calendar-grid-skeleton.tsx`
- Modify: `apps/web/components/member/calendar/calendar-header.tsx`
- Modify: `apps/web/components/member/calendar/calendar-legend.tsx`
- Modify: `apps/web/components/member/calendar/calendar-sidebar.tsx`
- Modify: `apps/web/components/member/calendar/calendar-skeleton.tsx`
- Modify: `apps/web/components/member/calendar/event-card-external.tsx`
- Modify: `apps/web/components/member/calendar/event-card-ics.tsx`
- Modify: `apps/web/components/member/calendar/reschedule-modal.tsx`
- Modify: `apps/web/components/member/calendar/week-grid/index.tsx`
- Modify: `apps/web/app/dev/me-preview/page.tsx`
- Create: `apps/web/scripts/capture-academy-product.mjs`
- Modify: `apps/web/public/landing/product-me-home.png`
- Modify: `apps/web/tests/academy-visual-system.spec.ts`
- Modify: `apps/web/tests/availability-slots.spec.ts`
- Modify: `apps/web/tests/retro.spec.ts`
- Modify: `apps/web/tests/settings-tabs.spec.ts`

- [ ] **Step 1: Add representative member screenshots before restyling**

Add a stable `data-testid="academy-member-preview"` root to the static `/dev/me-preview` composition. Extend `academy-visual-system.spec.ts` with light and dark snapshots at 390px and 1440px:

```ts
for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1440]) {
    test(`member reference ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(
        (selectedTheme) => localStorage.setItem('ics-theme', selectedTheme),
        theme,
      );
      await page.goto('/dev/me-preview');
      await expect(page.getByTestId('academy-member-preview')).toBeVisible();
      await expect(page).toHaveScreenshot(`academy-member-${theme}-${width}.png`, {
        animations: 'disabled',
        fullPage: true,
      });
    });
  }
}
```

Run without `--update-snapshots` to establish the red visual checkpoint.

- [ ] **Step 2: Restyle home, day lists, and item focus**

Update the home route plus `hero-scene`, `home-hero`, `day-list`, `item-focus`, `time-pill`, and supporting cards. Make the current item dominant with a blue current indicator, quiet 16px surfaces, and green only for completion. Remove thick green borders and decorative serif from product body copy. Preserve item links, action handlers, progress calculations, outcomes, dates, and scheduling behavior.

- [ ] **Step 3: Restyle plan, cohort, and progress surfaces**

Update plan and cohort routes plus roster, feed, ranking, phase progress, streak, study time, and coverage components. Use shared baselines and spacing instead of nesting every metric in another card. Keep rankings, filters, query states, and empty states unchanged.

- [ ] **Step 4: Restyle retro, onboarding, and settings**

Apply the Academy system to retro, onboarding, settings navigation, profile, appearance, and availability. Keep every existing field name, autosave boundary, validation message, theme choice, Google status, and save indicator. Ensure disabled and error states pass contrast in both themes.

- [ ] **Step 5: Restyle the calendar and translate only its visible label**

Keep all `event.kind === 'ICS'` checks exactly as they are. Change visible copy such as “This week · 3 ICS” and “study events created by ICS” to Academy Fellow. Restyle the header, sidebar, legend, grid, skeletons, external events, Academy Fellow events, and reschedule modal with the approved tokens. Preserve layout math, drag/reschedule behavior, time calculations, and event semantics.

- [ ] **Step 6: Review real routes and accept member snapshots**

Run the member-focused route tests and reference snapshots:

```bash
rtk pnpm --filter @ics-select/web test:update -- tests/academy-visual-system.spec.ts tests/availability-slots.spec.ts tests/retro.spec.ts tests/settings-tabs.spec.ts
rtk pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts tests/availability-slots.spec.ts tests/retro.spec.ts tests/settings-tabs.spec.ts
rtk pnpm --filter @ics-select/web typecheck
```

Visually inspect `/me`, `/me/item/:id`, `/me/calendar`, `/me/plan`, `/me/cohort`, `/me/retro`, onboarding, and all settings tabs in both themes. Check loading, empty, failure, and reconnect states wherever the existing mocks expose them.

- [ ] **Step 7: Capture the updated member-home image for the landing**

Create `apps/web/scripts/capture-academy-product.mjs` as a small Playwright script that opens `http://127.0.0.1:3000/dev/me-preview`, emulates reduced motion, uses a 1440×1050 viewport, and writes the `academy-member-preview` element to `public/landing/product-me-home.png`:

```js
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({
  colorScheme: 'light',
  reducedMotion: 'reduce',
  viewport: { width: 1440, height: 1050 },
});

await page.goto('http://127.0.0.1:3000/dev/me-preview');
await page.getByTestId('academy-member-preview').screenshot({
  animations: 'disabled',
  path: 'public/landing/product-me-home.png',
});
await browser.close();
```

Run the Next dev server in one terminal and the capture in another:

```bash
rtk pnpm --filter @ics-select/web dev
rtk pnpm --filter @ics-select/web exec node scripts/capture-academy-product.mjs
rtk proxy file apps/web/public/landing/product-me-home.png
```

- [ ] **Step 8: Commit only member-surface paths**

Inspect all files listed in this task, stage only those files and their relevant snapshots, then commit:

```bash
rtk git commit --only 'apps/web/app/(member)/me' apps/web/components/member apps/web/app/dev/me-preview/page.tsx apps/web/scripts/capture-academy-product.mjs apps/web/public/landing/product-me-home.png apps/web/tests/academy-visual-system.spec.ts apps/web/tests/academy-visual-system.spec.ts-snapshots apps/web/tests/availability-slots.spec.ts apps/web/tests/availability-slots.spec.ts-snapshots apps/web/tests/retro.spec.ts apps/web/tests/retro.spec.ts-snapshots apps/web/tests/settings-tabs.spec.ts apps/web/tests/settings-tabs.spec.ts-snapshots -m "feat(web): apply Academy identity to member experience"
```

---

## Task 5: Restyle admin navigation and operational pages

**Files:**

- Modify: `apps/web/app/(admin)/admin/page.tsx`
- Modify: `apps/web/app/(admin)/admin/members/page.tsx`
- Modify: `apps/web/app/(admin)/admin/cycles/page.tsx`
- Modify: `apps/web/app/(admin)/admin/cycle/active/page.tsx`
- Modify: `apps/web/app/(admin)/admin/cycle/[id]/page.tsx`
- Modify: `apps/web/app/(admin)/admin/plans/page.tsx`
- Modify: `apps/web/app/(admin)/admin/library/page.tsx`
- Modify: `apps/web/app/(admin)/admin/waitlist/page.tsx`
- Modify: `apps/web/app/(admin)/admin/meetings/page.tsx`
- Modify: `apps/web/app/(admin)/admin/meetings/[slug]/page.tsx`
- Modify: `apps/web/app/(admin)/admin/config/page.tsx`
- Modify: `apps/web/app/(admin)/admin/ai-usage/page.tsx`
- Modify: `apps/web/components/admin/cohort-heatmap.tsx`
- Modify: `apps/web/components/admin/cohort-strip.tsx`
- Modify: `apps/web/components/admin/cohort-knowledge-grid.tsx`
- Modify: `apps/web/components/admin/cycle-members-grid.tsx`
- Modify: `apps/web/components/admin/engagement-ranking-table.tsx`
- Modify: `apps/web/components/admin/invites-section.tsx`
- Modify: `apps/web/components/admin/ranking-toggle.tsx`
- Modify: `apps/web/components/admin/stat-card.tsx`
- Modify: `apps/web/components/admin/triage-alert-row.tsx`
- Modify: `apps/web/components/admin/cycle/cycle-overview-view.tsx`
- Modify: `apps/web/components/admin/cycle/manage-roster-modal.tsx`
- Modify: `apps/web/components/admin/cycles/attendance-modal.tsx`
- Modify: `apps/web/components/admin/cycles/classes-section.tsx`
- Modify: `apps/web/components/admin/cycles/new-cycle-modal.tsx`
- Modify: `apps/web/components/admin/cycles/schedule-class-modal.tsx`
- Modify: `apps/web/components/admin/library/item-form-modal.tsx`
- Modify: `apps/web/components/admin/library/multi-filter-combobox.tsx`
- Modify: `apps/web/components/admin/library/pagination.tsx`
- Modify: `apps/web/components/admin/library/topic-combobox.tsx`
- Modify: `apps/web/components/admin/library/topics-modal.tsx`
- Modify: `apps/web/components/admin/waitlist/waitlist-export-button.tsx`
- Modify: `apps/web/components/admin/waitlist/waitlist-filters.tsx`
- Modify: `apps/web/components/admin/waitlist/waitlist-home-card.tsx`
- Modify: `apps/web/components/admin/waitlist/waitlist-stats.tsx`
- Modify: `apps/web/components/admin/waitlist/waitlist-table.tsx`
- Modify: `apps/web/components/admin/config/whatsapp-templates-tab.tsx`
- Modify: `apps/web/components/admin/meetings/glossary-panel.tsx`
- Modify: `apps/web/components/admin/meetings/glossarized.tsx`
- Modify: `apps/web/components/admin/meetings/lesson-view.tsx`
- Modify: `apps/web/components/admin/meetings/live-mode.tsx`
- Modify: `apps/web/components/admin/meetings/meetings-list.tsx`
- Modify: `apps/web/components/admin/meetings/print-view.tsx`
- Modify: `apps/web/components/admin/meetings/study-mode.tsx`
- Modify: `apps/web/tests/admin-cockpit.spec.ts`

- [ ] **Step 1: Add a representative admin overview snapshot**

Extend the existing authenticated admin fixture in `admin-cockpit.spec.ts` with a 1440px full-page screenshot of the admin overview or members list. Assert that the Academy Fellow lockup is present and that dense navigation remains on one row.

Run the spec once and confirm the snapshot fails before the page pass:

```bash
rtk pnpm --filter @ics-select/web test -- tests/admin-cockpit.spec.ts
```

- [ ] **Step 2: Restyle overview, members, cycles, and plans**

Apply the shared surfaces to stat blocks, triage rows, cohort strips, heatmaps, member grids, rankings, invitations, cycle overview, classes, and roster/attendance/scheduling dialogs. Keep row density high, body copy sans-serif, and IDs/counts/times monospaced. Preserve all filters, paging, modal state, links, mutations, and chart data.

- [ ] **Step 3: Restyle library and waitlist**

Apply the Academy tokens to the library list, form modal, topic and multifilter controls, pagination, waitlist cards, filters, stats, export button, and table. Preserve search, selected filters, import/export, form fields, validation, and row actions.

- [ ] **Step 4: Restyle meetings, configuration, and AI usage**

Update meeting list/detail chrome, glossary, live/study modes, print view, configuration tabs, and AI usage. Do not rewrite lesson bodies or lesson data in this task. Keep print surfaces light and independent from the active theme. Use serif only for a cover or narrative title, never dense table or tool UI.

- [ ] **Step 5: Inspect responsive density and dialogs**

At 768px and 1440px, check that admin navigation does not wrap, tables remain horizontally accessible, filters remain operable, and modal focus/scroll behavior is unchanged. In dark mode, check chart axes, grids, series, tooltips, borders, disabled controls, and overlays.

- [ ] **Step 6: Verify and commit the operational pass**

```bash
rtk pnpm --filter @ics-select/web test:update -- tests/admin-cockpit.spec.ts
rtk pnpm --filter @ics-select/web test -- tests/admin-cockpit.spec.ts
rtk pnpm --filter @ics-select/web typecheck
rtk git commit --only 'apps/web/app/(admin)/admin/page.tsx' 'apps/web/app/(admin)/admin/members/page.tsx' 'apps/web/app/(admin)/admin/cycles/page.tsx' 'apps/web/app/(admin)/admin/cycle/active/page.tsx' 'apps/web/app/(admin)/admin/cycle/[id]/page.tsx' 'apps/web/app/(admin)/admin/plans/page.tsx' 'apps/web/app/(admin)/admin/library/page.tsx' 'apps/web/app/(admin)/admin/waitlist/page.tsx' 'apps/web/app/(admin)/admin/meetings/page.tsx' 'apps/web/app/(admin)/admin/meetings/[slug]/page.tsx' 'apps/web/app/(admin)/admin/config/page.tsx' 'apps/web/app/(admin)/admin/ai-usage/page.tsx' apps/web/components/admin/cohort-heatmap.tsx apps/web/components/admin/cohort-strip.tsx apps/web/components/admin/cohort-knowledge-grid.tsx apps/web/components/admin/cycle-members-grid.tsx apps/web/components/admin/engagement-ranking-table.tsx apps/web/components/admin/invites-section.tsx apps/web/components/admin/ranking-toggle.tsx apps/web/components/admin/stat-card.tsx apps/web/components/admin/triage-alert-row.tsx apps/web/components/admin/cycle apps/web/components/admin/cycles apps/web/components/admin/library apps/web/components/admin/waitlist apps/web/components/admin/config apps/web/components/admin/meetings apps/web/tests/admin-cockpit.spec.ts apps/web/tests/admin-cockpit.spec.ts-snapshots -m "feat(web): restyle Academy Fellow admin operations"
```

Before committing, exclude the member-detail, member-cockpit, plan-editor, and receipt subdirectories reserved for Task 6 from the staged diff.

---

## Task 6: Restyle dense admin detail, plan editor, and receipt flows

**Files:**

- Modify: `apps/web/app/(admin)/admin/member/[id]/page.tsx`
- Modify: `apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx`
- Modify: `apps/web/app/(admin)/admin/cycle/[id]/receipt/page.tsx`
- Modify: `apps/web/app/(admin)/admin/cycle/[id]/receipt/receipt-client.tsx`
- Modify: `apps/web/components/admin/member-cockpit/behavior-strip.tsx`
- Modify: `apps/web/components/admin/member-cockpit/class-attendance-card.tsx`
- Modify: `apps/web/components/admin/member-cockpit/engagement-card.tsx`
- Modify: `apps/web/components/admin/member-cockpit/items-completed-card.tsx`
- Modify: `apps/web/components/admin/member-cockpit/kpi-cell.tsx`
- Modify: `apps/web/components/admin/member-cockpit/latest-activity-card.tsx`
- Modify: `apps/web/components/admin/member-cockpit/mocks-card.tsx`
- Modify: `apps/web/components/admin/member-cockpit/raw-data-accordion.tsx`
- Modify: `apps/web/components/admin/member-cockpit/risk-banner.tsx`
- Modify: `apps/web/components/admin/member-cockpit/session-pattern-card.tsx`
- Modify: `apps/web/components/admin/member-cockpit/time-invested-card.tsx`
- Modify: `apps/web/components/admin/member-cockpit/topic-engagement-table.tsx`
- Modify: `apps/web/components/admin/member-detail/attendance-tab.tsx`
- Modify: `apps/web/components/admin/member-detail/diagnose-tab.tsx`
- Modify: `apps/web/components/admin/member-detail/mocks-tab.tsx`
- Modify: `apps/web/components/admin/member-detail/notes-tab.tsx`
- Modify: `apps/web/components/admin/member-detail/phase-summary-strip.tsx`
- Modify: `apps/web/components/admin/member-detail/plan-week-modal.tsx`
- Modify: `apps/web/components/admin/member-detail/retros-tab.tsx`
- Modify: `apps/web/components/admin/member-detail/timeline-tab.tsx`
- Modify: `apps/web/components/admin/member-detail/topic-coverage-matrix.tsx`
- Modify: `apps/web/components/admin/plan-editor/ai-suggest-drawer.tsx`
- Modify: `apps/web/components/admin/plan-editor/budget-badge.tsx`
- Modify: `apps/web/components/admin/plan-editor/carry-over-list.tsx`
- Modify: `apps/web/components/admin/plan-editor/context-sidebar.tsx`
- Modify: `apps/web/components/admin/plan-editor/editable-plan-panel.tsx`
- Modify: `apps/web/components/admin/plan-editor/item-card.tsx`
- Modify: `apps/web/components/admin/plan-editor/library-picker-modal.tsx`
- Modify: `apps/web/components/admin/plan-editor/publish-modal.tsx`
- Modify: `apps/web/components/admin/plan-editor/scheduling-modal.tsx`
- Modify: `apps/web/components/admin/plan-editor/unscheduled-section.tsx`
- Modify: `apps/web/components/admin/plan-editor/week-day-card.tsx`
- Modify: `apps/web/components/admin/plan-editor/week-preview.tsx`
- Modify: `apps/web/components/admin/receipt/receipt-toolbar.tsx`
- Modify: `apps/web/components/admin/receipt/thermal-bar.tsx`
- Modify: `apps/web/components/admin/receipt/thermal-paper.tsx`
- Modify: `apps/web/components/admin/receipt/thermal-receipt-view.tsx`
- Modify: `apps/web/components/admin/receipt/thermal-row.tsx`
- Modify: `apps/web/components/admin/receipt/wrapped-block.tsx`
- Modify: `apps/web/components/admin/receipt/wrapped-view.tsx`
- Modify: `apps/web/tests/admin-cockpit.spec.ts`
- Modify: `apps/web/tests/admin-plan-editor.spec.ts`
- Modify: `apps/web/tests/cycle-receipt.spec.ts`

- [ ] **Step 1: Preserve the current risk-state coverage**

Keep the existing AT_RISK, WATCH, and ON_TRACK fixtures in `admin-cockpit.spec.ts`. Add direct assertions that each risk banner has text plus a non-color signal. Run the existing cockpit, plan editor, and receipt tests before editing to record their current result:

```bash
rtk pnpm --filter @ics-select/web test -- tests/admin-cockpit.spec.ts tests/admin-plan-editor.spec.ts tests/cycle-receipt.spec.ts
```

- [ ] **Step 2: Restyle member cockpit and detail tabs**

Use neutral surfaces and compact blue selection states across KPI cells, behavior strip, risk banner, engagement, attendance, activity, time, mocks, raw data, topic tables, summaries, tabs, and modals. Keep the risk palette semantic, preserve every calculated value, and keep all existing tab/query behavior.

- [ ] **Step 3: Restyle the plan editor as a dense tool**

Apply the same tokens to the context sidebar, editable panel, week preview, day cards, item cards, unscheduled/carry-over sections, budget state, library picker, publish/scheduling modals, and AI drawer. Keep drag/drop, scheduling, validation, publish, budget, and AI suggestion behavior unchanged. Remove decorative serif and large empty areas from tool regions.

- [ ] **Step 4: Rebrand and restyle receipts**

Replace visible `ICS · SELECT` with `ACADEMY · FELLOW`. Keep thermal and wrapped calculations, export, date/value formatting, and printable dimensions unchanged. Thermal/print views remain light even when the application is dark; interactive receipt chrome may follow the active theme.

- [ ] **Step 5: Review screenshots at all existing fixture states**

Update only after manual inspection of AT_RISK, WATCH, ON_TRACK, plan editor open/closed dialogs, receipt wrapped/thermal modes, and print rendering:

```bash
rtk pnpm --filter @ics-select/web test:update -- tests/admin-cockpit.spec.ts tests/admin-plan-editor.spec.ts tests/cycle-receipt.spec.ts
rtk pnpm --filter @ics-select/web test -- tests/admin-cockpit.spec.ts tests/admin-plan-editor.spec.ts tests/cycle-receipt.spec.ts
rtk pnpm --filter @ics-select/web typecheck
```

- [ ] **Step 6: Commit only dense admin paths**

```bash
rtk git commit --only 'apps/web/app/(admin)/admin/member/[id]/page.tsx' 'apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx' 'apps/web/app/(admin)/admin/cycle/[id]/receipt/page.tsx' 'apps/web/app/(admin)/admin/cycle/[id]/receipt/receipt-client.tsx' apps/web/components/admin/member-cockpit apps/web/components/admin/member-detail apps/web/components/admin/plan-editor apps/web/components/admin/receipt apps/web/tests/admin-cockpit.spec.ts apps/web/tests/admin-cockpit.spec.ts-snapshots apps/web/tests/admin-plan-editor.spec.ts apps/web/tests/admin-plan-editor.spec.ts-snapshots apps/web/tests/cycle-receipt.spec.ts apps/web/tests/cycle-receipt.spec.ts-snapshots -m "feat(web): restyle Academy Fellow admin detail flows"
```

---

## Task 7: Recompose the landing page in the Academy editorial direction

**Files:**

- Modify: `apps/web/components/landing/landing-page.tsx`
- Modify: `apps/web/components/landing/landing-topbar.tsx`
- Modify: `apps/web/components/landing/landing-hero.tsx`
- Modify: `apps/web/components/landing/landing-pillars.tsx`
- Modify: `apps/web/components/landing/landing-bigtechs.tsx`
- Modify: `apps/web/components/landing/landing-product.tsx`
- Modify: `apps/web/components/landing/landing-closing-cta.tsx`
- Modify: `apps/web/components/landing/waitlist-modal.tsx`
- Modify: `apps/web/components/landing/landing-footer.tsx`
- Modify: `apps/web/components/landing/reveal.tsx`
- Delete: `apps/web/components/landing/landing-fx.tsx`
- Delete: `apps/web/components/landing/use-slow-scroll.ts`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/tests/academy-visual-system.spec.ts`

- [ ] **Step 1: Add the landing behavior and visual checks**

Append tests that preserve brand, anchors, live cohort/waitlist behavior, and responsive composition:

```ts
for (const width of [390, 768, 1440]) {
  test(`landing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.getByText('Academy Fellow', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /sou fellow/i })).toBeVisible();
    await expect(page.locator('#como-funciona')).toBeVisible();
    await expect(page.locator('#cohorts')).toBeVisible();
    await expect(page.getByText(/ICS Select|Inteli Consulting Society/)).toHaveCount(0);
    await expect(page).toHaveScreenshot(`academy-landing-${width}.png`, {
      animations: 'disabled',
      fullPage: true,
    });
  });
}
```

Retain or add the current waitlist mocks so opening the dialog still exercises its existing steps and submission payload. Run without snapshot updates and confirm the current landing fails the new brand assertions.

- [ ] **Step 2: Rebuild navigation and hero**

Use `BrandLockup`, keep existing anchor destinations, change `Sou membro` to `Sou fellow`, and keep the desktop row between 64px and 72px. Replace the raw scroll listener with an `IntersectionObserver` on a small top sentinel, or make the header styling static if the sentinel does not improve hierarchy.

Recompose the hero as a two-column asymmetric layout: value proposition and cycle action on the left; official community photo, blue field, and robot artwork on the right. Keep the existing proposition, metrics, and CTA behavior. Limit the desktop headline to two lines and use Newsreader only for the Academy emphasis.

- [ ] **Step 3: Rebuild pillars and company proof**

Keep all three existing pillars and content, but present them as a 7/5 editorial grid with one wide lead story and two smaller stacked modules. Use real product fragments or screenshots. At mobile, follow one strict reading column.

Keep the existing company set and real logos in a logo-only proof band. Remove city labels, hover glows, and invented logo treatments; preserve accessible names through image alt text.

- [ ] **Step 4: Rebuild product, cohort, conversion, and footer sections**

Use the regenerated `product-me-home.png` at a larger scale with explicit dimensions and responsive `sizes`. Present the three explanation points as a numbered editorial list, visually distinct from the pillars. Preserve `/public/cohort`, roster rendering, cycle messaging, waitlist configuration, modal fields, validation, submission, focus behavior, and success/failure states.

Replace the footer attribution with Academy Fellow and Inteli Academy while keeping the existing author link.

- [ ] **Step 5: Remove obsolete effects and tune reduced motion**

Remove `LandingFx`, the custom cursor, slow-scroll hook, chip bounce, decorative pulses, and unused CSS. Keep only one-time section reveals with a small opacity/translate transition. In `Reveal`, initialize content visibly when reduced motion is enabled and avoid any animation loop.

- [ ] **Step 6: Review initial viewport, content flow, and waitlist**

At 390px, 768px, and 1440px, inspect headline wrapping, nav crowding, CTA visibility, image cropping, section rhythm, one-column order, company logo legibility, and footer. Test keyboard-only dialog use and the full waitlist flow. Confirm no horizontal scroll and no hidden content when reduced motion is active.

- [ ] **Step 7: Accept landing snapshots and verify**

```bash
rtk pnpm --filter @ics-select/web test:update -- tests/academy-visual-system.spec.ts
rtk pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts
rtk pnpm --filter @ics-select/web typecheck
```

- [ ] **Step 8: Commit the landing composition**

```bash
rtk git commit --only apps/web/components/landing apps/web/app/globals.css apps/web/tests/academy-visual-system.spec.ts apps/web/tests/academy-visual-system.spec.ts-snapshots -m "feat(web): rebuild landing for Academy Fellow"
```

---

## Task 8: Complete the static brand pass and full verification

**Files:**

- Modify: `apps/web/public/slides/mapa-tempo-real.html`
- Modify: `apps/web/public/slides/ledger-financeiro.html`
- Modify: `apps/web/public/slides/vocabulario-ia.html`
- Modify: `apps/web/public/slides/motorista-mais-perto.html`
- Modify: `apps/web/components/admin/meetings/lessons/vocabulario-ia.ts`
- Modify: `apps/web/public/labs/minecraft-event-driven/pom.xml`
- Modify: `apps/web/public/labs/minecraft-event-driven/analytics-plugin/src/main/resources/plugin.yml`
- Modify: `apps/web/public/labs/minecraft-event-driven/bad-plugin/src/main/resources/plugin.yml`
- Modify: `apps/web/public/labs/minecraft-event-driven/chat-plugin/pom.xml`
- Modify: `apps/web/public/labs/minecraft-event-driven/chat-plugin/src/main/resources/plugin.yml`
- Modify: `apps/web/public/labs/minecraft-event-driven/essentials-plugin/src/main/resources/plugin.yml`
- Modify: `apps/web/public/labs/minecraft-event-driven/opauth-plugin/src/main/resources/plugin.yml`
- Modify: `apps/web/public/labs/minecraft-event-driven/packetspy-plugin/src/main/resources/plugin.yml`
- Modify: `apps/web/public/labs/minecraft-event-driven/pin-plugin/src/main/resources/plugin.yml`
- Modify: `apps/web/public/labs/minecraft-event-driven/scoreboard-plugin/src/main/resources/plugin.yml`
- Modify: `apps/web/public/labs/minecraft-event-driven/sudo-plugin/src/main/resources/plugin.yml`
- Modify: `apps/web/public/labs/minecraft-event-driven/welcome-plugin/src/main/resources/plugin.yml`
- Create: `apps/web/scripts/audit-academy-brand.mjs`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add an automated old-brand attribution audit**

Create `apps/web/scripts/audit-academy-brand.mjs` with the complete deterministic scanner below:

```js
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const roots = ['app', 'components', 'public/slides'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.css']);
const oldBrand = /ICS Select|Inteli Consulting Society|ICS · SELECT/g;
const findings = [];

async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const absolutePath = join(path, entry.name);
    if (entry.isDirectory()) {
      await scan(absolutePath);
      continue;
    }
    if (!extensions.has(extname(entry.name))) continue;

    const lines = (await readFile(absolutePath, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      oldBrand.lastIndex = 0;
      if (oldBrand.test(line)) {
        findings.push(`${relative('.', absolutePath)}:${index + 1}:${line.trim()}`);
      }
    });
  }
}

for (const root of roots) await scan(root);

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
```

Add this script to `apps/web/package.json`:

```json
"brand:audit": "node scripts/audit-academy-brand.mjs"
```

Run it and confirm it fails while legacy attributions remain:

```bash
rtk pnpm --filter @ics-select/web brand:audit
```

- [ ] **Step 2: Rebrand visible slide and lesson attribution**

Replace the old product/organization name in slide titles, cover eyebrows, headers, footers, accessible labels, and authored attribution with Academy Fellow and Inteli Academy. In `vocabulario-ia.ts`, change visible example roles that use ICS as the organization name to Academy Fellow. Preserve code identifiers such as ticket IDs when they are lesson examples.

- [ ] **Step 3: Rebrand attribution metadata in distributed lab files**

Change pure metadata such as `author: ICS Select`, human-readable POM descriptions, and branded lab descriptions to Academy Fellow. Leave Java package names like `com.ics.lab`, class names, command formats, code-output examples, and identifiers unchanged because they are technical teaching artifacts covered by the spec exclusion.

- [ ] **Step 4: Audit every remaining ICS occurrence manually**

Run both the strict brand audit and the broader occurrence search:

```bash
rtk pnpm --filter @ics-select/web brand:audit
rtk rg -n --hidden -S 'ICS Select|Inteli Consulting Society|ICS · SELECT|\bICS\b|ics-select' apps/web --glob '!**/*.map' --glob '!**/node_modules/**'
```

Expected broad-search survivors are limited to:

- the `@ics-select/*` package scope and imports;
- the `ics-theme` persistence key;
- calendar values and comparisons for `kind: 'ICS'`;
- database/migration/history values;
- authored source-code examples whose identity would change if renamed.

Any visible application copy found by this search must be changed to Academy Fellow.

- [ ] **Step 5: Run the complete automated verification suite**

```bash
rtk pnpm --filter @ics-select/web typecheck
rtk pnpm --filter @ics-select/web test:unit
rtk pnpm --filter @ics-select/web test
rtk pnpm --filter @ics-select/web build
rtk pnpm --filter @ics-select/web brand:audit
```

Do not update snapshots to make a failure disappear during this step. Investigate any unexpected diff against the approved spec and the reviewed per-task baselines.

- [ ] **Step 6: Complete the final visual matrix**

Capture and inspect the landing, login, member home/item/calendar/plan/cohort/retro/onboarding/settings, admin overview/members/cycles/plans/library/waitlist/meetings/config/AI usage/member detail/plan editor/receipt, and `/dev/design-system` at the specified breakpoints. Authenticated routes require light and dark review. Verify 200 percent zoom, keyboard focus, reduced motion, image loading, print receipt rendering, and absence of horizontal overflow.

- [ ] **Step 7: Inspect final scope and commit the static pass**

```bash
rtk git diff --stat
rtk git diff -- apps/web/public/slides apps/web/public/labs/minecraft-event-driven apps/web/components/admin/meetings/lessons/vocabulario-ia.ts apps/web/scripts/audit-academy-brand.mjs apps/web/package.json
rtk git commit --only apps/web/public/slides/mapa-tempo-real.html apps/web/public/slides/ledger-financeiro.html apps/web/public/slides/vocabulario-ia.html apps/web/public/slides/motorista-mais-perto.html apps/web/components/admin/meetings/lessons/vocabulario-ia.ts apps/web/public/labs/minecraft-event-driven/pom.xml apps/web/public/labs/minecraft-event-driven/analytics-plugin/src/main/resources/plugin.yml apps/web/public/labs/minecraft-event-driven/bad-plugin/src/main/resources/plugin.yml apps/web/public/labs/minecraft-event-driven/chat-plugin/pom.xml apps/web/public/labs/minecraft-event-driven/chat-plugin/src/main/resources/plugin.yml apps/web/public/labs/minecraft-event-driven/essentials-plugin/src/main/resources/plugin.yml apps/web/public/labs/minecraft-event-driven/opauth-plugin/src/main/resources/plugin.yml apps/web/public/labs/minecraft-event-driven/packetspy-plugin/src/main/resources/plugin.yml apps/web/public/labs/minecraft-event-driven/pin-plugin/src/main/resources/plugin.yml apps/web/public/labs/minecraft-event-driven/scoreboard-plugin/src/main/resources/plugin.yml apps/web/public/labs/minecraft-event-driven/sudo-plugin/src/main/resources/plugin.yml apps/web/public/labs/minecraft-event-driven/welcome-plugin/src/main/resources/plugin.yml apps/web/scripts/audit-academy-brand.mjs apps/web/package.json -m "chore(web): finish Academy Fellow brand migration"
```

Confirm that no unrelated deleted docs, stress-test files, diagrams, root README edits, workflow edits, or `assets/` references enter the commit.
