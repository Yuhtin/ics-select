# PR 3c — Admin Rest: Member Detail · Members · Library · Cycles · AI Usage · Classes (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Finish the admin surface area. Ship the remaining pages under the `(admin)` shell: member detail with 4 tabs, members list, library list with search/filters/new-item/topics, cycles list + create/archive, AI usage, plus extending the cycle page with classes management. After this PR the legacy `(app)/admin/*` tree is a pure superset and can be removed in a small follow-up PR.

**Architecture:**

- **Member detail** (`/admin/member/[id]`) — four tabs (Timeline · Retros · Diagnose · Notes). New backend `MemberDetailService` returns `{ member, cycle, topicCoverage, plans (with outcomes+reflections), retros }` in one call. Diagnose is rendered on-demand via the existing `/ai/members/:id/diagnose` (24h cached). Notes = CRUD over `AdminNote`.
- **Members list** (`/admin/members`) — reuses `AdminDashboardService.getCohort` (already returns member cards with stats). New shell UX: each row clicks through to `/admin/member/[id]`.
- **Library** (`/admin/library`) — reuses `GET /library`, `POST /library/search`, `POST /library`, `PATCH /library/:id`, `DELETE /library/:id`, `POST /library/import`. Adds UI for filters + typeahead + new-item modal (Manual / Import URL tabs) + topics-manage modal (uses existing `/topics` CRUD from PR 3b).
- **Cycles list** (`/admin/cycles`) — reuses `GET /cycles`, `POST /cycles`, `POST /cycles/:id/archive`. New UI: table + create-cycle modal + archive button.
- **AI usage** (`/admin/ai-usage`) — reuses `GET /ai/usage?sinceDays=N`. New UI: summary cards + table + simple bar visualisation per day.
- **Cycle page classes** (`/admin/cycle/[id]` extension) — extends the existing PR 3a page with a `CLASSES` section. Uses existing `GET /cycles/:cycleId/classes`, `POST /cycles/:cycleId/classes`, `POST /classes/:classId/attendance`.
- **AdminNote** backend — new service + controller: `GET /admin/notes?aboutId=...`, `POST /admin/notes`, `PATCH /admin/notes/:id`, `DELETE /admin/notes/:id`.

All pages live under `(admin)` and use the sidebar shell built in PR 3a. Legacy `(app)/admin/*` routes remain untouched; after this PR merges, a tiny cleanup PR can delete them.

**Tech stack:** NestJS 10 + Prisma 5 · Next.js 15 App Router + TanStack Query · Source Serif 4 on dense-data pages · Inter chrome · lucide-react icons · Magazine Editorial palette.

**Reference spec:** `docs/superpowers/specs/2026-04-16-revamp-design.md` §5.3 (Member detail), §5.5 (Library), §5.6 (Cycles list), §5.7 (AI usage), §5.2 (Cycle page extension for classes).

**Out of scope (deferred):**

- **PR 4**: retro cron (Fri 18h), WhatsApp purge, tool calling (`search_library` as real LLM tool), admin chat UI.
- **Small cleanup PR** after 3c: delete `(app)/admin/*` entirely — every legacy route now has an `(admin)` replacement.

---

## File Structure

### Created (Backend)

- `apps/api/src/admin/notes/notes.service.ts`
- `apps/api/src/admin/notes/notes.service.spec.ts`
- `apps/api/src/admin/notes/notes.controller.ts`
- `apps/api/src/admin/notes/notes.module.ts`
- `apps/api/src/admin/notes/dto.ts`
- `apps/api/src/admin/member-detail/member-detail.service.ts`
- `apps/api/src/admin/member-detail/member-detail.service.spec.ts`
- `apps/api/src/admin/member-detail/member-detail.controller.ts`
- `apps/api/src/admin/member-detail/member-detail.module.ts`

### Modified (Backend)

- `apps/api/src/admin/admin.module.ts` (import NotesModule + MemberDetailModule)

### Created (Frontend)

- `apps/web/lib/queries/admin-member.ts`
- `apps/web/lib/queries/admin-notes.ts`
- `apps/web/lib/queries/admin-members-list.ts`
- `apps/web/lib/queries/admin-library.ts`
- `apps/web/lib/queries/admin-cycles.ts`
- `apps/web/lib/queries/admin-ai-usage.ts`
- `apps/web/lib/queries/admin-classes.ts`
- `apps/web/components/admin/member-detail/timeline-tab.tsx`
- `apps/web/components/admin/member-detail/retros-tab.tsx`
- `apps/web/components/admin/member-detail/diagnose-tab.tsx`
- `apps/web/components/admin/member-detail/notes-tab.tsx`
- `apps/web/components/admin/library/filters-bar.tsx`
- `apps/web/components/admin/library/new-item-modal.tsx`
- `apps/web/components/admin/library/topics-modal.tsx`
- `apps/web/components/admin/cycles/new-cycle-modal.tsx`
- `apps/web/components/admin/cycles/classes-section.tsx`
- `apps/web/components/admin/cycles/schedule-class-modal.tsx`
- `apps/web/components/admin/cycles/attendance-modal.tsx`
- `apps/web/app/(admin)/admin/member/[id]/page.tsx`
- `apps/web/app/(admin)/admin/members/page.tsx`
- `apps/web/app/(admin)/admin/library/page.tsx`
- `apps/web/app/(admin)/admin/cycles/page.tsx`
- `apps/web/app/(admin)/admin/ai-usage/page.tsx`

### Modified (Frontend)

- `apps/web/app/(admin)/admin/cycle/[id]/page.tsx` (append ClassesSection block)

---

## Tasks

### Task 1: AdminNoteService + tests

**Files:**
- Create: `apps/api/src/admin/notes/notes.service.ts`
- Create: `apps/api/src/admin/notes/notes.service.spec.ts`

**Schema reference:** `AdminNote { id, aboutId, authorId, text, createdAt }` — see `packages/prisma/prisma/schema.prisma:272`.

**Service interface:**

```ts
async listForMember(aboutId: string): Promise<AdminNote[]>
async create(input: { aboutId: string; authorId: string; text: string }): Promise<AdminNote>
async update(id: string, authorId: string, text: string): Promise<AdminNote>
async delete(id: string, authorId: string): Promise<void>
```

**Rules:**
- `update` / `delete` enforce `authorId` match — throw `ForbiddenException('not the author')` if a different admin tries to mutate.
- `list` orders by `createdAt` desc.

- [ ] **Step 1: Write the spec**

Create `apps/api/src/admin/notes/notes.service.spec.ts` with:

```typescript
import { NotesService } from './notes.service';

function makePrisma() {
  const notes = new Map<string, { id: string; aboutId: string; authorId: string; text: string; createdAt: Date }>();
  let nextId = 1;
  return {
    notes,
    adminNote: {
      findMany: jest.fn(async ({ where, orderBy }: any) => {
        const filtered = Array.from(notes.values()).filter((n) => n.aboutId === where.aboutId);
        if (orderBy?.createdAt === 'desc') return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return filtered;
      }),
      findUnique: jest.fn(async ({ where }: any) => notes.get(where.id) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const id = `n-${nextId++}`;
        const rec = { id, createdAt: new Date(), ...data };
        notes.set(id, rec);
        return rec;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = notes.get(where.id)!;
        const next = { ...cur, ...data };
        notes.set(where.id, next);
        return next;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const row = notes.get(where.id)!;
        notes.delete(where.id);
        return row;
      }),
    },
  };
}

describe('NotesService', () => {
  it('lists notes for a member in createdAt desc order', async () => { ... });
  it('creates a note with authorId', async () => { ... });
  it('updates a note when the author matches', async () => { ... });
  it('throws ForbiddenException when non-author tries to update', async () => { ... });
  it('deletes a note when the author matches', async () => { ... });
  it('throws ForbiddenException when non-author tries to delete', async () => { ... });
  it('throws NotFoundException when the note does not exist', async () => { ... });
});
```

Fill in each test body.

- [ ] **Step 2: Implement**

```typescript
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  listForMember(aboutId: string) {
    return this.prisma.adminNote.findMany({
      where: { aboutId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: { aboutId: string; authorId: string; text: string }) {
    return this.prisma.adminNote.create({ data: input });
  }

  async update(id: string, authorId: string, text: string) {
    const existing = await this.prisma.adminNote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('note not found');
    if (existing.authorId !== authorId) throw new ForbiddenException('not the author');
    return this.prisma.adminNote.update({ where: { id }, data: { text } });
  }

  async delete(id: string, authorId: string) {
    const existing = await this.prisma.adminNote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('note not found');
    if (existing.authorId !== authorId) throw new ForbiddenException('not the author');
    await this.prisma.adminNote.delete({ where: { id } });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/admin/notes
git commit -m "feat(api): AdminNoteService — CRUD with author gating"
```

---

### Task 2: AdminNote controller + module + wire

**Files:**
- Create: `apps/api/src/admin/notes/dto.ts`
- Create: `apps/api/src/admin/notes/notes.controller.ts`
- Create: `apps/api/src/admin/notes/notes.module.ts`
- Modify: `apps/api/src/admin/admin.module.ts`

**Endpoints:**
- `GET /admin/notes?aboutId=<userId>`
- `POST /admin/notes` body `{ aboutId, text }`
- `PATCH /admin/notes/:id` body `{ text }`
- `DELETE /admin/notes/:id`

- [ ] **Step 1: DTO**

```typescript
// dto.ts
import { z } from 'zod';

export const CreateNoteSchema = z.object({
  aboutId: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export const UpdateNoteSchema = z.object({
  text: z.string().min(1).max(2000),
});
```

- [ ] **Step 2: Controller**

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { NotesService } from './notes.service.js';
import { CreateNoteSchema, UpdateNoteSchema } from './dto.js';

@Roles('ADMIN')
@Controller('admin/notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@Query('aboutId') aboutId: string) {
    return this.notes.listForMember(aboutId);
  }

  @Post()
  create(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const parsed = CreateNoteSchema.parse(body);
    return this.notes.create({ aboutId: parsed.aboutId, authorId: user.sub, text: parsed.text });
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const { text } = UpdateNoteSchema.parse(body);
    return this.notes.update(id, user.sub, text);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtStrategyPayload) {
    await this.notes.delete(id, user.sub);
    return { ok: true };
  }
}
```

- [ ] **Step 3: Module + wire**

```typescript
// notes.module.ts
import { Module } from '@nestjs/common';
import { NotesService } from './notes.service.js';
import { NotesController } from './notes.controller.js';

@Module({ providers: [NotesService], controllers: [NotesController] })
export class NotesModule {}
```

Add `NotesModule` to `AdminModule.imports` (after `PlanDraftsModule`).

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
git add apps/api/src/admin/notes apps/api/src/admin/admin.module.ts
git commit -m "feat(api): /admin/notes CRUD endpoints (admin-only, author-gated)"
```

---

### Task 3: MemberDetailService + controller + tests

**Files:**
- Create: `apps/api/src/admin/member-detail/member-detail.service.ts`
- Create: `apps/api/src/admin/member-detail/member-detail.service.spec.ts`
- Create: `apps/api/src/admin/member-detail/member-detail.controller.ts`
- Create: `apps/api/src/admin/member-detail/member-detail.module.ts`
- Modify: `apps/api/src/admin/admin.module.ts`

**Response shape:**

```ts
type MemberDetailResponse = {
  member: {
    id: string;
    name: string;
    email: string;
    pictureUrl: string | null;
    whatsappPhone: string | null;
    track: 'BIG_TECH' | 'CONSULTING_TECH' | 'COMPETITIVE_PROGRAMMING' | 'STARTUP' | 'OTHER' | null;
    role: 'ADMIN' | 'MEMBER';
  };
  cycle: {
    id: string;
    name: string;
    weekNumber: number;
    weeksTotal: number;
    startsAt: string;
    endsAt: string;
  } | null;
  topicCoverage: Array<{
    topicId: string;
    topicSlug: string;
    topicLabel: string;
    order: number;
    itemsPlanned: number;
    itemsDone: number;
    coveragePct: number;
  }>;
  timeline: Array<{
    planId: string;
    weekStart: string;
    weekEnd: string;
    status: 'DRAFT' | 'PUBLISHED';
    items: Array<{
      id: string;
      libraryItemId: string;
      title: string;
      outcome: 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK';
      reflection: string | null;
      completedAt: string | null;
      topicLabel: string | null;
    }>;
  }>;  // newest plan first
  retros: Array<{
    id: string;
    weekStart: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  }>;
};
```

**Rules:**
- Throw `NotFoundException('member not found')` if user missing.
- `cycle` is null when member has no active-cycle membership; other fields still populated.
- `topicCoverage`: same logic as `PlanContextService` — but over the member's plans in the active cycle.
- `timeline`: all PUBLISHED plans for the member (cross-cycle), newest first, limit to 6 to keep payload small.
- `retros`: all retros for the member, newest first, limit to 8.

- [ ] **Step 1: Write spec (≥5 tests)**

Cover:
1. Throws NotFoundException when member missing.
2. Returns `cycle = null` when member has no active-cycle membership.
3. Returns track from membership when present.
4. Returns timeline with plans newest first, outcomes + reflections included.
5. Returns retros newest first.
6. Topic coverage computed correctly (2 items planned, 1 done → 50%).

Pattern: same mock-heavy style as `triage.service.spec.ts` and `plan-context.service.spec.ts`.

- [ ] **Step 2: Implement service**

Keep under 300 lines. Parallel fetches where possible. Reuse `mondayUTC` helper inline or skip — `weekNumber/weeksTotal` arithmetic goes inline. Topic coverage iterates via a `Map<string, { planned, done }>`.

- [ ] **Step 3: Controller + module**

```typescript
// member-detail.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { MemberDetailService } from './member-detail.service.js';

@Roles('ADMIN')
@Controller('admin/member')
export class MemberDetailController {
  constructor(private readonly svc: MemberDetailService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.getDetail(id);
  }
}
```

```typescript
// member-detail.module.ts
import { Module } from '@nestjs/common';
import { MemberDetailService } from './member-detail.service.js';
import { MemberDetailController } from './member-detail.controller.js';

@Module({ providers: [MemberDetailService], controllers: [MemberDetailController] })
export class MemberDetailModule {}
```

Add `MemberDetailModule` to `AdminModule.imports`.

**Route collision note:** the new route is `GET /admin/member/:id`. An existing PR 3b route at `GET /admin/member/:id/plan-context` must NOT shadow. NestJS routes them independently so this is fine, but verify after wiring — `curl localhost:3001/admin/member/abc` should hit `member-detail` while `curl .../admin/member/abc/plan-context` hits `plan-context`.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
git add apps/api/src/admin/member-detail apps/api/src/admin/admin.module.ts
git commit -m "feat(api): GET /admin/member/:id — member detail with timeline + retros + topic coverage"
```

---

### Task 4: Frontend data hooks (admin-member, admin-notes, admin-members-list, admin-library, admin-cycles, admin-ai-usage, admin-classes)

**Files:**
- Create: `apps/web/lib/queries/admin-member.ts`
- Create: `apps/web/lib/queries/admin-notes.ts`
- Create: `apps/web/lib/queries/admin-members-list.ts`
- Create: `apps/web/lib/queries/admin-library.ts`
- Create: `apps/web/lib/queries/admin-cycles.ts`
- Create: `apps/web/lib/queries/admin-ai-usage.ts`
- Create: `apps/web/lib/queries/admin-classes.ts`

**Contracts:**

```ts
// admin-member.ts
export type MemberDetailResponse = /* mirror Task 3 response shape */;

export function useAdminMember(memberId: string) {
  return useQuery({
    queryKey: ['admin', 'member', memberId],
    queryFn: () => apiFetch<MemberDetailResponse>(`/admin/member/${memberId}`),
  });
}

export function useAdminMemberDiagnose() {
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<{ markdown: string; cachedAt: string }>(`/members/${memberId}/diagnose`, { method: 'GET' }),
    // NOTE: the existing controller uses @Get, but we want to force regenerate. Use useQuery with refetch when needed.
    // Simplest: use useQuery with manual refetch, keyed by memberId.
  });
}
```

Actually use `useQuery` for diagnose:

```ts
export function useAdminMemberDiagnose(memberId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'diagnose', memberId],
    queryFn: () => apiFetch<{ markdown: string; cachedAt: string }>(`/members/${memberId}/diagnose`),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,  // 24h
  });
}
```

The diagnose endpoint path is actually `GET /members/:id/diagnose` (verify via grep — `AiController` has `@Get('members/:id/diagnose')` so the full path is `/members/:id/diagnose`).

```ts
// admin-notes.ts
export type AdminNote = {
  id: string;
  aboutId: string;
  authorId: string;
  text: string;
  createdAt: string;
};

export function useAdminNotes(aboutId: string | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'notes', aboutId],
    queryFn: () => apiFetch<AdminNote[]>(`/admin/notes?aboutId=${aboutId}`),
    enabled: Boolean(aboutId),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { aboutId: string; text: string }) =>
      apiFetch<AdminNote>('/admin/notes', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (_note, v) => qc.invalidateQueries({ queryKey: ['admin', 'notes', v.aboutId] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; aboutId: string; text: string }) =>
      apiFetch<AdminNote>(`/admin/notes/${input.id}`, { method: 'PATCH', body: JSON.stringify({ text: input.text }) }),
    onSuccess: (_note, v) => qc.invalidateQueries({ queryKey: ['admin', 'notes', v.aboutId] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; aboutId: string }) =>
      apiFetch<{ ok: boolean }>(`/admin/notes/${input.id}`, { method: 'DELETE' }),
    onSuccess: (_ok, v) => qc.invalidateQueries({ queryKey: ['admin', 'notes', v.aboutId] }),
  });
}
```

```ts
// admin-members-list.ts
export type AdminMemberCard = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: { plansCount: number; doneItems: number; stuckItems: number };
};

export function useAdminMembers() {
  return useQuery({
    queryKey: ['admin', 'members'],
    queryFn: () => apiFetch<AdminMemberCard[]>('/admin/dashboard'),
  });
}
```

```ts
// admin-library.ts
export type LibraryItem = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
  tracks: string[];
  topicId: string | null;
  createdAt: string;
};

export function useAdminLibrary() {
  return useQuery({ queryKey: ['admin', 'library'], queryFn: () => apiFetch<LibraryItem[]>('/library') });
}

export function useAdminLibrarySearch(params: {
  query?: string;
  format?: string[];
  difficulty?: string[];
  tracks?: string[];
  topicId?: string;
  maxMinutes?: number;
}) {
  return useQuery({
    queryKey: ['admin', 'library-search', params],
    queryFn: () =>
      apiFetch<{ data: LibraryItem[]; total: number }>('/library/search', {
        method: 'POST',
        body: JSON.stringify({ ...params, limit: 100 }),
      }),
    // always enabled — returns full list when no query provided
  });
}

export function useCreateLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<LibraryItem, 'id' | 'createdAt'>) =>
      apiFetch<LibraryItem>('/library', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'library'] }),
  });
}

export function useUpdateLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; data: Partial<LibraryItem> }) =>
      apiFetch<LibraryItem>(`/library/${input.id}`, { method: 'PATCH', body: JSON.stringify(input.data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'library'] }),
  });
}

export function useDeleteLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/library/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'library'] }),
  });
}

export function useImportUrl() {
  return useMutation({
    mutationFn: (url: string) =>
      apiFetch<Partial<LibraryItem>>('/library/import', { method: 'POST', body: JSON.stringify({ url }) }),
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { slug: string; label: string; order?: number }) =>
      apiFetch<{ id: string; slug: string; label: string; order: number }>('/topics', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }),
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; data: { slug?: string; label?: string; order?: number } }) =>
      apiFetch(`/topics/${input.id}`, { method: 'PATCH', body: JSON.stringify(input.data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }),
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/topics/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }),
  });
}
```

```ts
// admin-cycles.ts
export type CycleRow = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
  rankingVisibleToMembers: boolean;
  createdAt: string;
  _count?: { memberships: number };
  memberships?: Array<{ userId: string }>;
};

export function useAdminCycles() {
  return useQuery({ queryKey: ['admin', 'cycles'], queryFn: () => apiFetch<CycleRow[]>('/cycles') });
}

export function useCreateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; startsAt: string; endsAt: string }) =>
      apiFetch<CycleRow>('/cycles', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'cycles'] }),
  });
}

export function useArchiveCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<CycleRow>(`/cycles/${id}/archive`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'cycles'] }),
  });
}
```

```ts
// admin-ai-usage.ts
export type AiUsageRow = {
  id: string;
  userId: string | null;
  purpose: string;
  model: string;
  promptTokens: number;
  responseTokens: number;
  costUsd: string; // Prisma Decimal serializes to string
  metadata: unknown;
  createdAt: string;
};

export type AiUsageResponse = { rows: AiUsageRow[]; totalCost: number };

export function useAdminAiUsage(sinceDays: number) {
  return useQuery({
    queryKey: ['admin', 'ai-usage', sinceDays],
    queryFn: () => apiFetch<AiUsageResponse>(`/ai/usage?sinceDays=${sinceDays}`),
  });
}
```

```ts
// admin-classes.ts
export type ClassSession = {
  id: string;
  cycleId: string;
  title: string;
  topic: string | null;
  scheduledAt: string;
  durationMin: number;
  notes: string | null;
  attendances?: Array<{ userId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' }>;
};

export function useCycleClasses(cycleId: string) {
  return useQuery({
    queryKey: ['admin', 'classes', cycleId],
    queryFn: () => apiFetch<ClassSession[]>(`/cycles/${cycleId}/classes`),
  });
}

export function useScheduleClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cycleId: string;
      title: string;
      topic: string | null;
      scheduledAt: string;
      durationMin: number;
      notes?: string;
    }) =>
      apiFetch<ClassSession>(`/cycles/${input.cycleId}/classes`, {
        method: 'POST',
        body: JSON.stringify({
          title: input.title,
          topic: input.topic,
          scheduledAt: input.scheduledAt,
          durationMin: input.durationMin,
          notes: input.notes,
        }),
      }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['admin', 'classes', v.cycleId] }),
  });
}

export function useSubmitAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cycleId: string;
      classId: string;
      rows: Array<{ userId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' }>;
    }) =>
      apiFetch(`/classes/${input.classId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ rows: input.rows }),
      }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['admin', 'classes', v.cycleId] }),
  });
}
```

- [ ] **Step 1-7:** Create the 7 hook files above.

- [ ] **Step 8:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/lib/queries
git commit -m "feat(web): admin data hooks (member, notes, members list, library, cycles, ai-usage, classes)"
```

---

### Task 5: `/admin/member/[id]` page with 4 tabs

**Files:**
- Create: `apps/web/components/admin/member-detail/timeline-tab.tsx`
- Create: `apps/web/components/admin/member-detail/retros-tab.tsx`
- Create: `apps/web/components/admin/member-detail/diagnose-tab.tsx`
- Create: `apps/web/components/admin/member-detail/notes-tab.tsx`
- Create: `apps/web/app/(admin)/admin/member/[id]/page.tsx`

**Header design:**
- Avatar 48px, name (font-serif-tool 2xl semibold), track pill, cycle position.
- Action buttons right-aligned: `Create plan for next week →` (primary), `WhatsApp ↗` (secondary, opens `https://wa.me/<phone>`), `Export data` (ghost — no-op stub for PR 4).
- `TopicCoverageMini` below header (reuse the component from PR 3b).

**Tabs strip:** simple segmented control. Active tab has `border-b-2 border-ink`.

**Timeline tab** — reverse-chrono list of plans. Each plan: week label + status pill + items (with outcome dot + title + reflection below in italic serif if present).

**Retros tab** — reverse-chrono list. Each retro: `Week <date>` header + 3 blockquotes (whatClicked / whatStuck / nextWeekWish) in the same style as `ContextPanel.RetroBlock`. Click to expand if collapsed.

**Diagnose tab** — fetches via `useAdminMemberDiagnose(memberId, enabled)`. Button `↻ Regenerate` that triggers `refetch`. Markdown rendered via a minimal inline renderer (no `react-markdown` dep — just split paragraphs on `\n\n` and render each in font-serif-tool).

**Notes tab** — list of notes + form at bottom. Each note has `edit` / `delete` buttons. New note form is a textarea + Save button.

**page.tsx**:

```tsx
'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react';
import { useAdminMember } from '../../../../../lib/queries/admin-member';
import { TopicCoverageMini } from '../../../../../components/admin/plan-editor/topic-coverage-mini';
import { TimelineTab } from '../../../../../components/admin/member-detail/timeline-tab';
import { RetrosTab } from '../../../../../components/admin/member-detail/retros-tab';
import { DiagnoseTab } from '../../../../../components/admin/member-detail/diagnose-tab';
import { NotesTab } from '../../../../../components/admin/member-detail/notes-tab';
import { Eyebrow } from '../../../../../components/ui/eyebrow';

type Tab = 'timeline' | 'retros' | 'diagnose' | 'notes';

export default function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = use(params);
  const { data, isLoading } = useAdminMember(memberId);
  const [tab, setTab] = useState<Tab>('timeline');

  if (isLoading || !data) return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;

  return (
    <div className="max-w-5xl space-y-8">
      {/* header, actions, topic coverage, tabs strip, tab panel */}
    </div>
  );
}
```

- [ ] **Steps 1-5:** Implement the 4 tab components + the page.

- [ ] **Step 6:** Typecheck + build + commit

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
git add 'apps/web/app/(admin)/admin/member' apps/web/components/admin/member-detail
git commit -m "feat(web): /admin/member/[id] (timeline + retros + diagnose + notes)"
```

---

### Task 6: `/admin/members` list page

**Files:**
- Create: `apps/web/app/(admin)/admin/members/page.tsx`

**Design:**

- H1 Source Serif 4 "Members".
- Search bar at the top (simple client-side filter by name/email).
- Table rows: avatar · name + email stacked · role pill · stats mono (`plansCount plans · doneItems done · stuckItems stuck`) · `→ detail` link.
- Row click goes to `/admin/member/<id>`.

Keep it simple — a single file ~120 lines. No subcomponents needed.

- [ ] **Step 1:** Implement the page.

- [ ] **Step 2:** Typecheck + commit

```bash
git add 'apps/web/app/(admin)/admin/members'
git commit -m "feat(web): /admin/members list"
```

---

### Task 7: `/admin/cycles` list page

**Files:**
- Create: `apps/web/components/admin/cycles/new-cycle-modal.tsx`
- Create: `apps/web/app/(admin)/admin/cycles/page.tsx`

**Design:**

- H1 "Cycles".
- `+ New cycle` button top-right — opens modal.
- Table: name · status pill · start — end (formatted `Apr 1 – Jun 30`) · `memberships?.length` members · progress bar (not computed per-cycle server-side; show `–` or compute client-side from avg ranking — simple: just show member count for now).
- Row click goes to `/admin/cycle/<id>` (already built in PR 3a).
- Each row has an `Archive` button (right-most) — calls `useArchiveCycle` with a confirm.

**Modal:** 3 fields — name, startsAt, endsAt. date inputs. Submit calls `useCreateCycle`.

- [ ] **Steps 1-2:** Implement modal + page.

- [ ] **Step 3:** Commit

```bash
git add 'apps/web/app/(admin)/admin/cycles' apps/web/components/admin/cycles/new-cycle-modal.tsx
git commit -m "feat(web): /admin/cycles list + New cycle modal + Archive"
```

---

### Task 8: `/admin/library` list page with filters + new item + topics modal

**Files:**
- Create: `apps/web/components/admin/library/filters-bar.tsx`
- Create: `apps/web/components/admin/library/new-item-modal.tsx`
- Create: `apps/web/components/admin/library/topics-modal.tsx`
- Create: `apps/web/app/(admin)/admin/library/page.tsx`

**Design:**

- H1 "Library".
- Toolbar right: `Manage topics →` (opens topics modal), `+ New item` (opens new item modal).
- Search input at top with 300ms debounce.
- `FiltersBar` below search: 4 multi-select chips (format, difficulty, tracks, topic). Clicking a chip toggles it.
- Items table: 3px colored left border (platform color — use `platform.ts` helper at `apps/web/lib/format/platform.ts` already in place), title (serif-tool semibold), topic label (mono), tracks as pills, format + difficulty + minutes mono, createdAt (relative), edit / delete actions.

**new-item-modal.tsx:** modal with 2 tabs (Manual / Import URL).
- Manual tab: form (title, url, description, format, difficulty, estimatedMinutes, topicId, tracks, tags).
- Import URL tab: URL input → `Fetch metadata` → preview fields extracted from `POST /library/import` → admin can edit → `Save` creates the item.

**topics-modal.tsx:** list of topics. Each row: slug mono + label editable + delete. `+ Add topic` at bottom.

- [ ] **Steps 1-4:** Implement the 4 files.

- [ ] **Step 5:** Typecheck + commit

```bash
git add 'apps/web/app/(admin)/admin/library' apps/web/components/admin/library
git commit -m "feat(web): /admin/library list + filters + new item (manual/import) + topics modal"
```

---

### Task 9: `/admin/ai-usage` page

**Files:**
- Create: `apps/web/app/(admin)/admin/ai-usage/page.tsx`

**Design:**

- H1 "AI usage".
- Tabs / segmented control for range: 7d / 30d / 90d.
- Summary row: 3 stat cards (`Period cost` big mono, `Total tokens` big mono, `Call count` big mono).
- Simple daily bar chart (CSS-only — no chart lib). Each bar's height proportional to that day's cost. Below: date labels mono.
- Table: `purpose · model · prompt tokens · response tokens · cost usd · createdAt` — limit rows (say 50) and have a client-side paginator if needed.

- [ ] **Step 1:** Implement page.

- [ ] **Step 2:** Typecheck + commit

```bash
git add 'apps/web/app/(admin)/admin/ai-usage'
git commit -m "feat(web): /admin/ai-usage (summary cards + daily bars + usage table)"
```

---

### Task 10: Cycle page classes extension

**Files:**
- Create: `apps/web/components/admin/cycles/classes-section.tsx`
- Create: `apps/web/components/admin/cycles/schedule-class-modal.tsx`
- Create: `apps/web/components/admin/cycles/attendance-modal.tsx`
- Modify: `apps/web/app/(admin)/admin/cycle/[id]/page.tsx` (append `<ClassesSection cycleId={data.cycle.id} members={data.members} />` below the heatmap)

**Design:**

- `ClassesSection`: `SectionLabel` "Classes · N" + `+ Schedule class` button. List of sessions — each row with date/time, title, topic pill, duration, `Take attendance →` button.
- `ScheduleClassModal`: form (title, topic, scheduledAt, durationMin, notes). Submit calls `useScheduleClass`.
- `AttendanceModal`: grid of members. For each: avatar + name + 3-button segmented control (PRESENT/LATE/ABSENT). Save batches via `useSubmitAttendance`.

- [ ] **Steps 1-4:** Implement.

- [ ] **Step 5:** Typecheck + build + commit

```bash
git add 'apps/web/app/(admin)/admin/cycle' apps/web/components/admin/cycles/classes-section.tsx apps/web/components/admin/cycles/schedule-class-modal.tsx apps/web/components/admin/cycles/attendance-modal.tsx
git commit -m "feat(web): cycle page classes section + schedule + attendance modals"
```

---

### Task 11: Final regression gate

- [ ] **Step 1:** Run all gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: API tests ~170+ (166 + T1 notes tests + T3 member-detail tests), web build includes new routes.

- [ ] **Step 2:** Verify new routes in web build output

```
/admin/members
/admin/library
/admin/cycles
/admin/ai-usage
/admin/member/[id]
```

- [ ] **Step 3:** Spot-check in dev

Start `pnpm dev`, log in as admin, click through:
- `/admin/members` → click a row → lands on `/admin/member/<id>` → switch tabs.
- `/admin/library` → click `+ New item` → Manual tab → create → row appears. Click `Manage topics →`.
- `/admin/cycles` → `+ New cycle` → submit → row appears.
- `/admin/ai-usage` → summary cards render with real data.
- `/admin/cycle/<id>` → classes section appears below heatmap.

- [ ] **Step 4:** Capture commit list + report.

```bash
git log --oneline main..HEAD
```

---

## Self-review

**Spec coverage:**
- §5.3 Member detail: Tasks 3, 5 ✅
- §5.5 Library: Tasks 4 (hooks), 8 ✅
- §5.6 Cycles: Tasks 4, 7 ✅
- §5.7 AI usage: Tasks 4, 9 ✅
- §5.2 cycle page classes extension: Task 10 ✅
- AdminNote CRUD: Tasks 1, 2 ✅

**Placeholder scan:**
- `Export data` button in member detail is a no-op stub (PR 4).
- Cycle row "progress avg" is shown as member count only (simpler than computing per-cycle aggregate server-side; acceptable for list overview).

**Type consistency:**
- `MemberDetailResponse` in `admin-member.ts` matches backend shape from Task 3.
- `AdminNote.createdAt` in hook is `string` (backend returns ISO).
- `CycleRow` in `admin-cycles.ts` optional `_count.memberships` matches what `CyclesService.list` already returns (`include: { _count: { select: { memberships: true } } }`).
- `ClassSession` in hooks mirrors the Prisma model at `packages/prisma/prisma/schema.prisma` (verify field names — especially `durationMin` vs `duration`).

**Ambiguities flagged:**
- `Cycle._count.memberships` — `CyclesService.list` currently includes it; confirm during Task 7. If absent, hook gracefully handles `_count?: ...`.
- `ClassSession` fields — verify schema; the existing `classes.service.spec.ts` and controller DTO `CreateClassSchema` will confirm field names (`durationMin` is the existing name).
- Markdown rendering in diagnose tab — deliberately minimal (paragraph-only) to avoid adding `react-markdown` dep. Acceptable.
- Member detail route collision with `plan-context`: confirmed independent in NestJS routing; double-check after wiring.

**Out-of-scope deferred:**
- Tool calling — PR 4.
- `Export data` — PR 4.
- Retro cron — PR 4.
- WhatsApp purge cron — PR 4.
- Admin chat UI — PR 4 if needed.
- Legacy `(app)/admin/*` deletion — small cleanup PR after 3c.
