/**
 * E2E smoke test for GET /admin/member/:id/cockpit
 *
 * Auth strategy mirrors availability.e2e-spec.ts:
 *   1. Registers CockpitController + CockpitService directly (no full AppModule).
 *   2. Provides PrismaService as a pure in-memory fake.
 *   3. Overrides APP_GUARD with AllowAllGuard — always attaches
 *      `request.user = { sub: 'admin-id', role: 'ADMIN' }`.
 *
 * The test covers the "member without active cycle" path so the mock is minimal.
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
import { CockpitController } from '../src/admin/cockpit/cockpit.controller';
import { CockpitService } from '../src/admin/cockpit/cockpit.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

// ─── Auth stub ────────────────────────────────────────────────────────────────

@Injectable()
class AllowAllGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.user = { sub: 'admin-id', email: 'admin@sou.inteli.edu.br', role: 'ADMIN' };
    return true;
  }
}

// ─── In-memory Prisma fake ────────────────────────────────────────────────────

function makeFakePrisma() {
  return {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        name: 'Maria',
        email: 'm@x.com',
        pictureUrl: null,
        whatsappPhone: null,
        role: 'MEMBER',
      }),
    },
    cycleMembership: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    weeklyPlan: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    weeklyRetro: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    classSession: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    userEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
    topic: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /admin/member/:id/cockpit (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [CockpitController],
      providers: [
        CockpitService,
        { provide: PrismaService, useValue: makeFakePrisma() },
        { provide: APP_GUARD, useClass: AllowAllGuard },
      ],
    }).compile();

    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => app?.close());

  it('returns cockpit shell shape for a member without active cycle', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/member/u1/cockpit')
      .expect(200);

    expect(res.body.member.id).toBe('u1');
    expect(res.body.member.name).toBe('Maria');
    expect(res.body.cycle).toBeNull();
    expect(res.body.risk.status).toBe('ON_TRACK');
    expect(res.body.risk.reasons).toEqual([]);
    expect(res.body.range).toBe('cycle');
    expect(typeof res.body.engagement.score).toBe('number');
    expect(Array.isArray(res.body.topicEngagement)).toBe(true);
    expect(Array.isArray(res.body.recentActivity)).toBe(true);
  });

  it('accepts a valid range query param', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/member/u1/cockpit?range=7d')
      .expect(200);

    expect(res.body.range).toBe('7d');
  });

  it('falls back to "cycle" range for invalid range param', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/member/u1/cockpit?range=invalid')
      .expect(200);

    expect(res.body.range).toBe('cycle');
  });
});
