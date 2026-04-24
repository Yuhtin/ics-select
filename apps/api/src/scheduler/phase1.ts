import type {
  Chunk,
  EffectiveInterval,
  Placement,
  Solution,
} from './scheduler.types.js';

const BUFFER_MINUTES = 10;

type IntervalState = {
  idx: number;
  cursor: number;      // next session start offset within interval (includes inter-session buffers)
  usedMinutes: number; // pure study content placed (excludes buffers) — used for capacity check
};

/**
 * Phase 1: First-Fit-Decreasing greedy construction.
 *
 * Rank candidate (day, interval) placements by:
 *   1. dayLoad[day] asc          — prefer least-loaded day (balance)
 *   2. |interval_size - chunk_size| asc — smallest-fit wins (preserves big slots)
 *   3. interval_start asc        — deterministic tiebreak
 *
 * Rule iii: an interval is unusable iff interval.size < pref AND slot.size >= pref.
 */
export function phase1(
  chunks: Chunk[],
  intervals: EffectiveInterval[],
  caps: (number | null)[],
  pref: number,
): Solution {
  const ordered = [...chunks].sort((a, b) =>
    b.minutes - a.minutes || a.order - b.order,
  );

  const states: IntervalState[] = intervals.map((iv, idx) => ({
    idx,
    cursor: 0,
    usedMinutes: 0,
  }));
  const dayLoad = [0, 0, 0, 0, 0, 0, 0];

  const placements: Placement[] = [];
  const unplaced: Chunk[] = [];

  for (const chunk of ordered) {
    type Cand = { idx: number; score: [number, number, number] };
    const candidates: Cand[] = [];
    for (const st of states) {
      const iv = intervals[st.idx]!;
      // Usability (rule iii)
      if (iv.endMinute - iv.startMinute < pref && iv.slotSize >= pref) continue;
      if (iv.endMinute - iv.startMinute - st.usedMinutes < chunk.minutes) continue;
      const cap = caps[iv.dayIdx];
      if (cap !== null && cap !== undefined && dayLoad[iv.dayIdx]! + chunk.minutes > cap) continue;
      const intervalSize = iv.endMinute - iv.startMinute;
      candidates.push({
        idx: st.idx,
        score: [dayLoad[iv.dayIdx]!, Math.abs(intervalSize - chunk.minutes), iv.startMinute],
      });
    }
    if (candidates.length === 0) {
      unplaced.push(chunk);
      continue;
    }
    candidates.sort((a, b) => {
      for (let i = 0; i < 3; i++) if (a.score[i]! !== b.score[i]!) return a.score[i]! - b.score[i]!;
      return 0;
    });
    const pick = candidates[0]!;
    const st = states.find((s) => s.idx === pick.idx)!;
    const iv = intervals[pick.idx]!;
    placements.push({
      chunk,
      intervalIdx: pick.idx,
      offsetInInterval: st.cursor,
    });
    st.usedMinutes += chunk.minutes;
    // cursor advances by content + buffer so the next session starts after a gap
    st.cursor = Math.min(st.cursor + chunk.minutes + BUFFER_MINUTES, iv.endMinute - iv.startMinute);
    dayLoad[iv.dayIdx]! += chunk.minutes;
  }

  return { placements, unplaced };
}
