/**
 * E2E smoke test for POST /plans/:id/preview-scheduling.
 *
 * Mirrors cockpit.e2e-spec.ts:
 *   1. Registers SchedulingPreviewController + service stack directly.
 *   2. Provides PrismaService as a pure in-memory fake.
 *   3. Overrides APP_GUARD with AllowAllGuard — request.user is always ADMIN.
 *
 * Role enforcement is covered by the global RolesGuard registered in AppModule
 * (unit tests + production wiring); here we just confirm controller wiring
 * and 404 behavior.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SchedulingPreviewController } from '../src/weekly-plans/scheduling-preview.controller';
import { SchedulingPreviewService } from '../src/weekly-plans/scheduling-preview.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { GoogleCalendarService } from '../src/google-calendar/google-calendar.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

@Injectable()
class AllowAllGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.user = { sub: 'admin-id', email: 'admin@sou.inteli.edu.br', role: 'ADMIN' };
    return true;
  }
}

function makeFakePrisma(plan: any | null) {
  return {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    weeklyPlan: {
      findUnique: jest.fn().mockResolvedValue(plan),
    },
    weeklyPlanItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    memberAvailability: {
      findUnique: jest.fn().mockResolvedValue({
        userId: 'user-1',
        mondayMinutes: 90,
        tuesdayMinutes: 90,
        wednesdayMinutes: 60,
        thursdayMinutes: null,
        fridayMinutes: null,
        saturdayMinutes: 60,
        sundayMinutes: null,
        preferredSessionMinutes: 45,
        timezone: 'America/Sao_Paulo',
      }),
    },
    availabilitySlot: {
      findMany: jest.fn().mockResolvedValue([
        { dayOfWeek: 0, startMinute: 17 * 60, endMinute: 19 * 60 },
        { dayOfWeek: 1, startMinute: 17 * 60, endMinute: 19 * 60 },
        { dayOfWeek: 2, startMinute: 17 * 60, endMinute: 18 * 60 },
        { dayOfWeek: 5, startMinute: 10 * 60, endMinute: 11 * 60 },
      ]),
    },
  };
}

const calendarMock = {
  getFreeBusy: jest.fn().mockResolvedValue([]),
};

async function buildApp(plan: any | null): Promise<INestApplication> {
  const mod = await Test.createTestingModule({
    controllers: [SchedulingPreviewController],
    providers: [
      SchedulingPreviewService,
      SchedulerService,
      { provide: PrismaService, useValue: makeFakePrisma(plan) },
      { provide: GoogleCalendarService, useValue: calendarMock },
      { provide: APP_GUARD, useClass: AllowAllGuard },
    ],
  }).compile();
  const app = mod.createNestApplication();
  await app.init();
  return app;
}

describe('POST /plans/:id/preview-scheduling (e2e)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 404 when plan is unknown', async () => {
    app = await buildApp(null);
    await request(app.getHttpServer())
      .post('/plans/missing/preview-scheduling')
      .send({ items: [] })
      .expect(404);
  });

  it('returns placements when plan exists and items fit', async () => {
    app = await buildApp({
      id: 'plan-1',
      userId: 'user-1',
      weekStart: new Date('2026-05-18T00:00:00-03:00'),
      weekEnd: new Date('2026-05-25T00:00:00-03:00'),
      status: 'DRAFT',
    });

    const res = await request(app.getHttpServer())
      .post('/plans/plan-1/preview-scheduling')
      .send({
        items: [
          { libraryItemId: 'lib-A', order: 0, estimatedMinutes: 45 },
        ],
      })
      .expect(201);

    expect(Array.isArray(res.body.placements)).toBe(true);
    expect(res.body.placements.length).toBeGreaterThan(0);
    expect(res.body.placements[0].itemId).toBe('lib-A');
    expect(typeof res.body.weekStart).toBe('string');
  });

  it('returns empty placements when body items array is empty', async () => {
    app = await buildApp({
      id: 'plan-1',
      userId: 'user-1',
      weekStart: new Date('2026-05-18T00:00:00-03:00'),
      weekEnd: new Date('2026-05-25T00:00:00-03:00'),
      status: 'DRAFT',
    });

    const res = await request(app.getHttpServer())
      .post('/plans/plan-1/preview-scheduling')
      .send({ items: [] })
      .expect(201);

    expect(res.body.placements).toEqual([]);
    expect(res.body.overflow).toEqual([]);
  });
});
