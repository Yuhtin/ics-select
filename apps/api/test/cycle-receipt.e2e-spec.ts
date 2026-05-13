/**
 * E2E smoke test for GET /admin/cycle/:id/receipt
 *
 * Mirrors cockpit.e2e-spec.ts strategy:
 *   1. Registers CycleReceiptController + CycleReceiptService directly.
 *   2. Provides PrismaService as a pure in-memory fake.
 *   3. Overrides APP_GUARD with AllowAllGuard.
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
import { CycleReceiptController } from '../src/admin/cycle-receipt/cycle-receipt.controller';
import { CycleReceiptService } from '../src/admin/cycle-receipt/cycle-receipt.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

@Injectable()
class AllowAllGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.user = { sub: 'admin-id', email: 'admin@sou.inteli.edu.br', role: 'ADMIN' };
    return true;
  }
}

type FakePrisma = {
  cycle: { findUnique: jest.Mock };
  weeklyPlanItem: { findMany: jest.Mock };
  weeklyRetro: { groupBy: jest.Mock };
  classSession: { findMany: jest.Mock };
  classAttendance: { findMany: jest.Mock };
};

function makeFakePrisma(): FakePrisma {
  return {
    cycle: { findUnique: jest.fn() },
    weeklyPlanItem: { findMany: jest.fn().mockResolvedValue([]) },
    weeklyRetro: { groupBy: jest.fn().mockResolvedValue([]) },
    classSession: { findMany: jest.fn().mockResolvedValue([]) },
    classAttendance: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('GET /admin/cycle/:id/receipt (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeAll(async () => {
    prisma = makeFakePrisma();
    const mod = await Test.createTestingModule({
      controllers: [CycleReceiptController],
      providers: [
        CycleReceiptService,
        { provide: PrismaService, useValue: prisma },
        { provide: APP_GUARD, useClass: AllowAllGuard },
      ],
    }).compile();

    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => app?.close());

  it('returns 200 with payload for a valid cycle and asOf', async () => {
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Ciclo 4',
      status: 'ACTIVE',
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-01T00:00:00Z'),
      memberships: [],
    });

    const res = await request(app.getHttpServer())
      .get('/admin/cycle/c1/receipt?asOf=2026-05-12')
      .expect(200);

    expect(res.body.cycle.id).toBe('c1');
    expect(res.body.mode).toBe('thermal');
    expect(res.body.totals.members).toBe(0);
  });

  it('returns 400 when asOf is out of cycle range', async () => {
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c2',
      name: 'Ciclo 4',
      status: 'ACTIVE',
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-01T00:00:00Z'),
      memberships: [],
    });

    await request(app.getHttpServer())
      .get('/admin/cycle/c2/receipt?asOf=2026-01-01')
      .expect(400);
  });

  it('returns 409 when cycle is UPCOMING and has not started', async () => {
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c3',
      name: 'Ciclo 5',
      status: 'ACTIVE',
      startsAt: new Date('2030-01-01T00:00:00Z'),
      endsAt: new Date('2030-03-01T00:00:00Z'),
      memberships: [],
    });

    await request(app.getHttpServer())
      .get('/admin/cycle/c3/receipt')
      .expect(409);
  });

  it('returns 404 when cycle does not exist', async () => {
    prisma.cycle.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/admin/cycle/missing/receipt')
      .expect(404);
  });
});
