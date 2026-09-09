# Task 4 — Cohort roster and activity composition

## Status

Implemented and verified. The Cohort route now uses the shared Studio header and context rail, keeps the roster before activity on mobile, and presents both lists as open rows with dividers. Ranking order, avatars, scores, feed content, privacy behavior, query contract, and component props remain unchanged.

## RED / GREEN

- RED: added `Cohort separates roster and activity without a card grid` with a two-member ranked cohort and activity fixture.
- Command: `rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium -g "Cohort separates"`
- Result: expected failure, 1 failed, because `data-testid="cohort-roster"` did not exist in the card-based implementation.
- GREEN: recomposed the route and flattened roster/feed rows without changing `CohortRoster({ members, ranking })` or `CohortFeed({ feed, className })`.
- Result: 1 passed. The same test was then extended to verify roster-before-activity order and no horizontal overflow at 390 px; 1 passed.

## Files changed

- `apps/web/app/(member)/me/cohort/page.tsx`
- `apps/web/components/member/cohort-roster.tsx`
- `apps/web/components/member/cohort-feed.tsx`
- `apps/web/tests/member-studio.spec.ts`
- `apps/web/tests/academy-visual-system.spec.ts`
- `apps/web/tests/academy-visual-system.spec.ts-snapshots/academy-cohort-route-light-chromium-darwin.png`
- `apps/web/tests/academy-visual-system.spec.ts-snapshots/academy-cohort-route-dark-chromium-darwin.png`

## Verification

- Baseline: `rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium` — 9 passed.
- Required visual/state slice with snapshot update: `rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts tests/academy-visual-system.spec.ts --project=chromium -g "Cohort|member (routes|empty)" --update-snapshots` — 8 passed.
- Final Studio suite: `rtk proxy pnpm --filter @ics-select/web test -- tests/member-studio.spec.ts --project=chromium` — 10 passed.
- Cohort empty/failure states: `rtk proxy pnpm --filter @ics-select/web test -- tests/academy-visual-system.spec.ts --project=chromium -g "member empty"` — 2 passed after allowing the existing sequential retry scenarios 60 seconds instead of 30.
- Typecheck: `rtk proxy pnpm --filter @ics-select/web typecheck` — passed, exit 0.
- Whitespace/error check: `rtk git diff --check` — passed.

## Visual inspection

Inspected both retained Cohort snapshots at original resolution.

- Light: header hierarchy, open roster, one-pixel context divider, three-pixel current-member rule, soft selection fill, scores, and activity row are aligned with no clipping or overlap.
- Dark: the same hierarchy and spacing remain legible; primary color appears only on selected navigation and the current-member treatment within the Cohort content.
- At 390 px, the browser assertion confirms the roster finishes before the activity section begins and `scrollWidth` does not exceed the viewport.
- The prescribed regex also regenerated Item and Calendar images. Those files are outside Task 4 and were restored exactly to `HEAD`; only the two Cohort snapshots were retained.

## Self-review

- `StudioPageHeader` and `StudioContextRail` are consumed without API changes.
- Loading keeps `Loading…`; request failure renders `Could not load your cohort.` as a plain status section, with a dedicated regression assertion.
- The member row remains ordered by the server ranking, retains avatar and score behavior, and does not expose email.
- The no-ranking alphabetical fallback and empty fallback logic remain intact.
- Metadata uses plain text; no new pill treatment or package was added.
- All changed list rows use whitespace and dividers; the current member alone receives the primary selection treatment.

## Concerns

- The environment runs Node `v24.1.0` while the workspace declares `>=20 <21`; pnpm emits a warning, but focused tests and typecheck pass.
- A visual run without snapshot updates stops on pre-existing/out-of-scope Item and Calendar baseline differences before reaching the Cohort screenshot. The required update run completed 8/8, and the retained Cohort images were inspected directly.
- `CohortFeed` is also used by the admin cycle overview, so its requested divider rhythm appears there too; data, semantics, and public props are unchanged.
