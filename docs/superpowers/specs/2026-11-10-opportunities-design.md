# Opportunities: design

**Date:** 2026-11-10
**Status:** approved in conversation (grilling + visual companion), pending plan

## Intent

A new "Opportunities" tab where admins **and members** post internships, summers, full-time roles, PJ contracts, freelance gigs, events (hackathons, competitions), and mentorships. Members browse, open details (links, direct contacts like WhatsApp), and flag **interest**. The point beyond a WhatsApp group: the admin sees *who* is going after *what*, and can act on it when building that member's weekly plan (e.g. a member interested in the Stripe summer gets graph/system-design prep before the deadline).

## Goals

- One place for open opportunities, with direct contacts and links.
- A one-click "interest" toggle, visible to the whole cohort (avatars), and surfaced to the admin on the member detail page.
- Opportunities close themselves when their date passes.

## Non-goals (explicitly cut, may come later)

- Application tracker (applied / interviewing / offer). The interest row can grow a status column later.
- Company entity / company pages. Company is plain text.
- Track-based targeting. Everyone sees everything.
- Notifications of any kind (no WhatsApp, no deadline reminders). Only the per-card "NEW" badge; no unread dot on the nav entry (no per-user last-seen state). *(builder-check call)*
- Feeding interests into the `draft-plan` AI context.
- Logos, structured salary ranges, seniority, tags.

## Anti-goals

- Don't tie the data to a cycle (no `cycleId`), so opening it to alumni later is a gate change, not a migration.
- Don't frame it as "Big Tech only" (see CLAUDE.md scope rule). Use the full type list.

## Audience & permissions

- **v1: visible to admins and to members with an active membership** (`resolveActiveMembership`). Today the `OnboardingGate` already redirects members without an active cycle away from every `/me/*` route, so no gate change is needed. The API mirrors it: non-admin callers without an active membership get 403 on all `/opportunities` endpoints.
- **Alumni access is deferred** to a follow-up PR (exempt `/me/opportunities` in `OnboardingGate` + reduced shell). The data model has no cycle link on purpose so that PR touches no schema.
- **Interest avatars are not filtered by cycle:** whoever can see the tab sees every interested user, including past-cycle members who flagged older opportunities. *(confirmed default)*
- **Admin:** full CRUD on any opportunity, plus publish/archive/unarchive. Admin-created default status is `DRAFT`.
- **Member:** can create, and **creation publishes immediately** (`status = PUBLISHED`, `publishedAt = now()`). No moderation queue and no drafts for members. A member can edit and archive **only opportunities they created**. Admin can archive anything a member posted.
- Card and modal show **"Shared by {name}"** when `createdBy.role = MEMBER`. Nothing shown for admin-authored ones.

## Data model (additive migration, two new tables, no changes to existing tables except back-relations on `User`)

```prisma
enum OpportunityType   { INTERNSHIP SUMMER FULL_TIME CONTRACT FREELANCE EVENT MENTORSHIP OTHER }
enum OpportunityStatus { DRAFT PUBLISHED ARCHIVED }
enum WorkMode          { REMOTE HYBRID ONSITE }

model Opportunity {
  id           String            @id @default(cuid())
  title        String
  type         OpportunityType
  companyName  String
  description  String?
  location     String?
  workMode     WorkMode?
  compensation String?
  deadline     DateTime?
  eventDate    DateTime?
  links        Json              @default("[]")  // [{ label, url }]
  contacts     Json              @default("[]")  // [{ name, role?, whatsapp?, email?, linkedin? }]
  status       OpportunityStatus @default(DRAFT)
  publishedAt  DateTime?
  createdById  String
  createdBy    User              @relation(fields: [createdById], references: [id])
  interests    OpportunityInterest[]
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  @@index([status, deadline])
}

model OpportunityInterest {
  userId        String
  opportunityId String
  createdAt     DateTime    @default(now())
  user          User        @relation(fields: [userId], references: [id])
  opportunity   Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  @@id([userId, opportunityId])
}
```

- Follow the repo's migration naming (letter-prefixed, next free letter after the latest). Hand-check the generated SQL against the CLAUDE.md DB rules: it must be purely additive. **Never run migrate dev/reset against a non-localhost URL.**
- `links` / `contacts` are JSONB, validated by a Zod schema in `packages/shared` (used by API and web). `url` must be http(s). At least one of `whatsapp`/`email`/`linkedin` per contact is *not* required. A name alone is allowed.
- `publishedAt` is set the first time status becomes `PUBLISHED` and is not reset on archive/unarchive.

### Field semantics

| Field | Required | Notes |
|---|---|---|
| `title`, `type`, `companyName` | yes | |
| `description` | no | Free text, pt-BR, rendered with line breaks preserved (plain text, no markdown) |
| `location`, `compensation` | no | Free text ("São Paulo", "R$ 3.500 + VR") |
| `workMode` | no | |
| `deadline` | no | Last day to apply. Date-only in the UI, interpreted as end of that day BRT |
| `eventDate` | no | Mainly for `EVENT` / `MENTORSHIP`. Date-only, same BRT rule |

### Open vs closed (computed, no cron, no column)

- **Closing date** = `coalesce(deadline, eventDate)`.
- **Open** = `status = PUBLISHED AND (closing date IS NULL OR closing date >= today in America/Sao_Paulo)`.
- **Closed** = `status = ARCHIVED`, or `PUBLISHED` with closing date in the past. Interests are preserved.
- `DRAFT` is never shown to members.

### Type labels (UI chrome in English)

`INTERNSHIP` Internship · `SUMMER` Summer · `FULL_TIME` Full-time · `CONTRACT` Contract · PJ · `FREELANCE` Freelance · `EVENT` Event · `MENTORSHIP` Mentorship · `OTHER` Other.
`EVENT` covers hackathons, competitions (ICPC-style), meetups, workshops.

## Member UI: `/me/opportunities`

New route in the `(member)` group. New nav entry **Opportunities** after Calendar in `apps/web/components/member-shell/member-nav.ts` (topbar + mobile bottom tab bar).

Validated mockup: `.superpowers/brainstorm/521711-1794282599/content/opportunities-layout-v2.html` (gitignored, local reference).

- **Header:** eyebrow `OPPORTUNITIES`, Newsreader display "O que está aberto agora", lede "N oportunidades abertas · M fecham esta semana".
- **Filter chips:** `All` + one chip per type that has ≥1 open opportunity (with count) + an `Interested` chip (only ones I flagged). Single-select.
- **Grid:** responsive, `repeat(auto-fill, minmax(280px, 1fr))`, with card width capped around 380px on very wide screens. No fixed column count, and cards never get huge.
- **Sort:** closing date ascending (soonest first), then no-date ones by `publishedAt` desc.
- **Card:** type (Plex Mono, uppercase, no color) + `NEW` (indigo dot, `--focus`, when `publishedAt` < 7 days) → company (Inter semibold) → title (Newsreader) → location · workMode · compensation → closing-date line ("Fecha em 3 dias · 13 nov" / "Evento em 6 dias" / "Sem prazo") → footer with interest avatar stack + count, and the `Interested` toggle (bookmark icon, filled/inverted when on). "Shared by {name}" if member-authored.
- **Urgency:** closing in ≤ 7 days → 3px left border + date text in `--outcome-done-hard` (the project's "past-due warning" token; intentional per design system).
- **Detail modal** (HeroUI Modal) on card click: header (type, NEW, "Publicado há N dias", company, title) → a single facts strip (Deadline / Local / Compensação) separated by 1px rules, **not boxed cells** → description (Newsreader) → Links list (label + domain, opens new tab) → Contacts (name, role, action buttons WhatsApp `https://wa.me/<digits>` / mailto / LinkedIn, showing only those present) → footer: avatars + "{names} têm interesse", primary button "Tenho interesse" toggle.
- **Closed section:** collapsed `▸ Closed (N)` at the bottom, same cards muted, toggle disabled.
- **Member create/edit:** a "Share an opportunity" button in the header opens the same form modal as the admin one (minus status controls). Own cards get Edit / Archive in the modal.
- Icons: lucide-react, stroke 1.5. No emojis.

## Admin UI

- **`/admin/opportunities`** in the `(admin)` group, new entry in `apps/web/components/admin-shell/topbar-admin.tsx`. Dense table (Source Serif 4, tabular nums): title, company, type, status, closing date, author, interest count. Row actions: Publish / Archive / Unarchive / Edit / Delete.
- **Form modal** (shared with member): all fields. `links` and `contacts` as repeatable rows with "+ Add".
- **Interest count** is clickable → list of members (avatar, name, date flagged).
- **Member detail** (`/admin/member/[id]`): a small "Interested in" section listing that member's *open* opportunities with closing dates. Hidden when empty.

## API (NestJS module `opportunities`)

Authenticated by the global guards. Ownership checks inline in the controller, per repo convention.

- `GET /opportunities`: members get PUBLISHED + ARCHIVED (open/closed computed server-side and returned as a flag), admins also get DRAFT. Each row includes `createdBy {id, name, role}`, `interests [{userId, name, pictureUrl}]`, `interestedByMe`.
- `POST /opportunities`: member → forced `PUBLISHED`. Admin → `DRAFT` unless status given.
- `PATCH /opportunities/:id`: admin any; member only if `createdById = me` (and cannot set `DRAFT`).
- `DELETE /opportunities/:id`: admin only (members archive instead).
- `PUT /opportunities/:id/interest` / `DELETE /opportunities/:id/interest`: idempotent toggle. Return JSON `{ ok: true }` (not void, per CLAUDE.md convention).
- Member detail's "Interested in" can be served by the existing admin member-detail endpoint or by `GET /opportunities?interestedBy=:userId` (admin-only filter). Builder's call.
- Validate bodies with the shared Zod schema (`HttpExceptionFilter` already maps `ZodError` to 400).

## Left to the builder

- Exact component split, query keys, the empty states (no opportunities yet / no interested ones).
- Whether delete of a member's own opportunity is exposed (default: no, archive only).
- Test coverage: open/closed BRT boundary logic, ownership checks, interest toggle idempotency.
