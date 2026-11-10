# Opportunities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an "Opportunities" board where admins and active-cycle members post opportunities, members flag interest (avatars visible), and admins see interests on the member detail page.

**Architecture:** Two new Prisma tables (`Opportunity`, `OpportunityInterest`) via an additive migration. One NestJS module `opportunities` serves both members and admins with inline ownership checks. Open/closed is computed in a shared pure helper (`packages/shared`), and the Zod body schema lives there too. The web side adds `/me/opportunities` (grid + detail modal + form modal) and `/admin/opportunities` (table), and the existing member detail page gets an "Interested in" section.

**Tech Stack:** Prisma 5 / Postgres 16, NestJS 10 + jest, Next.js 15 + HeroUI + TanStack Query + lucide-react, Playwright, vitest (shared), Zod 3.

**Spec:** `docs/superpowers/specs/2026-11-10-opportunities-design.md`

## Global Constraints

- Migration is **additive only**. Never run `prisma migrate dev`/`reset`/`deploy` against any non-`localhost` `DATABASE_URL`. If a step seems to need it, stop and escalate.
- Migration folder name: `zb_opportunities` (latest existing is `za_user_disabled_at`).
- Types: `INTERNSHIP SUMMER FULL_TIME CONTRACT FREELANCE EVENT MENTORSHIP OTHER`. Status: `DRAFT PUBLISHED ARCHIVED`. WorkMode: `REMOTE HYBRID ONSITE`.
- UI labels: `Internship · Summer · Full-time · Contract · PJ · Freelance · Event · Mentorship · Other`.
- UI chrome in English, user content pt-BR. No emojis; lucide-react icons, stroke 1.5. No box-shadow. Radius: cards 12, inputs 8, pills 999.
- Colors: urgency (closing ≤ 7 days) = `--outcome-done-hard` (Tailwind `outcome-done-hard`). NEW (publishedAt < 7 days) = `--focus`. Type label has no color. Grep `apps/web/tailwind.config.ts` before using any color class.
- Member page fonts: Newsreader (narrative). Admin table: Source Serif 4 + `tabular-nums`.
- Mutating endpoints return JSON (`{ ok: true }`), never `void`.
- Stage commits by explicit path. Never `git add -A` / `git add .`.
- Visual reference: `.superpowers/brainstorm/521711-1794282599/content/opportunities-layout-v2.html` (local, gitignored).

## Review Focus

1. Deadline is **today**, and it's 23:30 BRT (02:30 UTC next day) → still **open**. Pinned in Task 1.
2. WhatsApp typed as `+55 (11) 98765-4321` → button links to `https://wa.me/5511987654321`. Pinned in Task 1 (`whatsappHref`).
3. A link with `javascript:alert(1)` or a bare `www.x.com` URL → rejected with 400 (only `http(s)://`). Pinned in Task 1 (schema) and Task 3 (controller 400).
4. A member PATCHes another member's opportunity, or fetches an admin `DRAFT` by id → 403 / 404, never data. Pinned in Task 3.
5. Interest PUT twice, or DELETE without a prior PUT → both `{ ok: true }`, no 500 from the composite-key collision. A toggle on a closed opportunity → 409. Pinned in Task 3.

---

### Task 1: Shared domain (schema, open/closed, WhatsApp link)

**Files:**
- Create: `packages/shared/src/domain/opportunity.ts`
- Create: `packages/shared/src/domain/opportunity.test.ts`
- Modify: `packages/shared/src/domain/index.ts` (add `export * from './opportunity.js';`)

**Interfaces:**
- Produces:
  - `OPPORTUNITY_TYPES` (readonly tuple), `type OpportunityType`; `OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string>`
  - `WORK_MODES`, `type WorkMode`; `OPPORTUNITY_STATUSES`, `type OpportunityStatus`
  - `OpportunityLinkSchema` `{ label: string(1..80), url: http(s) URL }`
  - `OpportunityContactSchema` `{ name: string(1..80), role?, whatsapp?, email? (email), linkedin? (http(s) URL) }`
  - `OpportunityInputSchema` with: `title` (1..160), `type`, `companyName` (1..120), optional `description` (≤ 5000), `location`, `workMode`, `compensation`, `deadline` and `eventDate` as `'YYYY-MM-DD'` strings or null, `links` (default `[]`, max 10), `contacts` (default `[]`, max 10), and optional `status`. Export `type OpportunityInput = z.infer<…>`.
  - `brtToday(now: Date): string`: `'YYYY-MM-DD'` in `America/Sao_Paulo` (use `Intl.DateTimeFormat('en-CA', { timeZone })`)
  - `closingDate(o: { deadline: Date | string | null; eventDate: Date | string | null }): string | null`: `'YYYY-MM-DD'` of `deadline ?? eventDate` (the UTC date part, since dates are stored at `T00:00:00Z`)
  - `isOpportunityOpen(o: { status; deadline; eventDate }, now: Date): boolean`: true when `status === 'PUBLISHED'` and the closing date is null or `>= brtToday(now)` (string compare)
  - `daysUntilClose(o, now): number | null`: whole days between `brtToday(now)` and the closing date
  - `whatsappHref(raw: string): string`: `https://wa.me/` + digits only

- [ ] **Step 1: Write the failing tests** in `opportunity.test.ts`:

```ts
it('stays open on the deadline day late at night BRT', () => {
  const o = { status: 'PUBLISHED', deadline: new Date('2026-11-13T00:00:00Z'), eventDate: null };
  expect(isOpportunityOpen(o, new Date('2026-11-14T02:30:00Z'))).toBe(true);   // 23:30 BRT on 13th
  expect(isOpportunityOpen(o, new Date('2026-11-14T03:00:00Z'))).toBe(false);  // 00:00 BRT on 14th
});
it('falls back to eventDate when there is no deadline', () => {
  expect(closingDate({ deadline: null, eventDate: '2026-11-16' })).toBe('2026-11-16');
});
it('no closing date means open while PUBLISHED; DRAFT/ARCHIVED never open', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  expect(isOpportunityOpen({ status: 'PUBLISHED', deadline: null, eventDate: null }, now)).toBe(true);
  expect(isOpportunityOpen({ status: 'DRAFT', deadline: null, eventDate: null }, now)).toBe(false);
  expect(isOpportunityOpen({ status: 'ARCHIVED', deadline: null, eventDate: null }, now)).toBe(false);
});
it('daysUntilClose counts BRT calendar days', () => {
  expect(daysUntilClose({ deadline: '2026-11-13', eventDate: null }, new Date('2026-11-10T12:00:00Z'))).toBe(3);
});
it('whatsappHref strips formatting', () => {
  expect(whatsappHref('+55 (11) 98765-4321')).toBe('https://wa.me/5511987654321');
});
it('rejects non-http links and accepts https', () => {
  expect(OpportunityLinkSchema.safeParse({ label: 'x', url: 'javascript:alert(1)' }).success).toBe(false);
  expect(OpportunityLinkSchema.safeParse({ label: 'x', url: 'www.x.com' }).success).toBe(false);
  expect(OpportunityLinkSchema.safeParse({ label: 'x', url: 'https://stripe.com/jobs' }).success).toBe(true);
});
it('requires title, type, companyName and defaults links/contacts to []', () => {
  const r = OpportunityInputSchema.parse({ title: 'T', type: 'SUMMER', companyName: 'Stripe' });
  expect(r.links).toEqual([]); expect(r.contacts).toEqual([]);
  expect(OpportunityInputSchema.safeParse({ title: 'T', type: 'SUMMER' }).success).toBe(false);
  expect(OpportunityInputSchema.safeParse({ title: 'T', type: 'SUMMER', companyName: 'S', deadline: '13/11/2026' }).success).toBe(false);
});
```

- [ ] **Step 2: Run** `pnpm --filter @ics-select/shared test`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `opportunity.ts` with the exports above and add the barrel export.
- [ ] **Step 4: Run** `pnpm --filter @ics-select/shared test && pnpm --filter @ics-select/shared build`. Expected: all pass, `dist/domain/opportunity.js` exists.
- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/domain/opportunity.ts packages/shared/src/domain/opportunity.test.ts packages/shared/src/domain/index.ts
git commit -m "feat(shared): opportunity schema and open/closed helpers"
```

---

### Task 2: Prisma schema + additive migration

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma` (3 enums + 2 models exactly as in the spec's "Data model"; on `User` add back-relations `opportunitiesCreated Opportunity[]` and `opportunityInterests OpportunityInterest[]`)
- Create: `packages/prisma/prisma/migrations/zb_opportunities/migration.sql`

**Interfaces:**
- Produces: Prisma client models `opportunity`, `opportunityInterest`, enums `OpportunityType`, `OpportunityStatus`, `WorkMode`.

- [ ] **Step 1: Bring up local Postgres and generate the SQL.** Run `docker compose up -d postgres`, then confirm `grep DATABASE_URL apps/api/.env` points at `localhost`. Then run:

```bash
DATABASE_URL='postgres://ics:ics_dev_password@localhost:5432/ics_select?sslmode=disable' \
  pnpm --filter @ics-select/prisma exec prisma migrate dev --create-only --name zb_opportunities
```

Rename the generated folder to `zb_opportunities` if Prisma added a timestamp prefix.
- [ ] **Step 2: Hand-review `migration.sql`.** It must contain only `CREATE TYPE` ×3, `CREATE TABLE` ×2, `CREATE INDEX` (`status, deadline`) and the `ADD CONSTRAINT … FOREIGN KEY` lines (Interest→Opportunity `ON DELETE CASCADE`). **Delete any line touching other tables** (the tsvector/embedding drift on `LibraryItem` is the usual one). Add a header comment: `-- Additive only: two new tables + three enums, no existing table touched.`
- [ ] **Step 3: Apply locally** using the same `DATABASE_URL=… prisma migrate dev` (localhost only) and run `pnpm db:generate`. Expected: "Your database is now in sync", client regenerated.
- [ ] **Step 4: Run** `pnpm --filter @ics-select/api typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/zb_opportunities/migration.sql
git commit -m "feat(prisma): opportunity and opportunity interest tables"
```

---

### Task 3: API module `opportunities`

**Files:**
- Create: `apps/api/src/opportunities/opportunities.service.ts`
- Create: `apps/api/src/opportunities/opportunities.controller.ts`
- Create: `apps/api/src/opportunities/opportunities.module.ts`
- Create: `apps/api/src/opportunities/opportunities.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (import `OpportunitiesModule`)

**Interfaces:**
- Consumes: Task 1 schema and helpers; `resolveActiveMembership(prisma, userId, now)` from `common/cycle/active-cycle.ts`; `JwtStrategyPayload { sub, role }`.
- Produces (HTTP, all under the global JWT guard):
  - `GET /opportunities` → `OpportunityDto[]`. Members see PUBLISHED + ARCHIVED; admins also see DRAFT. Admin-only query `?interestedBy=<userId>` returns only open ones that user flagged.
  - `GET /opportunities/:id` → `OpportunityDto` (DRAFT → 404 for members)
  - `POST /opportunities` → `OpportunityDto`
  - `PATCH /opportunities/:id` → `OpportunityDto` (body = `OpportunityInputSchema.partial()`)
  - `DELETE /opportunities/:id` (`@Roles('ADMIN')`) → `{ ok: true }`
  - `PUT` / `DELETE /opportunities/:id/interest` → `{ ok: true }`
  - `OpportunityDto` = DB fields with `deadline`/`eventDate` serialized as `'YYYY-MM-DD' | null`, plus `isOpen: boolean`, `createdBy: { id, name, role }`, `interests: { userId, name, pictureUrl, createdAt }[]` (sorted by createdAt asc), `interestedByMe: boolean`.
- Service signatures: `list(user, opts: { interestedBy?: string }, now?)`, `get(user, id)`, `create(user, input)`, `update(user, id, input)`, `remove(id)`, `setInterest(user, id, on: boolean, now?)`. `user` is `JwtStrategyPayload`.

Rules (each one gets a test):
- Non-admin without an active membership → `ForbiddenException` on every method (`assertAccess(user, now)` at the top).
- `create`: member → `status = 'PUBLISHED'`, `publishedAt = now`, and any `status` in the body is ignored. Admin → `status ?? 'DRAFT'`, with `publishedAt = now` if PUBLISHED.
- `update`: member and `createdById !== user.sub` → `ForbiddenException`. A member may set status only to `ARCHIVED` or `PUBLISHED` (unarchive own), never `DRAFT` (400). Set `publishedAt` the first time status becomes PUBLISHED and never reset it.
- Dates: `'YYYY-MM-DD'` → `new Date(s + 'T00:00:00Z')`.
- `setInterest`: opportunity not open (`isOpportunityOpen`) → `ConflictException`. `on` → `upsert` on `userId_opportunityId`. Off → `deleteMany`. Both are idempotent.
- `list` is sorted: open first, by `closingDate` asc (nulls last), then `publishedAt` desc. Closed ones come after. ponytail: sorted in memory, which is fine for a board of tens to hundreds of rows; move to SQL if it grows.
- Controller parses bodies with `safeParse` → `BadRequestException` (pattern of `waitlist.controller.ts`). `interestedBy` is ignored for non-admins.

- [ ] **Step 1: Write failing service tests** (mock-Prisma pattern of `me/cohort/cohort.service.spec.ts`; mock `cycleMembership.findFirst` for access):
  - `forbids a member without active membership` → `list` rejects `ForbiddenException`
  - `member create is forced PUBLISHED with publishedAt` (body status `DRAFT` ignored)
  - `admin create defaults to DRAFT with null publishedAt`
  - `member cannot update someone else's opportunity` → Forbidden
  - `member cannot set DRAFT on own opportunity` → BadRequest
  - `publishedAt is not reset on unarchive`
  - `member get of a DRAFT is 404`
  - `list hides DRAFT from members and sorts open-by-closing-date first`
  - `setInterest twice → upsert called, returns {ok:true}`. `remove interest without row → deleteMany, {ok:true}`
  - `setInterest on closed opportunity → ConflictException` (deadline yesterday BRT)
  - `interestedBy is honored for admin and ignored for member`
- [ ] **Step 2: Run** `pnpm --filter @ics-select/api test -- --testPathPattern opportunities`. Expected: FAIL.
- [ ] **Step 3: Implement** service, controller and module, and register the module in `app.module.ts`.
- [ ] **Step 4: Run** `pnpm --filter @ics-select/api test -- --testPathPattern opportunities && pnpm --filter @ics-select/api typecheck && pnpm --filter @ics-select/api lint`. Expected: PASS.
- [ ] **Step 5: Commit** `git add apps/api/src/opportunities apps/api/src/app.module.ts` → `feat(api): opportunities module with interest toggle`

---

### Task 4: Member UI `/me/opportunities`

**Files:**
- Create: `apps/web/lib/queries/opportunities.ts`
- Create: `apps/web/app/(member)/me/opportunities/page.tsx`
- Create: `apps/web/components/opportunities/opportunity-card.tsx`
- Create: `apps/web/components/opportunities/opportunity-detail-modal.tsx`
- Create: `apps/web/components/opportunities/opportunity-form-modal.tsx` (shared with admin in Task 5; `mode: 'member' | 'admin'`, where admin mode adds a status select)
- Modify: `apps/web/components/member-shell/member-nav.ts` (append `{ href: '/me/opportunities', label: 'Opportunities', icon: Briefcase, mobile: true }`)
- Test: `apps/web/tests/opportunities.spec.ts`

**Interfaces:**
- Consumes: Task 3 HTTP API. From shared: `OPPORTUNITY_TYPE_LABELS`, `daysUntilClose`, `whatsappHref`, `OpportunityInputSchema` (client-side form validation).
- Produces (in `lib/queries/opportunities.ts`): `type OpportunityDto`, `useOpportunities(opts?: { interestedBy?: string })` (key `['opportunities', opts]`), `useSetInterest()` (mutation, optimistic toggle, invalidates `['opportunities']`), `useSaveOpportunity()` (POST/PATCH), `useDeleteOpportunity()`.

UI per spec "Member UI" and the v2 mockup:
- Header via `StudioPageHeader`: eyebrow `Opportunities`, title `O que está aberto agora`, lede `N oportunidades abertas · M fecham esta semana` (M = open with `daysUntilClose ≤ 7`). There's a `Share an opportunity` button.
- Chips: `All`, one per type with ≥ 1 open (with count), `Interested`. Single-select, held in local state.
- Grid: `grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]`, with card max-width 380px.
- Card: per spec. Urgent (`daysUntilClose ≤ 7`) gets a 3px left border plus a date line in `outcome-done-hard`. `NEW` when `publishedAt` < 7 days. The `Shared by {name}` line shows when `createdBy.role === 'MEMBER'`. The interest button calls `e.stopPropagation()`.
- Detail modal: one facts strip with 1px rule dividers (**no boxed cells**). WhatsApp uses `whatsappHref`, email uses `mailto:`, LinkedIn opens in a new tab with `rel="noopener noreferrer"`. Edit and Archive appear when `createdBy.id === me`.
- Closed: a collapsed `Closed (N)` disclosure with muted cards and the toggle disabled.
- Empty state: `Nothing open right now.` plus the share button.

- [ ] **Step 1: Write failing Playwright tests** (route-mock pattern of `tests/member-studio.spec.ts`; mock `/me` with a non-null `targetTrack` and `GET /opportunities` with 3 open (one closing in 3 days, one with `interestedByMe`) + 1 closed):
  - `shows open opportunities and a collapsed closed section`: 3 cards visible, `Closed (1)` visible, closed card hidden until clicked
  - `urgent card shows days left`: text `Fecha em 3 dias`
  - `Interested chip filters to flagged ones`: 1 card after click
  - `toggling interest calls PUT`: assert the request to `/opportunities/<id>/interest` with method `PUT`
  - `detail modal shows WhatsApp link`: `href="https://wa.me/5511987654321"`
  - `member can share an opportunity`: fill title/company/type → POST body contains them
  - `nav shows Opportunities`
- [ ] **Step 2: Run** `pnpm --filter @ics-select/web test tests/opportunities.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the hooks, page, components and nav entry.
- [ ] **Step 4: Run** the spec again plus `pnpm --filter @ics-select/web typecheck`. Expected: PASS. Then open `/me/opportunities` in the dev server and compare against the v2 mockup at 375px, 1280px and 1920px widths (no horizontal scroll, cards ≤ 380px wide).
- [ ] **Step 5: Commit** the explicit paths above → `feat(web): member opportunities board`

---

### Task 5: Admin UI + member detail "Interested in"

**Files:**
- Create: `apps/web/app/(admin)/admin/opportunities/page.tsx`
- Create: `apps/web/components/admin/opportunities/opportunities-table.tsx`
- Create: `apps/web/components/admin/opportunities/interest-list-popover.tsx`
- Create: `apps/web/components/admin/member-detail/interested-in-card.tsx`
- Modify: `apps/web/components/admin-shell/topbar-admin.tsx` (add `{ href: '/admin/opportunities', label: 'Opportunities', icon: Briefcase }` after Library)
- Modify: `apps/web/app/(admin)/admin/member/[id]/page.tsx` (render `<InterestedInCard userId={id} />`)
- Test: `apps/web/tests/admin-opportunities.spec.ts`

**Interfaces:**
- Consumes: Task 4 hooks (`useOpportunities`, `useSaveOpportunity`, `useDeleteOpportunity`) and `OpportunityFormModal` with `mode="admin"`.

UI:
- Table (Source Serif 4, `tabular-nums`) with columns: Title, Company, Type, Status, Closes, Author, Interested (count button → popover listing avatar, name and flagged date). Row actions: Edit, Publish (DRAFT), Archive (PUBLISHED), Unarchive (ARCHIVED), Delete (with confirm). A `New opportunity` button opens the form.
- `InterestedInCard`: `useOpportunities({ interestedBy: userId })`. It lists title, company and closing date, and **renders nothing when empty** (gate the wrapper, so no orphan label is left behind).

- [ ] **Step 1: Write failing Playwright tests** (admin `/me` mock with `role: 'ADMIN'`):
  - `admin table lists drafts with status`: a row with `DRAFT`
  - `publish action PATCHes status PUBLISHED`
  - `interest count opens the member list`
  - `member detail shows Interested in when the member flagged something` and `hides it when empty`
- [ ] **Step 2: Run** `pnpm --filter @ics-select/web test tests/admin-opportunities.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the pieces above.
- [ ] **Step 4: Run** both opportunities specs, then `pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** the explicit paths above → `feat(web): admin opportunities table and member interest card`

---

## After all tasks

Run `pnpm test` at the root (expected: green). Push and ship through the normal CI → deploy path; the container applies `zb_opportunities` on start. **Do not** run any migration against prod by hand.
