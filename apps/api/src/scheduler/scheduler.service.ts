import { Injectable, Logger } from '@nestjs/common';
import { buildEffectiveIntervals, chunkItems, localMinuteToUtc } from './intervals.js';
import { computeCost } from './objective.js';
import { phase1 } from './phase1.js';
import type {
  SchedulerInput,
  SchedulerOutput,
  PlannedSession,
  OverflowChunk,
} from './scheduler.types.js';

export type {
  SchedulerInput,
  SchedulerOutput,
  ItemInput,
  AvailabilitySlotInput,
  BusyBlock,
} from './scheduler.types.js';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  plan(input: SchedulerInput): SchedulerOutput {
    const startedAt = Date.now();
    const pref = input.availability.preferredSessionMinutes;
    const tz = input.availability.timezone;
    const now = input.now ?? new Date();

    const tIntervals = Date.now();
    const intervals = buildEffectiveIntervals(
      input.availability.slots,
      input.busyBlocks,
      input.weekStart,
      tz,
      now,
    );
    const intervalsMs = Date.now() - tIntervals;

    const tChunks = Date.now();
    const chunks = chunkItems(input.items, pref);
    const chunksMs = Date.now() - tChunks;

    const tPhase1 = Date.now();
    const solution = phase1(
      chunks,
      intervals,
      input.availability.caps,
      pref,
      input.relaxOrder ?? false,
    );
    const phase1Ms = Date.now() - tPhase1;

    const tCost = Date.now();
    const cost = computeCost(solution, intervals, pref);
    const costMs = Date.now() - tCost;

    const tSessions = Date.now();
    const sessions: PlannedSession[] = solution.placements.map((pl) => {
      const iv = intervals[pl.intervalIdx]!;
      const scheduledAt = localMinuteToUtc(
        input.weekStart,
        iv.dayIdx,
        iv.startMinute + pl.offsetInInterval,
        tz,
      );
      return {
        itemId: pl.chunk.itemId,
        scheduledAt,
        durationMinutes: pl.chunk.minutes,
      };
    });
    const sessionsMs = Date.now() - tSessions;

    const overflow: OverflowChunk[] = solution.unplaced.map((c) => ({
      itemId: c.itemId,
      minutesRequired: c.minutes,
    }));

    const durationMs = Date.now() - startedAt;
    const diagnostics = { cost, durationMs };

    this.logger.log(
      `[bench] scheduler.plan total=${durationMs}ms · ` +
      `buildIntervals=${intervalsMs}ms(n=${intervals.length}) ` +
      `chunkItems=${chunksMs}ms(n=${chunks.length}) ` +
      `phase1=${phase1Ms}ms ` +
      `computeCost=${costMs}ms ` +
      `mapSessions=${sessionsMs}ms(n=${sessions.length}) ` +
      `· slots=${input.availability.slots.length} ` +
      `items=${input.items.length} ` +
      `busyBlocks=${input.busyBlocks.length} ` +
      `overflow=${overflow.length} cost=${cost}`,
    );

    return { sessions, overflow, diagnostics };
  }
}
