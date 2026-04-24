import { computeCost, minCostRemaining } from './objective.js';
import type {
  Chunk,
  EffectiveInterval,
  Placement,
  Solution,
} from './scheduler.types.js';

const BUFFER_MINUTES = 10;

export type Phase2Options = {
  timeBudgetMs: number;
  nodeBudget: number;
};

export type Phase2Result = {
  solution: Solution;
  cost: number;
  nodesExplored: number;
  timedOut: boolean;
};

/**
 * Branch-and-bound refinement. Chunks are tried in the same order as phase 1
 * (size desc, order asc). Candidate placements are explored in rank order:
 * (dayLoad asc, |interval_size - chunk_size| asc, interval_start asc).
 */
export function phase2(
  chunks: Chunk[],
  intervals: EffectiveInterval[],
  caps: (number | null)[],
  pref: number,
  initial: Solution,
  options: Phase2Options,
): Phase2Result {
  const ordered = [...chunks].sort((a, b) =>
    b.minutes - a.minutes || a.order - b.order,
  );

  let best: Solution = initial;
  let bestCost = computeCost(initial, intervals, pref);
  const startedAt = Date.now();
  const deadline = startedAt + options.timeBudgetMs;
  let nodesExplored = 0;
  let timedOut = false;

  type State = {
    cursors: number[];
    dayLoad: number[];
    placements: Placement[];
    unplaced: Chunk[];
  };

  const state: State = {
    cursors: intervals.map(() => 0),
    dayLoad: [0, 0, 0, 0, 0, 0, 0],
    placements: [],
    unplaced: [],
  };

  const tryFinalize = () => {
    const sol: Solution = {
      placements: [...state.placements],
      unplaced: [...state.unplaced],
    };
    const cost = computeCost(sol, intervals, pref);
    if (cost < bestCost) {
      bestCost = cost;
      best = sol;
    }
  };

  function recurse(chunkIdx: number): void {
    if (nodesExplored >= options.nodeBudget) { timedOut = true; return; }
    if (Date.now() >= deadline) { timedOut = true; return; }
    nodesExplored += 1;

    if (chunkIdx >= ordered.length) {
      tryFinalize();
      return;
    }

    const chunk = ordered[chunkIdx]!;

    const partial: Solution = {
      placements: state.placements,
      unplaced: state.unplaced,
    };
    const lb = computeCost(partial, intervals, pref)
      + minCostRemaining(ordered.slice(chunkIdx), intervals, pref);
    if (lb >= bestCost) return;

    type Cand = { idx: number; score: [number, number, number] };
    const candidates: Cand[] = [];
    for (let idx = 0; idx < intervals.length; idx++) {
      const iv = intervals[idx]!;
      if (iv.endMinute - iv.startMinute < pref && iv.slotSize >= pref) continue;
      const size = iv.endMinute - iv.startMinute;
      const remainingInInterval = size - state.cursors[idx]!;
      if (remainingInInterval < chunk.minutes) continue;
      const cap = caps[iv.dayIdx];
      if (cap !== null && cap !== undefined && state.dayLoad[iv.dayIdx]! + chunk.minutes > cap) continue;
      candidates.push({
        idx,
        score: [state.dayLoad[iv.dayIdx]!, Math.abs(size - chunk.minutes), iv.startMinute],
      });
    }
    candidates.sort((a, b) => {
      for (let i = 0; i < 3; i++) if (a.score[i]! !== b.score[i]!) return a.score[i]! - b.score[i]!;
      return 0;
    });

    for (const cand of candidates) {
      const iv = intervals[cand.idx]!;
      const offset = state.cursors[cand.idx]!;
      state.placements.push({ chunk, intervalIdx: cand.idx, offsetInInterval: offset });
      const prevCursor = state.cursors[cand.idx]!;
      state.cursors[cand.idx] = Math.min(prevCursor + chunk.minutes + BUFFER_MINUTES, iv.endMinute - iv.startMinute);
      state.dayLoad[iv.dayIdx]! += chunk.minutes;

      recurse(chunkIdx + 1);

      state.placements.pop();
      state.cursors[cand.idx] = prevCursor;
      state.dayLoad[iv.dayIdx]! -= chunk.minutes;

      if (timedOut) return;
    }

    // Also try leaving the chunk unplaced
    state.unplaced.push(chunk);
    recurse(chunkIdx + 1);
    state.unplaced.pop();
  }

  recurse(0);
  return { solution: best, cost: bestCost, nodesExplored, timedOut };
}
