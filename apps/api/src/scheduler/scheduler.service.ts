import { Injectable, Logger } from '@nestjs/common';
import { buildEffectiveIntervals, chunkItems, localMinuteToUtc } from './intervals.js';
import { computeCost } from './objective.js';
import { phase1 } from './phase1.js';
import { phase2 } from './phase2.js';
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

const TIME_BUDGET_MS = 500;
const NODE_BUDGET = 50_000;

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

    const s1 = phase1(chunks, intervals, input.availability.caps, pref);
    const phase1Cost = computeCost(s1, intervals, pref);

    const p2 = phase2(chunks, intervals, input.availability.caps, pref, s1, {
      timeBudgetMs: TIME_BUDGET_MS,
      nodeBudget: NODE_BUDGET,
    });

    const sessions: PlannedSession[] = p2.solution.placements.map((pl) => {
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

    const overflow: OverflowChunk[] = p2.solution.unplaced.map((c) => ({
      itemId: c.itemId,
      minutesRequired: c.minutes,
    }));

    const durationMs = Date.now() - startedAt;
    const diagnostics = {
      phase1Cost,
      finalCost: p2.cost,
      nodesExplored: p2.nodesExplored,
      timedOut: p2.timedOut,
      durationMs,
    };

    this.logger.debug(
      `plan computed · chunks=${chunks.length} intervals=${intervals.length} ` +
      `sessions=${sessions.length} overflow=${overflow.length} ` +
      `phase1=${phase1Cost} final=${p2.cost} nodes=${p2.nodesExplored} ` +
      `timedOut=${p2.timedOut} ${durationMs}ms`,
    );

    return { sessions, overflow, diagnostics };
  }
}
