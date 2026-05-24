import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ChallengeAttempt, ChallengeLanguage, ChallengeRating } from '@ics-select/prisma';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { resolveActiveMembership } from '../../common/cycle/active-cycle.js';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import { TestRunnerService } from '../../sandbox/test-runner.service.js';
import { STARTER_CODE } from '../../sandbox/templates.js';
import type { TestCase } from '../../sandbox/runner.types.js';
import type {
  AutoSaveCodeInput,
  RunChallengeInput,
  StartChallengeInput,
  SubmitChallengeInput,
} from './dto.js';

// Attempts that hit four wall-clock hours without a submit are stale —
// the member closed the tab, fell asleep, switched device, whatever. We
// refuse to submit them so the durationSec stays honest. Tweak by editing
// here if real usage shows 4h is too short (or too long).
const STALE_ATTEMPT_MS = 4 * 60 * 60 * 1000;

const SUBMITTABLE_RATINGS: ReadonlySet<ChallengeRating> = new Set([
  'EASY',
  'MEDIUM',
  'HARD',
]);

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: SandboxService,
    private readonly testRunner: TestRunnerService,
  ) {}

  /**
   * Creates a fresh ChallengeAttempt for the member against a PROBLEM
   * library item. Returns the starter code so the editor opens populated
   * instead of empty.
   */
  async start(userId: string, input: StartChallengeInput, now: Date = new Date()) {
    const item = await this.prisma.libraryItem.findUnique({
      where: { id: input.libraryItemId },
    });
    if (!item) throw new NotFoundException('library item not found');
    if (item.format !== 'PROBLEM') {
      throw new BadRequestException('challenge mode only applies to PROBLEM items');
    }

    const membership = await resolveActiveMembership(this.prisma, userId, now);
    if (!membership) throw new BadRequestException('no active cycle membership');

    const attempt = await this.prisma.challengeAttempt.create({
      data: {
        userId,
        cycleId: membership.cycleId,
        libraryItemId: item.id,
        language: input.language,
        startedAt: now,
        // Pre-fill finalCode with the starter so an immediate abandon still
        // captures something useful. Auto-save overwrites this on the way.
        finalCode: STARTER_CODE[input.language],
        approachText: '',
        selfRating: 'ABANDONED',
      },
    });

    return {
      attemptId: attempt.id,
      startedAt: attempt.startedAt.toISOString(),
      starterCode: STARTER_CODE[input.language],
    };
  }

  /**
   * Pipes ad-hoc stdin through the member's current code. Used by the Run
   * button in the editor — does NOT update durationSec, finalCode or any
   * graded fields. Pure scratchpad.
   */
  async run(userId: string, attemptId: string, input: RunChallengeInput) {
    const attempt = await this.loadOwnedAttempt(userId, attemptId);
    this.ensureNotSubmitted(attempt);

    return this.sandbox.runQueued(
      {
        language: input.language,
        code: input.code,
        stdin: input.stdin,
        timeoutMs: 5_000,
      },
      { userId, attemptId: attempt.id },
    );
  }

  /**
   * Closes the attempt: stamps submittedAt, durationSec, finalCode,
   * approachText, selfRating, notes, and runs every test case on the item
   * in parallel-through-the-queue. The result is persisted on the attempt
   * row so the cockpit + diagnose can read it later without re-running.
   */
  async submit(userId: string, attemptId: string, input: SubmitChallengeInput, now: Date = new Date()) {
    const attempt = await this.loadOwnedAttempt(userId, attemptId);
    this.ensureNotSubmitted(attempt);

    const durationMs = now.getTime() - attempt.startedAt.getTime();
    if (durationMs > STALE_ATTEMPT_MS) {
      // Long-running tab. Don't accept the submit — auto-abandon and tell
      // the frontend to surface the message. Keeps durationSec honest.
      await this.prisma.challengeAttempt.update({
        where: { id: attempt.id },
        data: {
          submittedAt: now,
          durationSec: Math.floor(durationMs / 1000),
          finalCode: input.code,
          approachText: input.approachText,
          selfRating: 'ABANDONED',
          notes: input.notes ?? null,
        },
      });
      throw new UnprocessableEntityException({
        error: {
          code: 'CHALLENGE_STALE',
          message: `Attempt is older than ${STALE_ATTEMPT_MS / 3_600_000}h — auto-abandoned. Start a fresh attempt.`,
        },
      });
    }

    const item = await this.prisma.libraryItem.findUnique({
      where: { id: attempt.libraryItemId },
    });
    if (!item) throw new NotFoundException('library item not found');

    const testCases = readTestCases(item.testCases);
    const itemSupportsLang =
      (item.testCasesLanguages ?? []).includes(input.language as ChallengeLanguage);
    const shouldGrade = testCases.length > 0 && itemSupportsLang;

    let testsPassed: number | null = null;
    let testsTotal: number | null = null;
    let testResultsJson: unknown | null = null;

    if (shouldGrade) {
      const runResult = await this.testRunner.run(
        { language: input.language, code: input.code, testCases },
        { userId, attemptId: attempt.id },
      );
      testsPassed = runResult.passed;
      testsTotal = runResult.total;
      testResultsJson = runResult.cases as unknown;
    }

    const durationSec = Math.max(0, Math.floor(durationMs / 1000));
    const updated = await this.prisma.challengeAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: now,
        durationSec,
        language: input.language,
        finalCode: input.code,
        approachText: input.approachText,
        selfRating: input.selfRating,
        notes: input.notes ?? null,
        testsPassed,
        testsTotal,
        testResults: testResultsJson as any,
      },
    });

    return updated;
  }

  /**
   * Marks an attempt ABANDONED. Saves whatever code the member had typed
   * so the admin can see what stage they were at. Idempotent.
   */
  async abandon(userId: string, attemptId: string, now: Date = new Date()) {
    const attempt = await this.loadOwnedAttempt(userId, attemptId);
    if (attempt.submittedAt) return attempt;

    const durationSec = Math.max(0, Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000));
    return this.prisma.challengeAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: now,
        durationSec,
        selfRating: 'ABANDONED',
      },
    });
  }

  /**
   * Auto-save during the attempt. The frontend debounces locally and POSTs
   * every ~10s — server-side is just a write. We accept very short codes
   * because the early auto-save might fire before the member has typed
   * anything substantial.
   */
  async autoSaveCode(userId: string, attemptId: string, input: AutoSaveCodeInput) {
    const attempt = await this.loadOwnedAttempt(userId, attemptId);
    this.ensureNotSubmitted(attempt);
    await this.prisma.challengeAttempt.update({
      where: { id: attempt.id },
      data: {
        language: input.language,
        finalCode: input.code,
      },
    });
    return { ok: true };
  }

  /**
   * Single attempt + the library item it targets. Used by the editor page
   * on mount/refresh to hydrate the timer from the server-authoritative
   * `startedAt` and recover saved code if the member is back from another
   * device.
   */
  async getAttempt(userId: string, attemptId: string) {
    const row = await this.prisma.challengeAttempt.findUnique({
      where: { id: attemptId },
      include: {
        libraryItem: {
          select: {
            id: true,
            title: true,
            url: true,
            description: true,
            testCases: true,
            testCasesLanguages: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('attempt not found');
    if (row.userId !== userId) throw new ForbiddenException('not your attempt');
    return row;
  }

  /** Member's own history against a specific library item. */
  listForMemberOnItem(userId: string, libraryItemId: string) {
    return this.prisma.challengeAttempt.findMany({
      where: { userId, libraryItemId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Cohort history for a single library item. Gated: until the member has
   * a non-abandoned submitted attempt themselves, return only `count`.
   * After they submit one, return the full list with approachText + code.
   * The lock-then-reveal pattern shows up in the spec under "Histórico
   * bloqueado até submeter o seu".
   */
  async cohortForItem(userId: string, libraryItemId: string) {
    const ownSubmitted = await this.prisma.challengeAttempt.count({
      where: {
        userId,
        libraryItemId,
        submittedAt: { not: null },
        selfRating: { in: ['EASY', 'MEDIUM', 'HARD'] },
      },
    });

    if (ownSubmitted === 0) {
      const count = await this.prisma.challengeAttempt.count({
        where: {
          libraryItemId,
          submittedAt: { not: null },
          selfRating: { in: ['EASY', 'MEDIUM', 'HARD'] },
          userId: { not: userId },
        },
      });
      return { unlocked: false as const, count, attempts: [] };
    }

    const rows = await this.prisma.challengeAttempt.findMany({
      where: {
        libraryItemId,
        submittedAt: { not: null },
        selfRating: { in: ['EASY', 'MEDIUM', 'HARD'] },
      },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, name: true, pictureUrl: true } },
      },
    });

    return {
      unlocked: true as const,
      count: rows.length,
      attempts: rows.map((r) => ({
        id: r.id,
        user: r.user,
        language: r.language,
        durationSec: r.durationSec,
        submittedAt: r.submittedAt!.toISOString(),
        selfRating: r.selfRating,
        approachText: r.approachText,
        finalCode: r.finalCode,
        testsPassed: r.testsPassed,
        testsTotal: r.testsTotal,
      })),
    };
  }

  // ------------------------------------------------------------------ guards

  private async loadOwnedAttempt(userId: string, attemptId: string): Promise<ChallengeAttempt> {
    const row = await this.prisma.challengeAttempt.findUnique({ where: { id: attemptId } });
    if (!row) throw new NotFoundException('attempt not found');
    if (row.userId !== userId) throw new ForbiddenException('not your attempt');
    return row;
  }

  private ensureNotSubmitted(attempt: ChallengeAttempt) {
    if (attempt.submittedAt) {
      throw new BadRequestException('attempt already finished');
    }
  }
}

/**
 * Coerce the JSON column into a typed TestCase[]. The admin endpoint
 * validated the structure on write; we just guard against null + bad
 * shapes here so a corrupt row doesn't crash the runner.
 */
function readTestCases(json: unknown): TestCase[] {
  if (!Array.isArray(json)) return [];
  const out: TestCase[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.name !== 'string' || typeof obj.stdin !== 'string' || typeof obj.expectedStdout !== 'string') continue;
    out.push({
      name: obj.name,
      stdin: obj.stdin,
      expectedStdout: obj.expectedStdout,
      hidden: obj.hidden === true,
    });
  }
  return out;
}
