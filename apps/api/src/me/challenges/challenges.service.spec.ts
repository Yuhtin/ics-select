import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ChallengesService } from './challenges.service';

function makePrismaMock() {
  const state = {
    libraryItem: new Map<string, any>(),
    attempt: new Map<string, any>(),
    membership: null as any,
  };

  return {
    state,
    libraryItem: {
      findUnique: jest.fn(async (args: any) => state.libraryItem.get(args.where.id) ?? null),
    },
    challengeAttempt: {
      findUnique: jest.fn(async (args: any) => state.attempt.get(args.where.id) ?? null),
      create: jest.fn(async (args: any) => {
        const row = {
          id: args.data.id ?? `att-${state.attempt.size + 1}`,
          ...args.data,
          createdAt: new Date(),
        };
        state.attempt.set(row.id, row);
        return row;
      }),
      update: jest.fn(async (args: any) => {
        const existing = state.attempt.get(args.where.id);
        if (!existing) throw new Error('no row to update');
        const updated = { ...existing, ...args.data };
        state.attempt.set(updated.id, updated);
        return updated;
      }),
      findMany: jest.fn(async (args: any) => {
        const rows = [...state.attempt.values()];
        return rows
          .filter((r) => {
            if (args.where?.userId && r.userId !== args.where.userId) return false;
            if (args.where?.libraryItemId && r.libraryItemId !== args.where.libraryItemId) return false;
            if (args.where?.submittedAt?.not === null && !r.submittedAt) return false;
            return true;
          })
          .slice(0, args.take ?? 100);
      }),
      count: jest.fn(async (args: any) => {
        const rows = [...state.attempt.values()];
        return rows.filter((r) => {
          if (args.where?.userId === undefined) {
            // userId not constrained, ignore
          } else if (typeof args.where.userId === 'object' && 'not' in args.where.userId) {
            if (r.userId === args.where.userId.not) return false;
          } else if (r.userId !== args.where.userId) {
            return false;
          }
          if (args.where?.libraryItemId && r.libraryItemId !== args.where.libraryItemId) return false;
          if (args.where?.submittedAt?.not === null && !r.submittedAt) return false;
          if (args.where?.selfRating?.in) {
            const allowed: string[] = args.where.selfRating.in;
            if (!allowed.includes(r.selfRating)) return false;
          }
          return true;
        }).length;
      }),
    },
    cycleMembership: {
      findFirst: jest.fn(async () => state.membership),
    },
    // resolveActiveMembership may also call cycle.findFirst as a fallback.
    cycle: {
      findFirst: jest.fn(async () => null),
    },
  };
}

const SANDBOX_RESULT = {
  status: 'OK',
  exitCode: 0,
  stdout: 'hello',
  stderr: '',
  durationMs: 10,
};

function makeSandboxMock() {
  return {
    runQueued: jest.fn(async () => SANDBOX_RESULT),
    run: jest.fn(async () => SANDBOX_RESULT),
  };
}

function makeRunnerMock() {
  return {
    run: jest.fn(async () => ({
      passed: 2,
      total: 3,
      cases: [
        { name: 'a', hidden: false, status: 'PASS', durationMs: 5 },
        { name: 'b', hidden: false, status: 'PASS', durationMs: 6 },
        { name: 'c', hidden: false, status: 'FAIL', durationMs: 7, stdout: '', expected: 'x' },
      ],
    })),
  };
}

function buildSvc() {
  const prisma = makePrismaMock();
  const sandbox = makeSandboxMock();
  const runner = makeRunnerMock();
  const svc = new ChallengesService(prisma as any, sandbox as any, runner as any);
  return { svc, prisma, sandbox, runner };
}

const NOW = new Date('2026-06-01T15:00:00.000Z');

function seedActiveCycle(prisma: ReturnType<typeof makePrismaMock>, userId = 'u-1') {
  prisma.state.membership = {
    id: 'mem-1',
    userId,
    cycleId: 'cycle-1',
    cycle: {
      id: 'cycle-1',
      status: 'ACTIVE',
      startsAt: new Date(NOW.getTime() - 7 * 86_400_000),
      endsAt: new Date(NOW.getTime() + 30 * 86_400_000),
    },
  };
}

function seedItem(prisma: ReturnType<typeof makePrismaMock>, overrides: Partial<any> = {}) {
  prisma.state.libraryItem.set('lib-1', {
    id: 'lib-1',
    title: 'Two Sum',
    url: 'https://leetcode.com/two-sum',
    format: 'PROBLEM',
    testCases: null,
    testCasesLanguages: [],
    ...overrides,
  });
}

describe('ChallengesService', () => {
  describe('start', () => {
    it('creates an attempt with starter code for the language', async () => {
      const { svc, prisma } = buildSvc();
      seedItem(prisma);
      seedActiveCycle(prisma);
      const out = await svc.start('u-1', { libraryItemId: 'lib-1', language: 'PYTHON' }, NOW);
      expect(out.attemptId).toMatch(/att-/);
      expect(out.starterCode).toMatch(/sys\.stdin/);
      expect(prisma.challengeAttempt.create).toHaveBeenCalled();
      const created = prisma.challengeAttempt.create.mock.calls[0]![0].data;
      expect(created).toMatchObject({
        userId: 'u-1',
        cycleId: 'cycle-1',
        libraryItemId: 'lib-1',
        language: 'PYTHON',
      });
    });

    it('rejects non-PROBLEM library items', async () => {
      const { svc, prisma } = buildSvc();
      seedItem(prisma, { format: 'VIDEO' });
      seedActiveCycle(prisma);
      await expect(
        svc.start('u-1', { libraryItemId: 'lib-1', language: 'CPP' }, NOW),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when member has no active cycle', async () => {
      const { svc, prisma } = buildSvc();
      seedItem(prisma);
      // membership stays null
      await expect(
        svc.start('u-1', { libraryItemId: 'lib-1', language: 'PYTHON' }, NOW),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit', () => {
    function seedAttempt(prisma: ReturnType<typeof makePrismaMock>, started: Date, overrides: Partial<any> = {}) {
      prisma.state.attempt.set('att-1', {
        id: 'att-1',
        userId: 'u-1',
        cycleId: 'cycle-1',
        libraryItemId: 'lib-1',
        language: 'PYTHON',
        startedAt: started,
        submittedAt: null,
        durationSec: 0,
        approachText: '',
        finalCode: '',
        selfRating: 'ABANDONED',
        ...overrides,
      });
    }

    it('computes durationSec from startedAt server-side', async () => {
      const { svc, prisma } = buildSvc();
      seedItem(prisma);
      const startedAt = new Date(NOW.getTime() - 13 * 60 * 1000);
      seedAttempt(prisma, startedAt);
      const submittedAt = NOW;
      await svc.submit(
        'u-1',
        'att-1',
        {
          language: 'PYTHON',
          code: 'print(1)',
          approachText: 'aproach long enough to pass the min',
          selfRating: 'MEDIUM',
        },
        submittedAt,
      );
      const stored = prisma.state.attempt.get('att-1')!;
      expect(stored.durationSec).toBe(13 * 60);
      expect(stored.submittedAt).toEqual(submittedAt);
      expect(stored.selfRating).toBe('MEDIUM');
    });

    it('auto-abandons attempts older than 4 hours and rejects', async () => {
      const { svc, prisma } = buildSvc();
      seedItem(prisma);
      seedAttempt(prisma, new Date(NOW.getTime() - 5 * 3600 * 1000));
      await expect(
        svc.submit(
          'u-1',
          'att-1',
          {
            language: 'PYTHON',
            code: 'print(1)',
            approachText: 'aproach long enough to pass the min',
            selfRating: 'EASY',
          },
          NOW,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
      const stored = prisma.state.attempt.get('att-1')!;
      expect(stored.selfRating).toBe('ABANDONED');
      expect(stored.submittedAt).toEqual(NOW);
    });

    it('runs test cases when item has them AND language is supported', async () => {
      const { svc, prisma, runner } = buildSvc();
      seedItem(prisma, {
        testCases: [{ name: 't1', stdin: '', expectedStdout: 'x' }],
        testCasesLanguages: ['PYTHON'],
      });
      seedAttempt(prisma, new Date(NOW.getTime() - 60 * 1000));
      await svc.submit(
        'u-1',
        'att-1',
        {
          language: 'PYTHON',
          code: 'print("x")',
          approachText: 'aproach long enough to pass the min',
          selfRating: 'EASY',
        },
        NOW,
      );
      expect(runner.run).toHaveBeenCalled();
      const stored = prisma.state.attempt.get('att-1')!;
      expect(stored.testsPassed).toBe(2);
      expect(stored.testsTotal).toBe(3);
    });

    it('skips grading when item has tests but language is not supported', async () => {
      const { svc, prisma, runner } = buildSvc();
      seedItem(prisma, {
        testCases: [{ name: 't1', stdin: '', expectedStdout: 'x' }],
        testCasesLanguages: ['CPP'],
      });
      seedAttempt(prisma, new Date(NOW.getTime() - 60 * 1000));
      await svc.submit(
        'u-1',
        'att-1',
        {
          language: 'PYTHON',
          code: 'print(1)',
          approachText: 'aproach long enough to pass the min',
          selfRating: 'EASY',
        },
        NOW,
      );
      expect(runner.run).not.toHaveBeenCalled();
      const stored = prisma.state.attempt.get('att-1')!;
      expect(stored.testsPassed).toBeNull();
      expect(stored.testsTotal).toBeNull();
    });

    it('rejects when the attempt belongs to someone else', async () => {
      const { svc, prisma } = buildSvc();
      seedItem(prisma);
      seedAttempt(prisma, new Date(NOW.getTime() - 60 * 1000));
      await expect(
        svc.submit(
          'other-user',
          'att-1',
          {
            language: 'PYTHON',
            code: 'print(1)',
            approachText: 'aproach long enough to pass the min',
            selfRating: 'EASY',
          },
          NOW,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects re-submission of an already-submitted attempt', async () => {
      const { svc, prisma } = buildSvc();
      seedItem(prisma);
      seedAttempt(prisma, new Date(NOW.getTime() - 60 * 1000), { submittedAt: new Date() });
      await expect(
        svc.submit(
          'u-1',
          'att-1',
          {
            language: 'PYTHON',
            code: 'print(1)',
            approachText: 'aproach long enough to pass the min',
            selfRating: 'EASY',
          },
          NOW,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('abandon', () => {
    it('marks ABANDONED and stamps duration', async () => {
      const { svc, prisma } = buildSvc();
      prisma.state.attempt.set('att-1', {
        id: 'att-1',
        userId: 'u-1',
        startedAt: new Date(NOW.getTime() - 30_000),
        submittedAt: null,
        durationSec: 0,
        selfRating: 'ABANDONED',
        finalCode: '',
      });
      await svc.abandon('u-1', 'att-1', NOW);
      const stored = prisma.state.attempt.get('att-1')!;
      expect(stored.submittedAt).toEqual(NOW);
      expect(stored.durationSec).toBe(30);
      expect(stored.selfRating).toBe('ABANDONED');
    });

    it('is idempotent — returns the row unchanged if already submitted', async () => {
      const { svc, prisma } = buildSvc();
      const submitted = new Date(NOW.getTime() - 1000);
      prisma.state.attempt.set('att-1', {
        id: 'att-1',
        userId: 'u-1',
        startedAt: new Date(NOW.getTime() - 60_000),
        submittedAt: submitted,
        selfRating: 'EASY',
      });
      const result = await svc.abandon('u-1', 'att-1', NOW);
      expect(result.submittedAt).toEqual(submitted);
      expect(result.selfRating).toBe('EASY');
    });
  });

  describe('cohortForItem', () => {
    it('returns locked + count when member has not submitted', async () => {
      const { svc, prisma } = buildSvc();
      prisma.state.attempt.set('att-other', {
        id: 'att-other',
        userId: 'u-2',
        libraryItemId: 'lib-1',
        submittedAt: NOW,
        selfRating: 'EASY',
      });
      const out = await svc.cohortForItem('u-1', 'lib-1');
      expect(out.unlocked).toBe(false);
      expect(out.count).toBe(1);
      expect(out.attempts).toEqual([]);
    });

    it('unlocks once the member has a non-abandoned submitted attempt', async () => {
      const { svc, prisma } = buildSvc();
      prisma.state.attempt.set('att-mine', {
        id: 'att-mine',
        userId: 'u-1',
        libraryItemId: 'lib-1',
        submittedAt: NOW,
        selfRating: 'MEDIUM',
        durationSec: 600,
        approachText: 'my approach',
        finalCode: '...',
        language: 'PYTHON',
      });
      // The real implementation joins user via prisma include — our mock
      // ignores include so the returned rows won't have user shape. We
      // assert only the unlock signal here.
      const out = await svc.cohortForItem('u-1', 'lib-1');
      expect(out.unlocked).toBe(true);
    });

    it('treats ABANDONED submissions as not-submitted for the gate', async () => {
      const { svc, prisma } = buildSvc();
      prisma.state.attempt.set('att-mine', {
        id: 'att-mine',
        userId: 'u-1',
        libraryItemId: 'lib-1',
        submittedAt: NOW,
        selfRating: 'ABANDONED',
        durationSec: 30,
      });
      const out = await svc.cohortForItem('u-1', 'lib-1');
      expect(out.unlocked).toBe(false);
    });
  });

  describe('autoSaveCode', () => {
    it('persists code on the attempt and refuses after submission', async () => {
      const { svc, prisma } = buildSvc();
      prisma.state.attempt.set('att-1', {
        id: 'att-1',
        userId: 'u-1',
        startedAt: new Date(),
        submittedAt: null,
        finalCode: 'old',
        language: 'PYTHON',
      });
      await svc.autoSaveCode('u-1', 'att-1', { language: 'PYTHON', code: 'new' });
      expect(prisma.state.attempt.get('att-1')!.finalCode).toBe('new');

      prisma.state.attempt.set('att-2', {
        id: 'att-2',
        userId: 'u-1',
        startedAt: new Date(),
        submittedAt: new Date(),
        finalCode: 'frozen',
      });
      await expect(
        svc.autoSaveCode('u-1', 'att-2', { language: 'PYTHON', code: 'late' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ownership', () => {
    it('rejects loads of attempts owned by other members', async () => {
      const { svc, prisma } = buildSvc();
      prisma.state.attempt.set('att-1', { id: 'att-1', userId: 'u-2', startedAt: new Date(), submittedAt: null });
      await expect(svc.abandon('u-1', 'att-1', NOW)).rejects.toThrow(ForbiddenException);
    });

    it('404s missing attempts', async () => {
      const { svc } = buildSvc();
      await expect(svc.abandon('u-1', 'missing', NOW)).rejects.toThrow(NotFoundException);
    });
  });
});
