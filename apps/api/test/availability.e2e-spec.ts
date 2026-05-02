/**
 * E2E tests for PATCH /me/availability
 *
 * Auth strategy: since the full AppModule requires real env vars + a live DB,
 * we spin up a lightweight NestJS application that:
 *   1. Registers AvailabilityController + AvailabilityService directly (no module import).
 *   2. Provides PrismaService as a pure in-memory fake.
 *   3. Overrides APP_GUARD with AllowAllGuard — a stub that always attaches
 *      `request.user = { sub: 'user-1', role: 'MEMBER' }` mimicking JwtAuthGuard.
 *   4. Registers HttpExceptionFilter globally so the 400 payloads are shaped correctly.
 *
 * This avoids a live DB, JWT secrets, and env validation while still exercising
 * the controller → service → filter stack end-to-end.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AvailabilityController } from '../src/availability/availability.controller';
import { AvailabilityService } from '../src/availability/availability.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// ─── Auth stub ────────────────────────────────────────────────────────────────

@Injectable()
class AllowAllGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.user = { sub: 'user-1', email: 'test@sou.inteli.edu.br', role: 'MEMBER' };
    return true;
  }
}

// ─── In-memory Prisma fake ────────────────────────────────────────────────────

function makeFakePrisma() {
  const slots = new Map<string, any>();
  const mem = new Map<string, any>();

  const facade: any = {
    memberAvailability: {
      findUnique: async ({ where }: any) => mem.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = mem.get(where.userId);
        const next = existing
          ? { ...existing, ...update }
          : { id: 'a1', ...create };
        mem.set(where.userId, next);
        return next;
      },
    },
    availabilitySlot: {
      findMany: async ({ where }: any) => {
        const out: any[] = [];
        for (const s of slots.values()) {
          if (where?.userId && s.userId !== where.userId) continue;
          out.push(s);
        }
        out.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
        return out;
      },
      deleteMany: async ({ where }: any) => {
        const days: number[] = where?.dayOfWeek?.in ?? [];
        for (const [id, s] of slots) {
          if (where?.userId && s.userId !== where.userId) continue;
          if (days.length > 0 && !days.includes(s.dayOfWeek)) continue;
          slots.delete(id);
        }
        return { count: 0 };
      },
      createMany: async ({ data }: any) => {
        for (const d of data) {
          const id = `s-${slots.size + 1}`;
          slots.set(id, { id, ...d });
        }
        return { count: data.length };
      },
    },
    $connect: async () => {},
    $disconnect: async () => {},
    $transaction: async (cb: any) => cb(facade),
  };
  return facade;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PATCH /me/availability (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: makeFakePrisma() },
        { provide: APP_GUARD, useClass: AllowAllGuard },
      ],
    }).compile();

    app = mod.createNestApplication();
    // The lightweight test module doesn't register ConfigModule; the e2e
    // path doesn't exercise the OAuth-redirect branch of the filter, so a
    // stub ConfigService that throws on access is enough.
    const stubConfig = {
      getOrThrow: () => {
        throw new Error('ConfigService not available in this e2e harness');
      },
    } as unknown as ConfigService;
    app.useGlobalFilters(new HttpExceptionFilter(stubConfig));
    await app.init();
  });

  afterAll(async () => app?.close());

  it('rejects overlapping slots with 400 and structured details', async () => {
    const res = await request(app.getHttpServer())
      .patch('/me/availability')
      .send({
        preferredSessionMinutes: 60,
        timezone: 'America/Sao_Paulo',
        slots: [
          { dayOfWeek: 0, startMinute: 480, endMinute: 720 },
          { dayOfWeek: 0, startMinute: 600, endMinute: 900 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details.reason).toBe('overlap');
    expect(res.body.error.details.dayOfWeek).toBe(0);
  });

  it('saves slots and returns them', async () => {
    const res = await request(app.getHttpServer())
      .patch('/me/availability')
      .send({
        preferredSessionMinutes: 60,
        timezone: 'America/Sao_Paulo',
        slots: [
          { dayOfWeek: 0, startMinute: 480, endMinute: 1320 },
          { dayOfWeek: 1, startMinute: 1140, endMinute: 1320 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(2);
    expect(res.body.preferredSessionMinutes).toBe(60);
    expect(res.body.timezone).toBe('America/Sao_Paulo');
  });

  it('saves slots + nullable day caps', async () => {
    const res = await request(app.getHttpServer())
      .patch('/me/availability')
      .send({
        mondayMinutes: null,
        tuesdayMinutes: 120,
        preferredSessionMinutes: 60,
        timezone: 'America/Sao_Paulo',
        slots: [
          { dayOfWeek: 0, startMinute: 480, endMinute: 1320 },
          { dayOfWeek: 1, startMinute: 1140, endMinute: 1320 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.mondayMinutes).toBeNull();
    expect(res.body.tuesdayMinutes).toBe(120);
    expect(res.body.slots).toHaveLength(2);
  });
});
