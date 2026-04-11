# ICS Select — Fase 5 (Presença + Dashboard Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Let the admin record in-person class attendance and see the whole cohort at a glance: carometro with progress metrics, stuck alerts, and per-member plan history + topic coverage.

**Architecture:** Two new Prisma models (`ClassSession`, `ClassAttendance`) with a unique constraint on `(classSessionId, userId)`. Admin-only CRUD for classes + attendance under the existing cycles routes. An `AdminDashboardService` aggregates per-member stats (plans count, done items, stuck items, topic coverage). Frontend gets an "Aulas" page per cycle, a "Dashboard" page listing the cohort with metrics, and a "Detalhe do membro" page with plan history + topic heatmap.

---

## File Structure

### packages/prisma
| Path | Purpose |
|---|---|
| `schema.prisma` | Add `ClassSession`, `ClassAttendance`, `AttendanceStatus` |
| `migrations/6_classes_attendance/migration.sql` | Migration |

### apps/api
| Path | Purpose |
|---|---|
| `src/classes/classes.service.ts` | CRUD + batch attendance |
| `src/classes/classes.service.spec.ts` | Tests |
| `src/classes/classes.controller.ts` | REST |
| `src/classes/classes.module.ts` | Module |
| `src/admin-dashboard/admin-dashboard.service.ts` | Aggregations |
| `src/admin-dashboard/admin-dashboard.service.spec.ts` | Tests |
| `src/admin-dashboard/admin-dashboard.controller.ts` | `/admin/dashboard`, `/admin/members/:id/overview` |
| `src/admin-dashboard/admin-dashboard.module.ts` | Module |
| `src/app.module.ts` | Wire both modules |

### apps/web
| Path | Purpose |
|---|---|
| `app/(app)/admin/cycles/[id]/classes/page.tsx` | Class sessions list + create + attendance |
| `app/(app)/admin/dashboard/page.tsx` | Cohort dashboard |
| `app/(app)/admin/members/[id]/page.tsx` | Member detail with plan history + topic heatmap |
| `components/dashboard/member-card.tsx` | Carometro card |
| `components/nav/app-nav.tsx` | Add "Dashboard" link |

---

## Task 1: Schema + migration

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma`
- Create: `packages/prisma/prisma/migrations/6_classes_attendance/migration.sql`

- [ ] **Step 1: Append to `schema.prisma`**

```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
}

model ClassSession {
  id          String   @id @default(cuid())
  cycleId     String
  title       String
  topic       String?
  scheduledAt DateTime
  durationMin Int      @default(90)
  notes       String?

  cycle      Cycle             @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  attendance ClassAttendance[]
}

model ClassAttendance {
  id             String           @id @default(cuid())
  classSessionId String
  userId         String
  status         AttendanceStatus

  classSession ClassSession @relation(fields: [classSessionId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([classSessionId, userId])
}
```

Add back-relations:
- `User`: `attendance ClassAttendance[]`
- `Cycle`: `classes ClassSession[]`

- [ ] **Step 2: Create migration SQL**

Create `packages/prisma/prisma/migrations/6_classes_attendance/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 90,
    "notes" TEXT,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAttendance" (
    "id" TEXT NOT NULL,
    "classSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,

    CONSTRAINT "ClassAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassAttendance_classSessionId_userId_key" ON "ClassAttendance"("classSessionId", "userId");

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAttendance" ADD CONSTRAINT "ClassAttendance_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAttendance" ADD CONSTRAINT "ClassAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply**

Run:
```bash
pnpm --filter @ics-select/prisma exec prisma generate
docker compose up -d postgres
pnpm --filter @ics-select/prisma exec prisma migrate deploy
```

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/6_classes_attendance
git commit -m "feat(prisma): add ClassSession and ClassAttendance models"
```

---

## Task 2: Classes module (service + controller)

**Files:**
- Create: `apps/api/src/classes/classes.service.ts`
- Create: `apps/api/src/classes/classes.service.spec.ts`
- Create: `apps/api/src/classes/classes.controller.ts`
- Create: `apps/api/src/classes/classes.module.ts`

- [ ] **Step 1: Service tests**

Create `apps/api/src/classes/classes.service.spec.ts`:

```ts
import { ClassesService } from './classes.service';

function fakePrisma() {
  const sessions = new Map<string, any>();
  const attendance = new Map<string, any>();
  let sid = 0;
  let aid = 0;
  return {
    sessions,
    attendance,
    classSession: {
      create: jest.fn(async ({ data }: any) => {
        const id = `s-${++sid}`;
        const rec = { id, ...data };
        sessions.set(id, rec);
        return rec;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(sessions.values()).filter((s) => s.cycleId === where.cycleId),
      ),
      findUnique: jest.fn(async ({ where }: any) => sessions.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = sessions.get(where.id);
        const next = { ...cur, ...data };
        sessions.set(where.id, next);
        return next;
      }),
    },
    classAttendance: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = Array.from(attendance.values()).find(
          (a: any) =>
            a.classSessionId === where.classSessionId_userId.classSessionId &&
            a.userId === where.classSessionId_userId.userId,
        );
        if (existing) {
          const next = { ...existing, ...update };
          attendance.set(existing.id, next);
          return next;
        }
        const id = `a-${++aid}`;
        const rec = { id, ...create };
        attendance.set(id, rec);
        return rec;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(attendance.values()).filter((a: any) => a.classSessionId === where.classSessionId),
      ),
    },
  };
}

describe('ClassesService', () => {
  it('createForCycle creates a class', async () => {
    const prisma = fakePrisma();
    const svc = new ClassesService(prisma as any);
    const cls = await svc.createForCycle('c-1', {
      title: 'Aula 1 - Arrays',
      topic: 'arrays',
      scheduledAt: new Date('2026-04-15T19:00:00Z'),
      durationMin: 90,
    });
    expect(cls.cycleId).toBe('c-1');
    expect(cls.title).toBe('Aula 1 - Arrays');
  });

  it('markBatchAttendance upserts attendance for multiple users', async () => {
    const prisma = fakePrisma();
    const svc = new ClassesService(prisma as any);
    const cls = await svc.createForCycle('c-1', {
      title: 'A1',
      topic: null,
      scheduledAt: new Date(),
      durationMin: 90,
    });
    await svc.markBatchAttendance(cls.id, [
      { userId: 'u-1', status: 'PRESENT' },
      { userId: 'u-2', status: 'ABSENT' },
    ]);
    const rows = await svc.listAttendance(cls.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === 'u-1')?.status).toBe('PRESENT');
  });
});
```

- [ ] **Step 2: Service**

Create `apps/api/src/classes/classes.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type CreateClassInput = {
  title: string;
  topic: string | null;
  scheduledAt: Date;
  durationMin: number;
  notes?: string;
};

type AttendanceRow = { userId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' };

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  createForCycle(cycleId: string, input: CreateClassInput) {
    return this.prisma.classSession.create({
      data: { cycleId, ...input },
    });
  }

  listForCycle(cycleId: string) {
    return this.prisma.classSession.findMany({
      where: { cycleId },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async markBatchAttendance(classSessionId: string, rows: AttendanceRow[]) {
    for (const row of rows) {
      await this.prisma.classAttendance.upsert({
        where: { classSessionId_userId: { classSessionId, userId: row.userId } },
        create: { classSessionId, userId: row.userId, status: row.status },
        update: { status: row.status },
      });
    }
  }

  listAttendance(classSessionId: string) {
    return this.prisma.classAttendance.findMany({ where: { classSessionId } });
  }
}
```

- [ ] **Step 3: Controller**

Create `apps/api/src/classes/classes.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ClassesService } from './classes.service.js';

const CreateClassSchema = z.object({
  title: z.string().min(1),
  topic: z.string().nullable(),
  scheduledAt: z.coerce.date(),
  durationMin: z.number().int().positive().default(90),
  notes: z.string().optional(),
});

const AttendanceBatchSchema = z.object({
  rows: z.array(
    z.object({
      userId: z.string().min(1),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE']),
    }),
  ),
});

@Roles('ADMIN')
@Controller()
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get('cycles/:cycleId/classes')
  list(@Param('cycleId') cycleId: string) {
    return this.classes.listForCycle(cycleId);
  }

  @Post('cycles/:cycleId/classes')
  create(@Param('cycleId') cycleId: string, @Body() body: unknown) {
    const parsed = CreateClassSchema.parse(body);
    return this.classes.createForCycle(cycleId, parsed);
  }

  @Post('classes/:classId/attendance')
  batch(@Param('classId') classId: string, @Body() body: unknown) {
    const parsed = AttendanceBatchSchema.parse(body);
    return this.classes.markBatchAttendance(classId, parsed.rows);
  }

  @Get('classes/:classId/attendance')
  listAttendance(@Param('classId') classId: string) {
    return this.classes.listAttendance(classId);
  }
}
```

- [ ] **Step 4: Module**

Create `apps/api/src/classes/classes.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller.js';
import { ClassesService } from './classes.service.js';

@Module({
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
```

- [ ] **Step 5: Wire into `AppModule`**, run tests, commit

```bash
git add apps/api/src/classes apps/api/src/app.module.ts
git commit -m "feat(api): add classes module with attendance batch endpoint"
```

---

## Task 3: Admin dashboard service + controller

**Files:**
- Create: `apps/api/src/admin-dashboard/admin-dashboard.service.ts`
- Create: `apps/api/src/admin-dashboard/admin-dashboard.service.spec.ts`
- Create: `apps/api/src/admin-dashboard/admin-dashboard.controller.ts`
- Create: `apps/api/src/admin-dashboard/admin-dashboard.module.ts`

- [ ] **Step 1: Service test**

Create `apps/api/src/admin-dashboard/admin-dashboard.service.spec.ts`:

```ts
import { AdminDashboardService } from './admin-dashboard.service';

function fakePrisma() {
  const users = [
    { id: 'u-1', name: 'A', email: 'a@x.com', pictureUrl: null, role: 'MEMBER' },
    { id: 'u-2', name: 'B', email: 'b@x.com', pictureUrl: null, role: 'MEMBER' },
  ];
  const plans = [
    {
      id: 'p-1',
      userId: 'u-1',
      status: 'PUBLISHED',
      items: [
        { id: 'i-1', status: 'DONE', stuck: false, libraryItem: { tags: ['arrays'] } },
        { id: 'i-2', status: 'PENDING', stuck: false, libraryItem: { tags: ['dp'] } },
      ],
    },
  ];
  return {
    user: {
      findMany: jest.fn(async () => users),
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
    },
    weeklyPlan: {
      findMany: jest.fn(async ({ where }: any) => {
        if (where.userId) return plans.filter((p) => p.userId === where.userId);
        return plans;
      }),
      count: jest.fn(async ({ where }: any) => plans.filter((p) => p.userId === where.userId).length),
    },
    weeklyPlanItem: {
      count: jest.fn(async ({ where }: any) => {
        const rel = plans.filter((p) => p.userId === where.weeklyPlan.userId);
        const items = rel.flatMap((p) => p.items);
        if (where.status === 'DONE') return items.filter((i) => i.status === 'DONE').length;
        if (where.stuck === true) return items.filter((i) => i.stuck).length;
        return items.length;
      }),
    },
  };
}

describe('AdminDashboardService', () => {
  it('getCohort returns per-user aggregated stats', async () => {
    const prisma = fakePrisma();
    const svc = new AdminDashboardService(prisma as any);
    const cohort = await svc.getCohort();
    expect(cohort).toHaveLength(2);
    const first = cohort.find((c) => c.id === 'u-1');
    expect(first?.stats.plansCount).toBe(1);
    expect(first?.stats.doneItems).toBe(1);
    expect(first?.stats.stuckItems).toBe(0);
  });
});
```

- [ ] **Step 2: Service**

Create `apps/api/src/admin-dashboard/admin-dashboard.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type MemberCard = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: {
    plansCount: number;
    doneItems: number;
    stuckItems: number;
  };
};

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getCohort(): Promise<MemberCard[]> {
    const users = await this.prisma.user.findMany();
    const cards: MemberCard[] = [];
    for (const u of users) {
      const [plansCount, doneItems, stuckItems] = await Promise.all([
        this.prisma.weeklyPlan.count({ where: { userId: u.id } }),
        this.prisma.weeklyPlanItem.count({
          where: { weeklyPlan: { userId: u.id }, status: 'DONE' },
        }),
        this.prisma.weeklyPlanItem.count({
          where: { weeklyPlan: { userId: u.id }, stuck: true },
        }),
      ]);
      cards.push({
        id: u.id,
        name: u.name,
        email: u.email,
        pictureUrl: u.pictureUrl,
        role: u.role,
        stats: { plansCount, doneItems, stuckItems },
      });
    }
    return cards;
  }

  async getMemberOverview(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    const plans = await this.prisma.weeklyPlan.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      include: {
        items: {
          include: { libraryItem: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    const topicCoverage = new Map<string, { done: number; total: number }>();
    for (const plan of plans) {
      for (const item of plan.items) {
        for (const tag of item.libraryItem.tags) {
          const cur = topicCoverage.get(tag) ?? { done: 0, total: 0 };
          cur.total += 1;
          if (item.status === 'DONE') cur.done += 1;
          topicCoverage.set(tag, cur);
        }
      }
    }
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pictureUrl: user.pictureUrl,
      },
      plans: plans.map((p) => ({
        id: p.id,
        weekStart: p.weekStart,
        weekEnd: p.weekEnd,
        status: p.status,
        doneCount: p.items.filter((i) => i.status === 'DONE').length,
        totalCount: p.items.length,
      })),
      topicCoverage: Array.from(topicCoverage.entries()).map(([tag, stats]) => ({
        tag,
        done: stats.done,
        total: stats.total,
      })),
    };
  }
}
```

- [ ] **Step 3: Controller**

Create `apps/api/src/admin-dashboard/admin-dashboard.controller.ts`:

```ts
import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AdminDashboardService } from './admin-dashboard.service.js';

@Roles('ADMIN')
@Controller('admin')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('dashboard')
  getCohort() {
    return this.dashboard.getCohort();
  }

  @Get('members/:id/overview')
  getOverview(@Param('id') id: string) {
    return this.dashboard.getMemberOverview(id);
  }
}
```

- [ ] **Step 4: Module**

Create `apps/api/src/admin-dashboard/admin-dashboard.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { AdminDashboardService } from './admin-dashboard.service.js';

@Module({
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
```

- [ ] **Step 5: Wire into `AppModule`**, run tests, build, commit

```bash
git add apps/api/src/admin-dashboard apps/api/src/app.module.ts
git commit -m "feat(api): add admin dashboard service with cohort and member overview"
```

---

## Task 4: Frontend — admin dashboard + classes + member detail

**Files:**
- Create: `apps/web/app/(app)/admin/dashboard/page.tsx`
- Create: `apps/web/app/(app)/admin/cycles/[id]/classes/page.tsx`
- Create: `apps/web/app/(app)/admin/members/[id]/page.tsx`
- Modify: `apps/web/components/nav/app-nav.tsx` (add Dashboard link)

- [ ] **Step 1: Update nav**

In `apps/web/components/nav/app-nav.tsx`, in the admin block, add a "Dashboard" link as the FIRST admin link (before "Ciclos"):

```tsx
            <Link href="/admin/dashboard" className="text-foreground/80 hover:text-foreground">
              Dashboard
            </Link>
```

- [ ] **Step 2: Dashboard page**

Create `apps/web/app/(app)/admin/dashboard/page.tsx`:

```tsx
'use client';

import { Avatar, Card, CardBody, Chip } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api/client';

type Member = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: { plansCount: number; doneItems: number; stuckItems: number };
};

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiFetch<Member[]>('/admin/dashboard'),
  });

  if (isLoading) return <p>Carregando...</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? [])
          .filter((m) => m.role === 'MEMBER')
          .map((m) => (
            <Card key={m.id} as={Link} href={`/admin/members/${m.id}`} isPressable>
              <CardBody className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar src={m.pictureUrl ?? undefined} name={m.name} size="md" />
                  <div>
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-foreground/60">{m.email}</p>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <Chip size="sm" variant="flat">{m.stats.plansCount} planos</Chip>
                  <Chip size="sm" variant="flat" color="success">
                    {m.stats.doneItems} feitos
                  </Chip>
                  {m.stats.stuckItems > 0 && (
                    <Chip size="sm" color="warning">
                      {m.stats.stuckItems} travei
                    </Chip>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Classes page**

Create `apps/web/app/(app)/admin/cycles/[id]/classes/page.tsx`:

```tsx
'use client';

import { Avatar, Button, Card, CardBody, CardHeader, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, useDisclosure } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { use, useState } from 'react';
import { apiFetch } from '../../../../../../lib/api/client';

type ClassSession = {
  id: string;
  title: string;
  topic: string | null;
  scheduledAt: string;
};

type Member = { id: string; name: string; email: string; pictureUrl: string | null; role: string };

type AttendanceRow = { id: string; userId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' };

export default function AdminCycleClassesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: cycleId } = use(params);
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState({ title: '', topic: '', scheduledAt: '', durationMin: 90 });
  const [openClassId, setOpenClassId] = useState<string | null>(null);

  const { data: classes } = useQuery({
    queryKey: ['classes', cycleId],
    queryFn: () => apiFetch<ClassSession[]>(`/cycles/${cycleId}/classes`),
  });

  const { data: members } = useQuery({
    queryKey: ['members'],
    queryFn: () => apiFetch<Member[]>('/members'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/cycles/${cycleId}/classes`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          topic: form.topic || null,
          scheduledAt: form.scheduledAt,
          durationMin: form.durationMin,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', cycleId] });
      onClose();
      setForm({ title: '', topic: '', scheduledAt: '', durationMin: 90 });
    },
  });

  const [attendance, setAttendance] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE'>>({});

  const { data: existingAttendance } = useQuery({
    queryKey: ['class-attendance', openClassId],
    queryFn: () => (openClassId ? apiFetch<AttendanceRow[]>(`/classes/${openClassId}/attendance`) : Promise.resolve([])),
    enabled: !!openClassId,
  });

  const attendanceMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/classes/${openClassId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({
          rows: Object.entries(attendance).map(([userId, status]) => ({ userId, status })),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-attendance', openClassId] });
    },
  });

  const memberMembers = (members ?? []).filter((m) => m.role === 'MEMBER');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Aulas do ciclo</h1>
        <Button color="primary" onPress={onOpen}>Nova aula</Button>
      </div>

      <div className="space-y-3">
        {(classes ?? []).map((cls) => {
          const isOpen2 = openClassId === cls.id;
          return (
            <Card key={cls.id}>
              <CardHeader>
                <div className="flex w-full items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">{cls.title}</h2>
                    <p className="text-xs text-foreground/60">
                      {new Date(cls.scheduledAt).toLocaleString('pt-BR')}
                      {cls.topic && ` · ${cls.topic}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setOpenClassId(isOpen2 ? null : cls.id);
                      if (!isOpen2) {
                        const init: Record<string, 'PRESENT' | 'ABSENT' | 'LATE'> = {};
                        memberMembers.forEach((m) => {
                          init[m.id] = 'PRESENT';
                        });
                        setAttendance(init);
                      }
                    }}
                  >
                    {isOpen2 ? 'Fechar' : 'Presença'}
                  </Button>
                </div>
              </CardHeader>
              {isOpen2 && (
                <CardBody className="space-y-2">
                  {memberMembers.map((m) => {
                    const current = existingAttendance?.find((a) => a.userId === m.id)?.status;
                    const value = attendance[m.id] ?? current ?? 'PRESENT';
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Avatar src={m.pictureUrl ?? undefined} name={m.name} size="sm" />
                          <span className="text-sm">{m.name}</span>
                        </div>
                        <Select
                          size="sm"
                          className="w-32"
                          selectedKeys={[value]}
                          onSelectionChange={(keys) => {
                            const v = Array.from(keys as Set<string>)[0] as 'PRESENT' | 'ABSENT' | 'LATE';
                            setAttendance((a) => ({ ...a, [m.id]: v }));
                          }}
                        >
                          <SelectItem key="PRESENT">Presente</SelectItem>
                          <SelectItem key="ABSENT">Ausente</SelectItem>
                          <SelectItem key="LATE">Atrasado</SelectItem>
                        </Select>
                      </div>
                    );
                  })}
                  <Button
                    color="primary"
                    isLoading={attendanceMutation.isPending}
                    onPress={() => attendanceMutation.mutate()}
                  >
                    Salvar presenças
                  </Button>
                </CardBody>
              )}
            </Card>
          );
        })}
      </div>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Nova aula</ModalHeader>
          <ModalBody className="space-y-3">
            <Input label="Título" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Input label="Tópico" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} />
            <Input type="datetime-local" label="Data/hora" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
            <Input type="number" label="Duração (min)" value={String(form.durationMin)} onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) }))} />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>Cancelar</Button>
            <Button color="primary" isLoading={createMutation.isPending} onPress={() => createMutation.mutate()}>Criar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 4: Member detail page**

Create `apps/web/app/(app)/admin/members/[id]/page.tsx`:

```tsx
'use client';

import { Avatar, Card, CardBody, CardHeader, Chip } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { use } from 'react';
import { apiFetch } from '../../../../../lib/api/client';

type Overview = {
  user: { id: string; name: string; email: string; pictureUrl: string | null };
  plans: Array<{ id: string; weekStart: string; weekEnd: string; status: string; doneCount: number; totalCount: number }>;
  topicCoverage: Array<{ tag: string; done: number; total: number }>;
};

export default function AdminMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-member', id],
    queryFn: () => apiFetch<Overview>(`/admin/members/${id}/overview`),
  });

  if (isLoading || !data) return <p>Carregando...</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardBody className="flex flex-row items-center gap-4">
          <Avatar src={data.user.pictureUrl ?? undefined} name={data.user.name} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold">{data.user.name}</h1>
            <p className="text-sm text-foreground/60">{data.user.email}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Histórico de planos</h2></CardHeader>
        <CardBody className="space-y-2">
          {data.plans.length === 0 ? (
            <p className="text-foreground/60">Nenhum plano ainda.</p>
          ) : (
            data.plans.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-foreground/10 p-3">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(p.weekStart).toLocaleDateString('pt-BR')} —{' '}
                    {new Date(p.weekEnd).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-foreground/60">{p.doneCount}/{p.totalCount} concluídos</p>
                </div>
                <Chip size="sm" variant="flat">{p.status}</Chip>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Cobertura de tópicos</h2></CardHeader>
        <CardBody>
          {data.topicCoverage.length === 0 ? (
            <p className="text-foreground/60">Sem dados ainda.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.topicCoverage.map((t) => {
                const pct = t.total === 0 ? 0 : Math.round((t.done / t.total) * 100);
                const color = pct >= 75 ? 'success' : pct >= 40 ? 'warning' : 'default';
                return (
                  <div key={t.tag} className="rounded-md border border-foreground/10 p-3">
                    <p className="text-sm font-medium">{t.tag}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-foreground/60">{t.done}/{t.total}</span>
                      <Chip size="sm" variant="flat" color={color}>{pct}%</Chip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Build + commit**

Run `pnpm --filter @ics-select/web build`. Then:

```bash
git add apps/web/app/\(app\)/admin/dashboard apps/web/app/\(app\)/admin/cycles apps/web/app/\(app\)/admin/members apps/web/components/nav/app-nav.tsx
git commit -m "feat(web): add admin dashboard, classes attendance, member detail pages"
```

---

## Task 5: Final verification

Run:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @ics-select/api test:e2e && pnpm build
```
Expected: all pass.

`git log --oneline main..HEAD` should show ~4 commits.

Phase 5 complete. Next: Phase 6 — IA features.
