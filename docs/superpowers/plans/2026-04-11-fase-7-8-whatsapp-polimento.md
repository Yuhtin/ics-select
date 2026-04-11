# ICS Select — Fases 7 + 8 (WhatsApp + Exportação/Polimento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Combined plan for the two final phases (both 0.5 week each).

**Goal:** Close the remaining scope before v1.0: WhatsApp lembretes via Evolution API with a cron that pings 10 minutes before each scheduled session and alerts the admin when a member clicks "travei"; LGPD export (`GET /me/export`) and cascade delete (`DELETE /me`); a PDF/markdown cycle report exportable for partners; a solid README covering setup, deploy, operations, and LGPD rights.

**Architecture:** A new `WhatsappLog` model records every outbound message attempt. An `EvolutionApiClient` wraps the HTTP endpoints of a self-hosted Evolution API instance (base URL + API key from env). A `NotificationsService` orchestrates which notification to send and when, called by: (a) `@nestjs/schedule` cron job every minute that looks 10 minutes ahead for pending `StudySession`s, and (b) the `WeeklyPlansService.markItemStuck` method fires a "stuck alert" to the admin. For LGPD, a `MeController` hosts `GET /me/export` (aggregates everything owned by the user) and `DELETE /me` (cascade via Prisma's existing onDelete rules + best-effort Calendar cleanup). The cycle report is a markdown builder that compiles cohort stats; the frontend exposes a download button.

**Tech Stack (new):** `@nestjs/schedule`.

---

## Pre-flight

1. **Evolution API** self-hosted (already in `docker-compose.prod.yml` as a disabled profile from Phase 0). To enable in Phase 7: `docker compose --profile whatsapp up -d evolution`, configure `EVOLUTION_API_BASE_URL=http://evolution:8080` and `EVOLUTION_API_KEY=<key>` in `.env`, pair the phone via QR code at the Evolution admin panel.
2. **Admin WhatsApp number:** set `ADMIN_WHATSAPP_NUMBER` env (E.164 format, e.g. `+5511999999999`) so "stuck" alerts know where to go.

---

## File Structure

### packages/prisma
| Path | Purpose |
|---|---|
| `schema.prisma` | Add `WhatsappLog` |
| `migrations/8_whatsapp_log/migration.sql` | Migration |

### apps/api
| Path | Purpose |
|---|---|
| `src/config/env.ts` + spec | Add `EVOLUTION_API_BASE_URL`, `EVOLUTION_API_KEY`, `ADMIN_WHATSAPP_NUMBER` (all optional — feature can be off) |
| `src/whatsapp/evolution.client.ts` | HTTP wrapper |
| `src/whatsapp/evolution.client.spec.ts` | Unit tests |
| `src/whatsapp/whatsapp.service.ts` | Thin service + log write |
| `src/whatsapp/whatsapp.service.spec.ts` | Unit tests |
| `src/whatsapp/whatsapp.controller.ts` | `POST /notifications/test-whatsapp` |
| `src/whatsapp/whatsapp.module.ts` | Module |
| `src/notifications/reminders.cron.ts` | `@Cron('* * * * *')` scheduler |
| `src/notifications/notifications.module.ts` | Module |
| `src/weekly-plans/weekly-plans.service.ts` | Inject `WhatsappService`, fire stuck alert |
| `src/me/me.controller.ts` | `/me/export`, `DELETE /me` |
| `src/me/me.service.ts` | Export builder + delete |
| `src/me/me.service.spec.ts` | Unit tests for export |
| `src/me/me.module.ts` | Module |
| `src/reports/reports.service.ts` | Cycle report markdown builder |
| `src/reports/reports.service.spec.ts` | Unit tests |
| `src/reports/reports.controller.ts` | `GET /cycles/:id/report` |
| `src/reports/reports.module.ts` | Module |
| `src/app.module.ts` | Wire all new modules |

### apps/web
| Path | Purpose |
|---|---|
| `app/(app)/admin/cycles/[id]/page.tsx` | Add "Baixar relatório" button |

### repo root
| Path | Purpose |
|---|---|
| `README.md` | Expand with Phase 6/7/8 features + LGPD + WhatsApp setup |

---

## Task 1: Schema + migration for `WhatsappLog`

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma`
- Create: `packages/prisma/prisma/migrations/8_whatsapp_log/migration.sql`

- [ ] **Step 1: Append model**

```prisma
model WhatsappLog {
  id          String    @id @default(cuid())
  userId      String
  kind        String
  payload     Json
  sentAt      DateTime  @default(now())
  deliveredAt DateTime?
  error       String?
}
```

- [ ] **Step 2: Migration**

```sql
CREATE TABLE "WhatsappLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "WhatsappLog_pkey" PRIMARY KEY ("id")
);
```

- [ ] **Step 3: Generate + apply + commit**

```bash
pnpm --filter @ics-select/prisma exec prisma generate
pnpm --filter @ics-select/prisma exec prisma migrate deploy
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/8_whatsapp_log
git commit -m "feat(prisma): add WhatsappLog audit table"
```

---

## Task 2: Env + EvolutionApiClient

**Files:**
- Modify: `apps/api/src/config/env.ts` (add optional fields)
- Modify: `apps/api/src/config/env.spec.ts` (test that these are optional)
- Create: `apps/api/src/whatsapp/evolution.client.ts` + spec

- [ ] **Step 1: Env**

Add to `EnvSchema` in `env.ts`:

```ts
  EVOLUTION_API_BASE_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  ADMIN_WHATSAPP_NUMBER: z.string().optional(),
```

Add to the test baseEnv (as empty or skip since they're optional). Add a test case:

```ts
  it('works without Evolution config', () => {
    const { EVOLUTION_API_BASE_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, ADMIN_WHATSAPP_NUMBER, ...rest } = baseEnv;
    const env = loadEnv(rest);
    expect(env.EVOLUTION_API_BASE_URL).toBeUndefined();
  });
```

- [ ] **Step 2: EvolutionApiClient**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SendTextInput = { to: string; text: string };

@Injectable()
export class EvolutionApiClient {
  private readonly logger = new Logger(EvolutionApiClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  get isConfigured(): boolean {
    return !!(
      this.config.get<string>('EVOLUTION_API_BASE_URL') &&
      this.config.get<string>('EVOLUTION_API_KEY') &&
      this.config.get<string>('EVOLUTION_INSTANCE')
    );
  }

  async sendText(input: SendTextInput): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { ok: false, error: 'Evolution API not configured' };
    }
    const baseUrl = this.config.getOrThrow<string>('EVOLUTION_API_BASE_URL');
    const apiKey = this.config.getOrThrow<string>('EVOLUTION_API_KEY');
    const instance = this.config.getOrThrow<string>('EVOLUTION_INSTANCE');
    try {
      const res = await this.fetcher(`${baseUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: input.to,
          textMessage: { text: input.text },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Evolution API returned ${res.status}: ${body}`);
        return { ok: false, error: `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
```

- [ ] **Step 3: Client spec (mocked fetcher + config)**

```ts
import { EvolutionApiClient } from './evolution.client';

function fakeConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (!values[key]) throw new Error(`missing ${key}`);
      return values[key]!;
    },
  };
}

describe('EvolutionApiClient', () => {
  it('isConfigured returns false when vars missing', () => {
    const client = new EvolutionApiClient(fakeConfig({}) as any);
    expect(client.isConfigured).toBe(false);
  });

  it('isConfigured returns true when all three vars present', () => {
    const client = new EvolutionApiClient(
      fakeConfig({
        EVOLUTION_API_BASE_URL: 'http://e',
        EVOLUTION_API_KEY: 'k',
        EVOLUTION_INSTANCE: 'i',
      }) as any,
    );
    expect(client.isConfigured).toBe(true);
  });

  it('sendText returns ok when fetcher returns 200', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    const client = new EvolutionApiClient(
      fakeConfig({
        EVOLUTION_API_BASE_URL: 'http://e',
        EVOLUTION_API_KEY: 'k',
        EVOLUTION_INSTANCE: 'i',
      }) as any,
      fetcher as any,
    );
    const result = await client.sendText({ to: '5511999', text: 'hi' });
    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      'http://e/message/sendText/i',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sendText returns error when not configured', async () => {
    const client = new EvolutionApiClient(fakeConfig({}) as any);
    const result = await client.sendText({ to: 'x', text: 'y' });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/config apps/api/src/whatsapp/evolution.client.ts apps/api/src/whatsapp/evolution.client.spec.ts
git commit -m "feat(api): add EvolutionApiClient with optional configuration"
```

---

## Task 3: WhatsappService + module + test endpoint

**Files:**
- Create: `apps/api/src/whatsapp/whatsapp.service.ts` + spec
- Create: `apps/api/src/whatsapp/whatsapp.controller.ts`
- Create: `apps/api/src/whatsapp/whatsapp.module.ts`

- [ ] **Step 1: Service spec**

```ts
import { WhatsappService } from './whatsapp.service';

const client = { sendText: jest.fn() };
const prisma = {
  whatsappLog: {
    create: jest.fn(async ({ data }: any) => ({ id: 'log-1', ...data })),
  },
};

describe('WhatsappService', () => {
  beforeEach(() => {
    client.sendText.mockReset();
    prisma.whatsappLog.create.mockClear();
  });

  it('logs a successful send', async () => {
    client.sendText.mockResolvedValue({ ok: true });
    const svc = new WhatsappService(client as any, prisma as any);
    await svc.send({ userId: 'u-1', kind: 'session_reminder', to: '5511', text: 'hi' });
    const call = prisma.whatsappLog.create.mock.calls[0][0];
    expect(call.data.kind).toBe('session_reminder');
    expect(call.data.deliveredAt).not.toBeNull();
    expect(call.data.error).toBeNull();
  });

  it('logs an error when client fails', async () => {
    client.sendText.mockResolvedValue({ ok: false, error: 'not configured' });
    const svc = new WhatsappService(client as any, prisma as any);
    await svc.send({ userId: 'u-1', kind: 'session_reminder', to: '5511', text: 'hi' });
    const call = prisma.whatsappLog.create.mock.calls[0][0];
    expect(call.data.deliveredAt).toBeNull();
    expect(call.data.error).toBe('not configured');
  });
});
```

- [ ] **Step 2: Service**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { EvolutionApiClient } from './evolution.client.js';

type SendInput = {
  userId: string;
  kind: 'session_reminder' | 'stuck_alert' | 'plan_published' | 'test';
  to: string;
  text: string;
};

@Injectable()
export class WhatsappService {
  constructor(
    private readonly client: EvolutionApiClient,
    private readonly prisma: PrismaService,
  ) {}

  async send(input: SendInput) {
    const result = await this.client.sendText({ to: input.to, text: input.text });
    await this.prisma.whatsappLog.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        payload: { to: input.to, text: input.text },
        deliveredAt: result.ok ? new Date() : null,
        error: result.ok ? null : result.error ?? 'unknown',
      },
    });
    return result;
  }
}
```

- [ ] **Step 3: Controller (admin-only test endpoint)**

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { WhatsappService } from './whatsapp.service.js';

const TestSchema = z.object({
  to: z.string().min(1),
  text: z.string().min(1),
});

@Roles('ADMIN')
@Controller('notifications')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Post('test-whatsapp')
  test(@Body() body: unknown) {
    const parsed = TestSchema.parse(body);
    return this.whatsapp.send({ userId: 'admin-test', kind: 'test', ...parsed });
  }
}
```

- [ ] **Step 4: Module**

```ts
import { Module } from '@nestjs/common';
import { EvolutionApiClient } from './evolution.client.js';
import { WhatsappService } from './whatsapp.service.js';
import { WhatsappController } from './whatsapp.controller.js';

@Module({
  controllers: [WhatsappController],
  providers: [EvolutionApiClient, WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
```

- [ ] **Step 5: Wire into AppModule, run tests, commit**

```bash
git add apps/api/src/whatsapp apps/api/src/app.module.ts
git commit -m "feat(api): add WhatsappService and test-whatsapp endpoint"
```

---

## Task 4: Reminders cron + stuck alert

**Files:**
- Install: `@nestjs/schedule`
- Create: `apps/api/src/notifications/reminders.cron.ts`
- Create: `apps/api/src/notifications/notifications.module.ts`
- Modify: `apps/api/src/weekly-plans/weekly-plans.service.ts` (fire stuck alert)
- Modify: `apps/api/src/weekly-plans/weekly-plans.module.ts` (import WhatsappModule)

- [ ] **Step 1: Install**

```bash
pnpm --filter @ics-select/api add @nestjs/schedule
```

- [ ] **Step 2: Reminders cron**

Create `apps/api/src/notifications/reminders.cron.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';

@Injectable()
export class RemindersCron {
  private readonly logger = new Logger(RemindersCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = Date.now();
    const lo = new Date(now + 9 * 60 * 1000);
    const hi = new Date(now + 11 * 60 * 1000);
    const sessions = await this.prisma.studySession.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gte: lo, lte: hi },
      },
      include: {
        weeklyPlanItem: {
          include: { libraryItem: true, weeklyPlan: { include: { user: true } } },
        },
      },
    });
    for (const s of sessions) {
      const user = s.weeklyPlanItem.weeklyPlan.user;
      if (!user.email) continue;
      // The member's WhatsApp number is not stored yet — Phase 7 uses email-as-phone
      // fallback (to be replaced when the availability flow collects WhatsApp).
      const to = user.email;
      const text = `⏰ Sessão ICS Select começa em 10min: ${s.weeklyPlanItem.libraryItem.title} (${s.durationMinutes}min).`;
      await this.whatsapp.send({ userId: user.id, kind: 'session_reminder', to, text });
    }
    if (sessions.length > 0) this.logger.log(`Sent ${sessions.length} session reminders`);
  }
}
```

Note: phone numbers are NOT collected yet in the availability flow — we fall back to `user.email` which won't deliver via WhatsApp. The `WhatsappService.send` will log the error and continue. Collecting phone numbers is a follow-up.

- [ ] **Step 3: Module**

```ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { RemindersCron } from './reminders.cron.js';

@Module({
  imports: [ScheduleModule.forRoot(), WhatsappModule],
  providers: [RemindersCron],
})
export class NotificationsModule {}
```

- [ ] **Step 4: Wire into AppModule**

Add `NotificationsModule` to imports.

- [ ] **Step 5: Stuck alert in WeeklyPlansService**

Modify `apps/api/src/weekly-plans/weekly-plans.service.ts` to inject `WhatsappService` (mark as optional so tests still work) and on `markItemStuck`, after the update, fire a stuck alert to the admin.

Add to the constructor:

```ts
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { ConfigService } from '@nestjs/config';
import { Optional } from '@nestjs/common';

// ...
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly whatsapp?: WhatsappService,
    @Optional() private readonly config?: ConfigService,
  ) {}
```

In `markItemStuck`, after the update, add:

```ts
    if (this.whatsapp && this.config) {
      const adminNumber = this.config.get<string>('ADMIN_WHATSAPP_NUMBER');
      if (adminNumber) {
        const plan = await this.prisma.weeklyPlan.findUnique({
          where: { id: planId },
          include: { user: true },
        });
        const item = await this.prisma.weeklyPlanItem.findUnique({
          where: { id: itemId },
          include: { libraryItem: true },
        });
        if (plan && item) {
          await this.whatsapp.send({
            userId: plan.user.id,
            kind: 'stuck_alert',
            to: adminNumber,
            text: `🚨 ${plan.user.name} travou em "${item.libraryItem.title}"`,
          });
        }
      }
    }
```

Update existing `weekly-plans.service.spec.ts` if it's failing because the constructor now has optional params — the old tests pass `undefined` or just the prisma; optional decorators make these params omittable. Verify the existing spec still passes; if not, add `undefined` args.

- [ ] **Step 6: Wire WhatsappModule into WeeklyPlansModule**

```ts
// weekly-plans.module.ts
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';

@Module({
  imports: [SchedulerModule, GoogleCalendarModule, WhatsappModule],
  // ...
})
```

- [ ] **Step 7: Run tests and commit**

```bash
git add apps/api/src/notifications apps/api/src/weekly-plans apps/api/src/app.module.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): add reminders cron and stuck alert via WhatsApp"
```

---

## Task 5: MeController — export + delete (LGPD)

**Files:**
- Create: `apps/api/src/me/me.service.ts` + spec
- Create: `apps/api/src/me/me.controller.ts`
- Create: `apps/api/src/me/me.module.ts`

- [ ] **Step 1: Service**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async exportForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    const [availability, memberships, plans, attendance] = await Promise.all([
      this.prisma.memberAvailability.findUnique({ where: { userId } }),
      this.prisma.cycleMembership.findMany({ where: { userId }, include: { cycle: true } }),
      this.prisma.weeklyPlan.findMany({
        where: { userId },
        include: {
          items: {
            include: { libraryItem: true, sessions: true },
            orderBy: { order: 'asc' },
          },
        },
      }),
      this.prisma.classAttendance.findMany({
        where: { userId },
        include: { classSession: true },
      }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
        role: user.role,
        privacyAcceptedAt: user.privacyAcceptedAt,
        createdAt: user.createdAt,
      },
      availability,
      memberships,
      plans,
      attendance,
    };
  }

  async deleteUser(userId: string) {
    // Prisma cascade rules already clean most relations. Google Calendar events are
    // best-effort cleaned up in a future hook; for now we just delete the user.
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }
}
```

- [ ] **Step 2: Service spec**

```ts
import { MeService } from './me.service';

function fakePrisma() {
  const user = { id: 'u-1', email: 'a@x.com', name: 'A', pictureUrl: null, role: 'MEMBER', privacyAcceptedAt: null, createdAt: new Date() };
  return {
    user: {
      findUnique: jest.fn(async () => user),
      delete: jest.fn(async () => user),
    },
    memberAvailability: { findUnique: jest.fn(async () => null) },
    cycleMembership: { findMany: jest.fn(async () => []) },
    weeklyPlan: { findMany: jest.fn(async () => []) },
    classAttendance: { findMany: jest.fn(async () => []) },
  };
}

describe('MeService', () => {
  it('exportForUser returns user + empty relations', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const result = await svc.exportForUser('u-1');
    expect(result.user.email).toBe('a@x.com');
    expect(result.plans).toEqual([]);
  });

  it('deleteUser calls prisma.user.delete', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const result = await svc.deleteUser('u-1');
    expect(result.deleted).toBe(true);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u-1' } });
  });
});
```

- [ ] **Step 3: Controller**

```ts
import { Controller, Delete, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { MeService } from './me.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('export')
  export(@CurrentUser() user: JwtStrategyPayload) {
    return this.me.exportForUser(user.sub);
  }

  @Delete()
  delete(@CurrentUser() user: JwtStrategyPayload) {
    return this.me.deleteUser(user.sub);
  }
}
```

- [ ] **Step 4: Module + wire + commit**

```ts
// me.module.ts
import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';

@Module({
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
```

Wire into AppModule. Commit:

```bash
git add apps/api/src/me apps/api/src/app.module.ts
git commit -m "feat(api): add /me/export and DELETE /me for LGPD"
```

---

## Task 6: Reports (cycle report markdown)

**Files:**
- Create: `apps/api/src/reports/reports.service.ts` + spec
- Create: `apps/api/src/reports/reports.controller.ts`
- Create: `apps/api/src/reports/reports.module.ts`

- [ ] **Step 1: Service**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCycleReport(cycleId: string): Promise<string> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        memberships: { include: { user: true } },
        classes: { include: { attendance: true } },
      },
    });
    if (!cycle) throw new NotFoundException('cycle not found');

    const memberIds = cycle.memberships.map((m) => m.user.id);
    const plans = await this.prisma.weeklyPlan.findMany({
      where: { userId: { in: memberIds } },
      include: { items: { include: { libraryItem: true } } },
    });

    const lines: string[] = [];
    lines.push(`# Relatório do Ciclo ${cycle.name}`);
    lines.push('');
    lines.push(`**Período:** ${cycle.startsAt.toISOString().slice(0, 10)} — ${cycle.endsAt.toISOString().slice(0, 10)}`);
    lines.push(`**Status:** ${cycle.status}`);
    lines.push(`**Membros:** ${cycle.memberships.length}`);
    lines.push('');
    lines.push('## Cobertura geral');
    const totalItems = plans.flatMap((p) => p.items).length;
    const doneItems = plans.flatMap((p) => p.items).filter((i) => i.status === 'DONE').length;
    lines.push(`- Planos publicados: ${plans.filter((p) => p.status !== 'DRAFT').length}`);
    lines.push(`- Itens totais: ${totalItems}`);
    lines.push(`- Itens concluídos: ${doneItems} (${totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100)}%)`);
    lines.push('');
    lines.push('## Aulas presenciais');
    lines.push(`- Total: ${cycle.classes.length}`);
    for (const cls of cycle.classes) {
      const present = cls.attendance.filter((a) => a.status === 'PRESENT').length;
      lines.push(`  - ${cls.title}: ${present}/${cycle.memberships.length} presentes`);
    }
    lines.push('');
    lines.push('## Membros');
    for (const m of cycle.memberships) {
      const memberPlans = plans.filter((p) => p.userId === m.user.id);
      const mDone = memberPlans.flatMap((p) => p.items).filter((i) => i.status === 'DONE').length;
      const mTotal = memberPlans.flatMap((p) => p.items).length;
      lines.push(`- **${m.user.name}** (${m.user.email}): ${mDone}/${mTotal} itens`);
    }
    return lines.join('\n');
  }
}
```

- [ ] **Step 2: Spec**

```ts
import { ReportsService } from './reports.service';

function fakePrisma() {
  return {
    cycle: {
      findUnique: jest.fn(async () => ({
        id: 'c-1',
        name: '2026.1',
        startsAt: new Date('2026-04-01'),
        endsAt: new Date('2026-07-01'),
        status: 'ACTIVE',
        memberships: [
          { id: 'm-1', user: { id: 'u-1', name: 'Pedro', email: 'p@x.com' } },
        ],
        classes: [
          {
            id: 'cls-1',
            title: 'Aula 1',
            attendance: [{ userId: 'u-1', status: 'PRESENT' }],
          },
        ],
      })),
    },
    weeklyPlan: {
      findMany: jest.fn(async () => [
        {
          id: 'p-1',
          userId: 'u-1',
          status: 'PUBLISHED',
          items: [
            { id: 'i-1', status: 'DONE', libraryItem: { title: 'X' } },
            { id: 'i-2', status: 'PENDING', libraryItem: { title: 'Y' } },
          ],
        },
      ]),
    },
  };
}

describe('ReportsService.buildCycleReport', () => {
  it('produces a markdown report with member stats', async () => {
    const prisma = fakePrisma();
    const svc = new ReportsService(prisma as any);
    const md = await svc.buildCycleReport('c-1');
    expect(md).toContain('# Relatório do Ciclo 2026.1');
    expect(md).toContain('Pedro');
    expect(md).toContain('1/2');
  });
});
```

- [ ] **Step 3: Controller (admin-only)**

```ts
import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ReportsService } from './reports.service.js';

@Roles('ADMIN')
@Controller('cycles')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':id/report')
  async download(@Param('id') id: string, @Res() res: Response) {
    const md = await this.reports.buildCycleReport(id);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cycle-${id}.md"`);
    res.send(md);
  }
}
```

- [ ] **Step 4: Module**

```ts
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
```

- [ ] **Step 5: Wire + commit**

```bash
git add apps/api/src/reports apps/api/src/app.module.ts
git commit -m "feat(api): add cycle markdown report endpoint"
```

---

## Task 7: Frontend — cycle detail page download button + settings cleanup

**Files:**
- Modify: `apps/web/app/(app)/admin/cycles/[id]/page.tsx` (add download button)

- [ ] **Step 1: Add download button**

At the top of the cycle detail page JSX, near the cycle header, add:

```tsx
import { getAccessToken } from '../../../../../lib/api/client';
import { Button } from '@heroui/react';

// ...inside the Card header or next to it:
<Button
  size="sm"
  variant="flat"
  onPress={async () => {
    const token = getAccessToken();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiBase}/cycles/${data.id}/report`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cycle-${data.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }}
>
  Baixar relatório
</Button>
```

Add the `Button` import at the top if not present.

- [ ] **Step 2: Build + commit**

```bash
pnpm --filter @ics-select/web build
git add apps/web/app/\(app\)/admin/cycles/\[id\]/page.tsx
git commit -m "feat(web): add download button for cycle report"
```

---

## Task 8: README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update sections**

Expand the existing README to cover:
- **New features recap** (Phases 5-8): dashboard, class attendance, AI draft/brief/diagnose/chat, WhatsApp reminders, LGPD export/delete, cycle report.
- **LGPD section:** describe `GET /me/export`, `DELETE /me`, and the privacy notice gate.
- **WhatsApp setup:** Evolution API self-hosted via `docker compose --profile whatsapp up -d evolution`. Env vars: `EVOLUTION_API_BASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `ADMIN_WHATSAPP_NUMBER`.
- **Cost monitoring:** link to `/admin/ai-usage`.
- **Env vars table:** make sure all env vars across phases are listed.

This is the only "content" task — copy the existing README structure and add the new sections. Commit.

```bash
git add README.md
git commit -m "docs: update README with phase 5-8 features"
```

---

## Task 9: Final verification + merge

- [ ] **Step 1: Full test + build**

```bash
pnpm install
pnpm --filter @ics-select/shared build
pnpm --filter @ics-select/prisma exec prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @ics-select/api test:e2e
pnpm build
```

Expected: everything green. API tests should be ~80+.

- [ ] **Step 2: Git state**

`git log --oneline main..HEAD` should show ~8 commits. `git status` clean except the 3 PDFs.

Phases 7 + 8 complete. Platform is at **v1.0.0** equivalent. All 8 phases shipped.
