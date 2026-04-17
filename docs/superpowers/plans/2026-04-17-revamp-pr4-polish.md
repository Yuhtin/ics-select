# PR 4 — Polish: Tool Calling · Retro Cron · WhatsApp Purge · Library Edit (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Close the remaining feature gaps. Tool calling in `DraftPlanService` so the LLM can query the library on-demand. `RetroCron` sends WhatsApp reminders when the Fri retro window opens. `WhatsappLogPurgeCron` wipes 90+ day logs for privacy. Library items become editable via a proper modal. Triage alerts learn how to compose real WhatsApp links. Everything else from the spec that wasn't in PRs 3a/3b/3c lands here.

**Architecture:**

- **Tool calling** — extend `OpenAiChatProvider` with `callJsonWithTools<T>({ system, messages, tools, executeTool, maxIterations })` that iterates until the model returns content. Each tool call executes server-side via the `executeTool` callback; the result goes back to the model as a `role: tool` message. `DraftPlanService` exposes `search_library` as a tool so the LLM pulls candidates on demand instead of seeing a pre-fetched static list. Usage logging aggregates tokens across all iterations.
- **Retro cron** — `RetroCron` runs every 10 minutes. For each member whose local time just crossed Fri 18:00 in their `MemberAvailability.timezone`, dispatch a WhatsApp reminder. Idempotent via a new `RetroReminderSent { userId, weekStart } @@unique([userId, weekStart])` row — if already recorded for this Friday, skip. Tolerant to per-member failures.
- **WhatsApp log purge** — `WhatsappPurgeCron` at 03:00 UTC daily. Deletes `WhatsappLog` rows older than 90 days. Small, safe, privacy-aligned.
- **Library edit modal** — extend the existing `NewItemModal` into `ItemFormModal` that handles both create + edit. Library rows invoke it on `edit`.
- **Triage WhatsApp wiring** — `TriageService` response includes `member.whatsappPhone` (hashed/formatted for wa.me); `TriageAlertRow` composes `https://wa.me/<digits>?text=<template>` instead of `#`.
- **Cohort page (members → cycle view)** — the sidebar "Members" nav currently points to `/admin/members` which shows the cross-cycle list. That's fine. No new work here.

**Tech stack:** NestJS 10 + Prisma 5 · Next.js 15 App Router + TanStack Query · `@nestjs/schedule` (already in deps) · existing `WhatsappService` + `GoogleCalendarService` · OpenAI chat completions tool calling.

**Reference spec:** `docs/superpowers/specs/2026-04-16-revamp-design.md` §5.4 (tool calling), §9 (privacy/retention), plus cascading UX mentions of retro + WhatsApp.

**Out of scope (accepted gaps):**

- **Export member data** button — acknowledged stub. Tracked as a nice-to-have for whenever a stakeholder actually asks.
- **Drag-and-drop reorder** on `EditablePlanPanel` — the `↑/↓` buttons ship.
- **Admin chat UI** — backend service exists but there's no UI demand yet.
- **Cohort nav tab** — the previous Cohort/Plans dead links are already fixed in PR 3c cleanup.

---

## Migration required

We need a new `RetroReminderSent` table. Add a Prisma migration:

```prisma
model RetroReminderSent {
  id        String   @id @default(cuid())
  userId    String
  weekStart DateTime
  sentAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart])
  @@index([weekStart])
}
```

The migration name: `12_retro_reminder_sent`. Follow the existing numbered-migration pattern under `packages/prisma/prisma/migrations/`.

---

## File Structure

### Created (Backend)

- `packages/prisma/prisma/migrations/12_retro_reminder_sent/migration.sql`
- `apps/api/src/common/openai/tool-calling.ts` (helper types + the new `callJsonWithTools` orchestrator)
- `apps/api/src/common/openai/openai-chat.provider.spec.ts` (cover the new method — file may not exist yet; create if missing)
- `apps/api/src/notifications/retro.cron.ts`
- `apps/api/src/notifications/retro.cron.spec.ts`
- `apps/api/src/notifications/whatsapp-purge.cron.ts`
- `apps/api/src/notifications/whatsapp-purge.cron.spec.ts`
- `apps/api/src/ai/library-tool.ts` (defines the `search_library` tool schema + executor)
- `apps/api/src/ai/library-tool.spec.ts`

### Modified (Backend)

- `packages/prisma/prisma/schema.prisma` (add `RetroReminderSent` model)
- `apps/api/src/common/openai/openai-chat.provider.ts` (add `callJsonWithTools`)
- `apps/api/src/ai/draft-plan.service.ts` (use tool calling; expose `search_library` as a tool; drop pre-fetched candidate inlining)
- `apps/api/src/ai/draft-plan.service.spec.ts`
- `apps/api/src/notifications/notifications.module.ts` (register new crons)
- `apps/api/src/admin/triage/triage.service.ts` (add `member.whatsappPhone` to alert response)
- `apps/api/src/admin/triage/triage.service.spec.ts`

### Modified (Frontend)

- `apps/web/lib/queries/admin-triage.ts` (type: `member` includes `whatsappPhone`)
- `apps/web/components/admin/triage-alert-row.tsx` (compose real `wa.me` URL from the phone)
- `apps/web/components/admin/library/new-item-modal.tsx` → rename to `apps/web/components/admin/library/item-form-modal.tsx` (unify create + edit)
- `apps/web/app/(admin)/admin/library/page.tsx` (wire the `edit` button to the new modal; replace the stub alert)

---

## Tasks

### Task 1: Prisma migration + schema for `RetroReminderSent`

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma`
- Create: `packages/prisma/prisma/migrations/12_retro_reminder_sent/migration.sql`

- [ ] **Step 1:** Append to `schema.prisma` right after `DismissedAlert`:

```prisma
model RetroReminderSent {
  id        String   @id @default(cuid())
  userId    String
  weekStart DateTime
  sentAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart])
  @@index([weekStart])
}
```

Also add `retroRemindersSent RetroReminderSent[]` to the `User` model under the existing relations (keep alphabetic grouping).

- [ ] **Step 2:** Create the migration SQL:

```sql
-- packages/prisma/prisma/migrations/12_retro_reminder_sent/migration.sql
CREATE TABLE "RetroReminderSent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetroReminderSent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetroReminderSent_userId_weekStart_key" ON "RetroReminderSent"("userId", "weekStart");
CREATE INDEX "RetroReminderSent_weekStart_idx" ON "RetroReminderSent"("weekStart");

ALTER TABLE "RetroReminderSent" ADD CONSTRAINT "RetroReminderSent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3:** Regenerate the Prisma client

```bash
pnpm db:generate
```

- [ ] **Step 4:** Commit

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/12_retro_reminder_sent
git commit -m "feat(prisma): RetroReminderSent idempotency table"
```

---

### Task 2: Add `callJsonWithTools` to `OpenAiChatProvider`

**Files:**
- Create: `apps/api/src/common/openai/tool-calling.ts`
- Modify: `apps/api/src/common/openai/openai-chat.provider.ts`
- Create: `apps/api/src/common/openai/openai-chat.provider.spec.ts`

**Goal:** A new provider method that iterates through model-tool turns until the model returns a final `content` payload. Returns parsed JSON + aggregated usage across all iterations.

- [ ] **Step 1:** Write the helper types in `tool-calling.ts`:

```ts
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
};

export type ToolExecutor = (
  name: string,
  args: unknown,
) => Promise<unknown>;

export type ToolCall = {
  id: string;
  name: string;
  args: unknown;
};
```

- [ ] **Step 2:** Extend `openai-chat.provider.ts` with the new method. The signature:

```ts
async callJsonWithTools<T>(input: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: ToolDefinition[];
  executeTool: ToolExecutor;
  maxIterations?: number;  // default 5
  maxTokens?: number;       // default 2048
}): Promise<{ data: T; usage: Usage; toolCalls: ToolCall[] }>
```

Implementation skeleton:

```ts
async callJsonWithTools<T>(input) {
  const maxIter = input.maxIterations ?? 5;
  const openaiMessages: any[] = [
    { role: 'system', content: input.system },
    ...input.messages,
  ];
  const openaiTools = input.tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const toolCalls: ToolCall[] = [];
  const totalUsage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

  for (let iter = 0; iter < maxIter; iter += 1) {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: input.maxTokens ?? 2048,
      messages: openaiMessages,
      tools: openaiTools,
      // Last iteration: force content by removing tools so model must answer
      response_format: iter === maxIter - 1 ? { type: 'json_object' } : undefined,
    });

    const usage = toUsage(response.usage);
    totalUsage.inputTokens += usage.inputTokens;
    totalUsage.outputTokens += usage.outputTokens;
    totalUsage.costUsd += usage.costUsd;

    const message = response.choices[0]?.message;
    if (!message) throw new Error('OpenAI returned no message');

    // If the model returned tool calls, execute them and loop
    if (message.tool_calls && message.tool_calls.length > 0) {
      openaiMessages.push(message);  // echo assistant tool_call message
      for (const call of message.tool_calls) {
        const name = call.function.name;
        const argString = call.function.arguments ?? '{}';
        let parsedArgs: unknown;
        try { parsedArgs = JSON.parse(argString); } catch { parsedArgs = {}; }
        toolCalls.push({ id: call.id, name, args: parsedArgs });
        const result = await input.executeTool(name, parsedArgs);
        openaiMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result ?? null),
        });
      }
      continue;
    }

    // Model returned final content
    const content = message.content;
    if (!content) throw new Error('OpenAI returned no content after iteration ' + iter);
    const data = JSON.parse(content) as T;
    return { data, usage: totalUsage, toolCalls };
  }

  throw new Error(`Tool-calling loop exceeded ${maxIter} iterations`);
}
```

**Note:** If the OpenAI SDK type rejects the mixed `tools` + `response_format` combo, drop `response_format` on intermediate iterations and only add it on the final iteration (already shown above).

- [ ] **Step 3:** Write `openai-chat.provider.spec.ts`. Mock `this.client.chat.completions.create` with a jest fn that returns distinct responses for sequential calls. Required tests:

1. Calls the model once, returns content → returns parsed data + usage.
2. Model returns a tool call → executor runs → model called again with `role: tool` message → returns final content.
3. Aggregates usage across iterations.
4. Throws after `maxIterations` if never gets content.

Use `as any` liberally — the OpenAI response types are deep; we only need a minimal shape per test.

Sample test for (2):

```ts
it('iterates through a tool call and returns final data', async () => {
  const client = { chat: { completions: { create: jest.fn() } } };
  client.chat.completions.create
    .mockResolvedValueOnce({
      choices: [{ message: { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search_library', arguments: '{"query":"dp"}' } }] } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    } as any)
    .mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ items: [{ id: 'li-1' }] }) } }],
      usage: { prompt_tokens: 80, completion_tokens: 40 },
    } as any);
  const executor = jest.fn(async () => ({ items: [{ id: 'li-1', title: 'DP intro' }] }));
  const svc = new OpenAiChatProvider(client as any);
  const res = await svc.callJsonWithTools<{ items: Array<{ id: string }> }>({
    system: 'sys',
    messages: [{ role: 'user', content: 'pick dp items' }],
    tools: [{ name: 'search_library', description: 'Search library', parameters: { type: 'object', properties: { query: { type: 'string' } } } }],
    executeTool: executor,
  });
  expect(executor).toHaveBeenCalledWith('search_library', { query: 'dp' });
  expect(res.data.items[0]!.id).toBe('li-1');
  expect(res.toolCalls[0]!.name).toBe('search_library');
  expect(res.usage.inputTokens).toBe(180);
  expect(res.usage.outputTokens).toBe(60);
});
```

- [ ] **Step 4:** Run + commit

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
git add apps/api/src/common/openai
git commit -m "feat(openai): callJsonWithTools — iterative tool calling orchestrator"
```

---

### Task 3: Define `search_library` tool + executor

**Files:**
- Create: `apps/api/src/ai/library-tool.ts`
- Create: `apps/api/src/ai/library-tool.spec.ts`

**Goal:** Package the `search_library` tool definition + a bound executor that calls `LibraryService.search`. The `DraftPlanService` (Task 4) wires this up.

- [ ] **Step 1:** Implement

```ts
// apps/api/src/ai/library-tool.ts
import type { ToolDefinition, ToolExecutor } from '../common/openai/tool-calling.js';
import type { LibraryService } from '../library/library.service.js';

export const searchLibraryTool: ToolDefinition = {
  name: 'search_library',
  description: 'Search the ICS Select library by query and optional filters. Returns up to 20 candidate items the admin can add to a weekly plan. Use this to find items that match the member\'s needs (e.g. a DP topic, a specific format, a track).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Free-text search term.' },
      format: { type: 'array', items: { type: 'string', enum: ['VIDEO', 'ARTICLE', 'BOOK', 'PROBLEM', 'OTHER'] } },
      difficulty: { type: 'array', items: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] } },
      tracks: { type: 'array', items: { type: 'string', enum: ['BIG_TECH', 'CONSULTING_TECH', 'COMPETITIVE_PROGRAMMING', 'STARTUP', 'OTHER'] } },
      topicId: { type: 'string' },
      maxMinutes: { type: 'number' },
    },
  },
};

export function makeLibraryToolExecutor(library: LibraryService): ToolExecutor {
  return async (name, args) => {
    if (name !== 'search_library') throw new Error(`Unknown tool: ${name}`);
    const input = (args ?? {}) as {
      query?: string;
      format?: string[];
      difficulty?: string[];
      tracks?: string[];
      topicId?: string;
      maxMinutes?: number;
    };
    const results = await library.search({ ...input, limit: 20 });
    // Trim to a compact shape the LLM needs: id + title + format + difficulty + minutes + topic
    return (results as any[]).map((r) => ({
      id: r.id,
      title: r.title,
      format: r.format,
      difficulty: r.difficulty,
      estimatedMinutes: r.estimatedMinutes,
      topicId: r.topicId ?? null,
      tracks: r.tracks ?? [],
    }));
  };
}
```

- [ ] **Step 2:** Spec covers:
1. `searchLibraryTool` has the expected shape (`name`, `description`, `parameters.properties.query`, etc).
2. Executor calls `library.search` with the passed args + `limit: 20`.
3. Executor throws on unknown tool names.
4. Executor trims response to the compact shape (no `description`, no `tags`, no `url`).

Mock `library.search` with a jest.fn().

- [ ] **Step 3:** Commit

```bash
git add apps/api/src/ai/library-tool.ts apps/api/src/ai/library-tool.spec.ts
git commit -m "feat(ai): search_library tool definition + executor"
```

---

### Task 4: Switch `DraftPlanService` to tool calling

**Files:**
- Modify: `apps/api/src/ai/draft-plan.service.ts`
- Modify: `apps/api/src/ai/draft-plan.service.spec.ts`

**Goal:** Replace the pre-fetched candidate pool with tool calling. The LLM now queries `search_library` on demand during generation. Carry-over items are still pre-resolved (we must include them) but the generic candidate pool is gone from the prompt.

- [ ] **Step 1:** Refactor `run()`:

Keep all context gathering (member, last 4 weeks, retro, topic coverage, carry-overs). Remove the candidate pool pre-fetch. Build the same user prompt sections EXCEPT the `CANDIDATOS DO ACERVO:` block — instead, tell the model: "Use a ferramenta search_library pra encontrar candidatos no acervo."

Replace `this.chat.callJson(...)` with `this.chat.callJsonWithTools(...)` using `searchLibraryTool` and the executor from Task 3.

Still pre-pend carry-over items' data inline in a `CARRY-OVER RESOLVIDO:` block so the model knows their IDs without needing a tool call (it can still verify via search_library if it wants).

```ts
import { searchLibraryTool, makeLibraryToolExecutor } from './library-tool.js';

// inside run():
const executor = makeLibraryToolExecutor(this.library);
const result = await this.chat.callJsonWithTools<Draft>({
  system,
  messages: [{ role: 'user', content: userPrompt }],
  tools: [searchLibraryTool],
  executeTool: executor,
  maxIterations: 5,
  maxTokens: 2500,
});

await this.usage.log({
  userId: input.memberId,
  purpose: 'draft_plan',
  model: MODEL,
  usage: result.usage,
  metadata: {
    weekStart: input.weekStart.toISOString(),
    carryOverCount: input.carryOverItemIds?.length ?? 0,
    hasBrief: !!input.briefText,
    toolCalls: result.toolCalls.length,
  },
});

return { draft: result.data, usage: result.usage };
```

Update the system prompt to reference the tool:

```
Você é o copiloto do Diretor Educacional do ICS Select. ...

Use a ferramenta `search_library` pra encontrar itens no acervo. Chame-a múltiplas vezes se precisar
diversificar tópicos. Depois de reunir candidatos suficientes (4-7 bons itens), responda com JSON.
Não invente IDs — só use IDs que vieram de search_library ou do bloco CARRY-OVER RESOLVIDO.
```

- [ ] **Step 2:** Update the spec. The test fixture now needs to mock `callJsonWithTools` on the chat provider. The executor is bound internally via `makeLibraryToolExecutor`, so tests can mock `library.search` and then assert that when `callJsonWithTools` invokes the `executeTool` callback, it ultimately calls `library.search`.

Simpler approach: mock `chat.callJsonWithTools` directly (same pattern as before). The test doesn't exercise the tool call path — that's covered by Task 2's spec. Tests here assert:

1. `callJsonWithTools` is called with expected system, user prompt containing track/retro/carry-over/brief.
2. Tools list includes `searchLibraryTool`.
3. Returns `{ draft, usage }` with `alternates` defaulted to `[]`.
4. Usage log includes `toolCalls: <n>`.

- [ ] **Step 3:** Run + commit

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
git add apps/api/src/ai/draft-plan.service.ts apps/api/src/ai/draft-plan.service.spec.ts
git commit -m "feat(ai): DraftPlanService uses tool calling (search_library on-demand)"
```

---

### Task 5: RetroCron — Friday 18:00 WhatsApp reminder

**Files:**
- Create: `apps/api/src/notifications/retro.cron.ts`
- Create: `apps/api/src/notifications/retro.cron.spec.ts`
- Modify: `apps/api/src/notifications/notifications.module.ts`

**Goal:** Every 10 minutes, iterate members. For each, compute their local weekday + local time from `MemberAvailability.timezone`. If local is Fri between 18:00 and 18:10, and no `RetroReminderSent` row exists for `(userId, weekStartOfCurrentWeek)`, send a WhatsApp message and record the row.

**Week start helper**: Monday 00:00 UTC of the current week — same `mondayUTC` logic used across the codebase.

- [ ] **Step 1:** Implement the cron:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';

const FRIDAY = 5;

@Injectable()
export class RetroCron {
  private readonly logger = new Logger(RetroCron.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(now: Date = new Date()): Promise<void> {
    const weekStart = this.mondayUTC(now);

    // Members with both a phone AND an availability row (for timezone lookup)
    const members = await this.prisma.user.findMany({
      where: {
        role: 'MEMBER',
        whatsappPhone: { not: null },
      },
      select: {
        id: true,
        name: true,
        whatsappPhone: true,
        availability: { select: { timezone: true } },
      },
    });

    for (const member of members) {
      const tz = member.availability?.timezone ?? 'America/Sao_Paulo';
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'short',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        }).formatToParts(now);
        const weekday = parts.find((p) => p.type === 'weekday')?.value;
        const hour = Number(parts.find((p) => p.type === 'hour')?.value);
        const minute = Number(parts.find((p) => p.type === 'minute')?.value);
        if (weekday !== 'Fri') continue;
        if (hour !== 18 || minute >= 10) continue;

        const existing = await this.prisma.retroReminderSent.findUnique({
          where: { userId_weekStart: { userId: member.id, weekStart } },
        });
        if (existing) continue;

        const firstName = member.name?.split(' ')[0] ?? '';
        const text = `Oi ${firstName}, seu retrô da semana abriu. 3 perguntas rápidas, leva 5 min.`;
        await this.whatsapp.send({
          userId: member.id,
          kind: 'plan_published',    // reuse existing kind; or add 'retro_open' in a later schema tweak
          to: member.whatsappPhone!,
          text,
        }).catch((err) => {
          this.logger.warn(`retro reminder failed for ${member.id}: ${String(err)}`);
        });

        await this.prisma.retroReminderSent.create({
          data: { userId: member.id, weekStart },
        });
      } catch (err) {
        this.logger.warn(`retro cron: skipped member ${member.id}: ${String(err)}`);
      }
    }
  }

  private mondayUTC(now: Date): Date {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }
}
```

**Kind note:** `WhatsappService.send` requires `kind: 'session_reminder' | 'stuck_alert' | 'plan_published' | 'test'`. Rather than broaden the enum inside this PR, reuse `plan_published` — semantically close enough ("something new is available"). The log payload still records everything. If we want a dedicated `retro_open` kind, add it in a later schema tweak.

- [ ] **Step 2:** Register in `notifications.module.ts`:

```ts
@Module({
  imports: [ScheduleModule.forRoot(), WhatsappModule, GoogleCalendarModule],
  providers: [RemindersCron, RetroCron, WhatsappPurgeCron],  // WhatsappPurgeCron added in Task 6
})
export class NotificationsModule {}
```

(For now, only add `RetroCron`; `WhatsappPurgeCron` is added in Task 6.)

- [ ] **Step 3:** Tests:

1. Sends a WhatsApp message + creates a `RetroReminderSent` row when a member is at Fri 18:05 local.
2. Skips a member whose local is Fri 18:30 (window passed).
3. Skips a member whose local is Thu 18:05 (wrong day).
4. Skips a member who already has a `RetroReminderSent` row for this week.
5. Continues iterating when one member's availability lookup / WhatsApp call throws.
6. Uses `America/Sao_Paulo` fallback when `availability` is null.

Mock `Intl.DateTimeFormat` indirectly by choosing `now` values in different timezones. Best: parameterize timezone explicitly. For tests, set `now = new Date('2026-04-17T21:05:00Z')` — that's Fri 18:05 in São Paulo (UTC-3), so hits the window.

For the "already sent" case, seed `prisma.retroReminderSent.findUnique` to return a row.

Test pattern matches `reminders.cron.spec.ts`.

- [ ] **Step 4:** Run + commit

```bash
pnpm --filter @ics-select/api test -- --testPathPattern retro.cron
pnpm --filter @ics-select/api typecheck
git add apps/api/src/notifications/retro.cron.ts apps/api/src/notifications/retro.cron.spec.ts apps/api/src/notifications/notifications.module.ts
git commit -m "feat(notifications): RetroCron — Fri 18h WhatsApp reminder with idempotency"
```

---

### Task 6: WhatsappPurgeCron — delete 90+ day logs daily

**Files:**
- Create: `apps/api/src/notifications/whatsapp-purge.cron.ts`
- Create: `apps/api/src/notifications/whatsapp-purge.cron.spec.ts`
- Modify: `apps/api/src/notifications/notifications.module.ts` (register provider)

- [ ] **Step 1:** Implement:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service.js';

const RETENTION_DAYS = 90;

@Injectable()
export class WhatsappPurgeCron {
  private readonly logger = new Logger(WhatsappPurgeCron.name);
  constructor(private readonly prisma: PrismaService) {}

  // Every day at 03:10 UTC (off-peak)
  @Cron('10 3 * * *')
  async purge(now: Date = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.whatsappLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(`whatsapp-purge: deleted ${count} logs older than ${RETENTION_DAYS}d`);
    }
  }
}
```

Check the actual field name used on `WhatsappLog` for the timestamp — either `createdAt`, `sentAt`, or `deliveredAt`. Inspect `packages/prisma/prisma/schema.prisma` first and adapt.

- [ ] **Step 2:** Register in `notifications.module.ts`.

- [ ] **Step 3:** Spec (2 tests):
1. Calls `deleteMany` with cutoff = `now - 90 days`.
2. Logs the count when > 0.

- [ ] **Step 4:** Commit

```bash
git add apps/api/src/notifications/whatsapp-purge.cron.ts apps/api/src/notifications/whatsapp-purge.cron.spec.ts apps/api/src/notifications/notifications.module.ts
git commit -m "feat(notifications): WhatsappPurgeCron — 90-day retention"
```

---

### Task 7: Wire phone into `TriageService` + frontend wa.me link

**Files:**
- Modify: `apps/api/src/admin/triage/triage.service.ts`
- Modify: `apps/api/src/admin/triage/triage.service.spec.ts`
- Modify: `apps/web/lib/queries/admin-triage.ts`
- Modify: `apps/web/components/admin/triage-alert-row.tsx`

**Goal:** Alerts already include `member.{id, name, pictureUrl}`. Add `whatsappPhone: string | null` and wire the frontend to compose `https://wa.me/<digits>?text=<url-encoded template>`.

- [ ] **Step 1:** Backend:

- In `TriageService`, when building each alert's `member` object, include `whatsappPhone` from the user row. The cycle membership query already includes `user` — extend the `select` to fetch `whatsappPhone: true` alongside `id, name, pictureUrl`.
- Update the `TriageAlert.member` type in the response.
- Update existing spec tests that assert the `member` shape — they need the extra field (or at least not reject it).

- [ ] **Step 2:** Frontend types:

```ts
// admin-triage.ts — update TriageAlert.member
member: { id: string; name: string; pictureUrl: string | null; whatsappPhone: string | null };
```

Also update `CohortStripEntry` if you exposed `whatsappPhone` there too (no — keep cohort strip simple).

- [ ] **Step 3:** `triage-alert-row.tsx`:

In `actionsFor(alert)`, replace the `wa.me '#'` placeholder with a real URL:

```tsx
function waUrl(phone: string | null, text: string): string {
  if (!phone) return '#';
  const digits = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
```

And use `waUrl(alert.member.whatsappPhone, composeTemplate(alert))` where `composeTemplate` returns a short context-aware message:

```ts
function composeTemplate(alert: TriageAlert): string {
  switch (alert.type) {
    case 'DISAPPEARED':
      return `Oi ${alert.member.name.split(' ')[0]}, tá tudo bem? Notei que sumiu dos estudos esta semana.`;
    case 'SKIPPED_RETROS':
      return `Oi ${alert.member.name.split(' ')[0]}, sente falta dos retrôs — bora fechar essa semana?`;
    case 'STUCK_RECENT':
    case 'STUCK_REPEATEDLY':
      return `Oi ${alert.member.name.split(' ')[0]}, vi que travou em algum item. Me fala o que aconteceu?`;
    default:
      return `Oi ${alert.member.name.split(' ')[0]},`;
  }
}
```

Disable the WhatsApp action when `whatsappPhone === null`. The safest UX: render a disabled span with muted styling instead of the link.

- [ ] **Step 4:** Run + commit

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
git add apps/api/src/admin/triage apps/web/lib/queries/admin-triage.ts apps/web/components/admin/triage-alert-row.tsx
git commit -m "feat(admin): triage alerts include member.whatsappPhone + frontend composes wa.me links"
```

---

### Task 8: Library edit modal — unify create + edit

**Files:**
- Move: `apps/web/components/admin/library/new-item-modal.tsx` → `apps/web/components/admin/library/item-form-modal.tsx` (rename + generalize)
- Modify: `apps/web/app/(admin)/admin/library/page.tsx`

**Goal:** One modal component that handles both create and edit. The library page wires the `edit` button to open it pre-populated with the item, and `+ New item` opens it blank.

- [ ] **Step 1:** Rename + widen the component.

The new `ItemFormModal` takes:

```ts
interface ItemFormModalProps {
  open: boolean;
  initial?: AdminLibraryItem | null;  // undefined/null → create mode
  onClose: () => void;
}
```

Inside:
- If `initial` is present, seed state from it; the title header becomes `Edit library item`.
- Save button calls `useUpdateLibraryItem` when `initial` present, else `useCreateLibraryItem`.
- Import URL tab is still available when `initial` is null — hide it in edit mode (you can't re-import an existing item).

- [ ] **Step 2:** Wire the library page:

```ts
const [editing, setEditing] = useState<AdminLibraryItem | null>(null);
const [formOpen, setFormOpen] = useState(false);

// the `edit` button on each row:
<button onClick={() => { setEditing(item); setFormOpen(true); }}>
```

The modal:

```tsx
<ItemFormModal
  open={formOpen}
  initial={editing}
  onClose={() => {
    setFormOpen(false);
    setEditing(null);
  }}
/>
```

`+ New item` button sets `editing = null` before opening.

- [ ] **Step 3:** Run + commit

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
git add apps/web/components/admin/library apps/web/app/(admin)/admin/library
git commit -m "feat(web): unified ItemFormModal handles both create + edit for library"
```

---

### Task 9: Final regression gate

- [ ] **Step 1:** Run all gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected:
- API tests ~185+ (180 prior + new retro cron + whatsapp purge + tool calling + library-tool tests).
- Web build green.

- [ ] **Step 2:** Verify routes + commit list

```bash
git log --oneline main..HEAD
```

- [ ] **Step 3:** Report.

---

## Self-review

**Spec coverage:**
- §5.4 tool calling for DraftPlanService: Tasks 2, 3, 4 ✅
- §9 WhatsApp 90d retention: Task 6 ✅
- Retro Fri 18h: Tasks 1, 5 ✅
- Library edit (gap from PR 3c): Task 8 ✅
- Triage real wa.me links: Task 7 ✅

**Placeholder scan:**
- `plan_published` kind reuse for retro reminders in Task 5 — documented as a pragmatic choice. Adding a dedicated `retro_open` kind would require a trivial `WhatsappKind` enum extension if we care later.

**Type consistency:**
- `ToolCall`, `ToolExecutor`, `ToolDefinition` in `tool-calling.ts` are the single source used by both the provider and the `library-tool`.
- `AdminTriageResponse.alerts[].member.whatsappPhone` flows through hook → component.
- `useUpdateLibraryItem` vs `useCreateLibraryItem` branches in the unified modal.

**Ambiguities flagged:**
- Whether to move `availability` relation fetching into the cron query — doing it inline in Task 5's code saves a round-trip but requires the `MemberAvailability` model to be eagerly loadable from `User`. Verify the Prisma relation is set up — if not, fallback to a two-step fetch (users first, then availability map).
- `WhatsappLog` timestamp field name — check schema before Task 6 impl.

**Out of scope correctly deferred:**
- Drag-drop reorder — intentional.
- Admin chat UI — intentional.
- `retro_open` WhatsApp kind enum — intentional reuse.
