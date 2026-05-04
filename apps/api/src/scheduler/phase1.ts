import type {
  Chunk,
  EffectiveInterval,
  Placement,
  Solution,
} from './scheduler.types.js';

const BUFFER_MINUTES = 10;

type IntervalState = {
  cursorOffset: number; // next free offset within interval (includes inter-session buffer)
  usedMinutes: number;  // pure study content placed (excludes buffers)
};

/**
 * Order-strict greedy placement.
 *
 * Hard constraint: chunks are placed in strict (item.order, seq) order, and
 * each placement starts at or after the wall-clock end of the previous one.
 * Within that constraint, candidates are scored to pack the week tightly:
 *
 *   1. placement wall-clock asc        — earliest first; never skip capacity.
 *   2. residue-in-big-slot asc         — avoid burning a big slot with a small chunk.
 *   3. |interval_size - chunk_size| asc — prefer tight fit.
 *   4. interval_start asc              — deterministic tiebreak.
 *
 * Rule iii (preserved): an interval is unusable iff
 *   interval.size < pref AND slot.size >= pref
 * (i.e., a busy block carved a sub-pref remnant out of a big slot).
 */
export function phase1(
  chunks: Chunk[],
  intervals: EffectiveInterval[],
  caps: (number | null)[],
  pref: number,
): Solution {
  const ordered = [...chunks].sort((a, b) =>
    a.order - b.order || a.seq - b.seq,
  );

  const states: IntervalState[] = intervals.map(() => ({
    cursorOffset: 0,
    usedMinutes: 0,
  }));
  const dayLoad = [0, 0, 0, 0, 0, 0, 0];

  // Wall-clock cursor as minute-of-week. Initialized below the earliest possible
  // placement so the first chunk is unconstrained.
  let cursorMOW = -1;

  const placements: Placement[] = [];
  const unplaced: Chunk[] = [];

  for (const chunk of ordered) {
    type Cand = {
      idx: number;
      offset: number;
      placementMOW: number;
      score: [number, number, number, number];
    };
    const candidates: Cand[] = [];

    for (let idx = 0; idx < intervals.length; idx++) {
      const iv = intervals[idx]!;
      const intervalSize = iv.endMinute - iv.startMinute;

      // Rule iii.
      if (intervalSize < pref && iv.slotSize >= pref) continue;

      const intervalStartMOW = iv.dayIdx * 1440 + iv.startMinute;

      // Earliest offset honoring (a) what's already placed in this interval and
      // (b) the global wall-clock cursor (no chunk may start before the previous
      // chunk's end).
      const minOffsetByCursor = Math.max(0, cursorMOW - intervalStartMOW);
      const offset = Math.max(states[idx]!.cursorOffset, minOffsetByCursor);

      if (offset + chunk.minutes > intervalSize) continue;

      const cap = caps[iv.dayIdx];
      if (cap !== null && cap !== undefined && dayLoad[iv.dayIdx]! + chunk.minutes > cap) continue;

      const placementMOW = intervalStartMOW + offset;
      const residueInBig = chunk.isResidue && iv.slotSize >= pref ? 1 : 0;
      candidates.push({
        idx,
        offset,
        placementMOW,
        score: [placementMOW, residueInBig, Math.abs(intervalSize - chunk.minutes), iv.startMinute],
      });
    }

    if (candidates.length === 0) {
      unplaced.push(chunk);
      continue;
    }

    candidates.sort((a, b) => {
      for (let i = 0; i < 4; i++) if (a.score[i]! !== b.score[i]!) return a.score[i]! - b.score[i]!;
      return 0;
    });
    const pick = candidates[0]!;
    const iv = intervals[pick.idx]!;
    const intervalSize = iv.endMinute - iv.startMinute;
    const st = states[pick.idx]!;

    placements.push({
      chunk,
      intervalIdx: pick.idx,
      offsetInInterval: pick.offset,
    });
    st.usedMinutes += chunk.minutes;
    st.cursorOffset = Math.min(pick.offset + chunk.minutes + BUFFER_MINUTES, intervalSize);
    dayLoad[iv.dayIdx]! += chunk.minutes;
    cursorMOW = pick.placementMOW + chunk.minutes;
  }

  return { placements, unplaced };
}
