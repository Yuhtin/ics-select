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

    const intervals = buildEffectiveIntervals(
      input.availability.slots,
      input.busyBlocks,
      input.weekStart,
      tz,
      now,
    );
    const chunks = chunkItems(input.items, pref);

    const solution = phase1(chunks, intervals, input.availability.caps, pref);
    const cost = computeCost(solution, intervals, pref);

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

    const overflow: OverflowChunk[] = solution.unplaced.map((c) => ({
      itemId: c.itemId,
      minutesRequired: c.minutes,
    }));

    const durationMs = Date.now() - startedAt;
    const diagnostics = { cost, durationMs };

    this.logger.debug(
      `plan computed · chunks=${chunks.length} intervals=${intervals.length} ` +
      `sessions=${sessions.length} overflow=${overflow.length} ` +
      `cost=${cost} ${durationMs}ms`,
    );

    return { sessions, overflow, diagnostics };
  }
}
