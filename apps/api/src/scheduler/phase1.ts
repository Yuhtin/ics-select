import type {
  Chunk,
  EffectiveInterval,
  Placement,
  Solution,
} from './scheduler.types.js';

const BUFFER_MINUTES = 10;
const SESSION_GRANULARITY_MINUTES = 15;

type IntervalState = {
  cursorOffset: number; // next free offset within interval (includes inter-session buffer)
  usedMinutes: number;  // pure study content placed (excludes buffers)
};

/**
 * Longest session a day can host: the preferred session, clamped to the day
 * cap and rounded down to the 15-min grid (never below 15). A member who
 * declares "30 minutes a day" with a 60-min preferred session studies in
 * 30-min sessions on that day — the cap wins over the preference.
 */
function sessionUnitFor(cap: number | null | undefined, pref: number): number {
  if (cap === null || cap === undefined) return pref;
  const clamped = Math.min(pref, cap);
  return Math.max(
    SESSION_GRANULARITY_MINUTES,
    Math.floor(clamped / SESSION_GRANULARITY_MINUTES) * SESSION_GRANULARITY_MINUTES,
  );
}

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
 * Chunks arrive sliced by the preferred session. On a day whose cap is
 * smaller than that, a chunk is placed as one cap-sized session and its
 * remainder goes back to the front of the queue, so it lands next (on a
 * later day, since the cap is now full). Only whole sessions are placed —
 * leftover cap room smaller than the day's session stays empty rather than
 * receiving a sliver.
 *
 * Rule iii (preserved): an interval is unusable iff
 *   interval.size < unit AND slot.size > unit
 * (i.e., a busy block carved a sub-session remnant out of a big slot), where
 * unit is the day's session length.
 */
export function phase1(
  chunks: Chunk[],
  intervals: EffectiveInterval[],
  caps: (number | null)[],
  pref: number,
  relaxOrder = false,
): Solution {
  // Strict mode (default): place chunks in (order, seq) — pedagogical sequence
  // is preserved, and the wall-clock cursor below prevents reordering.
  // Relaxed mode: first-fit-decreasing — pack larger chunks first to maximize
  // total minutes placed. Within equal sizes, keep (order, seq) for determinism.
  const queue = relaxOrder
    ? [...chunks].sort(
        (a, b) =>
          b.minutes - a.minutes || a.order - b.order || a.seq - b.seq,
      )
    : [...chunks].sort((a, b) => a.order - b.order || a.seq - b.seq);

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

  while (queue.length > 0) {
    const chunk = queue.shift()!;
    type Cand = {
      idx: number;
      offset: number;
      minutes: number;
      placementMOW: number;
      score: [number, number, number, number];
    };
    const candidates: Cand[] = [];

    for (let idx = 0; idx < intervals.length; idx++) {
      const iv = intervals[idx]!;
      const intervalSize = iv.endMinute - iv.startMinute;
      const cap = caps[iv.dayIdx];
      const unit = sessionUnitFor(cap, pref);
      // What this chunk contributes to this day: the whole chunk, or one
      // cap-sized session of it when the chunk is longer than the day allows.
      const minutes = Math.min(chunk.minutes, unit);

      // Rule iii: skip sub-session remnants carved out of slots larger than the
      // session. The intent is to avoid burning a small leftover window on a
      // residue chunk when the original big slot still has a larger interval
      // available that could host a full session.
      //
      // We use slotSize > unit (strictly greater) rather than >= unit:
      // when slotSize == unit the slot was only ever big enough for one full
      // session, so any carved remnant is the only option — skipping it creates
      // avoidable overflow (e.g. a 60-min slot carved to 45 min by an existing
      // own-event; a 30-min residue chunk fits there but would be rejected).
      if (intervalSize < unit && iv.slotSize > unit) continue;

      const intervalStartMOW = iv.dayIdx * 1440 + iv.startMinute;

      // Earliest offset honoring (a) what's already placed in this interval and
      // (b) the global wall-clock cursor (no chunk may start before the previous
      // chunk's end). In relaxed mode, the wall-clock cursor is dropped so
      // chunks can be packed in any time order — only intra-interval cursor
      // (cursorOffset) still prevents overlap.
      const minOffsetByCursor = relaxOrder
        ? 0
        : Math.max(0, cursorMOW - intervalStartMOW);
      const offset = Math.max(states[idx]!.cursorOffset, minOffsetByCursor);

      if (offset + minutes > intervalSize) continue;

      if (cap !== null && cap !== undefined && dayLoad[iv.dayIdx]! + minutes > cap) continue;

      const placementMOW = intervalStartMOW + offset;
      const residueInBig = chunk.isResidue && iv.slotSize >= pref ? 1 : 0;
      candidates.push({
        idx,
        offset,
        minutes,
        placementMOW,
        score: [placementMOW, residueInBig, Math.abs(intervalSize - minutes), iv.startMinute],
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

    // Chunk longer than the day's session: place one session now and put the
    // rest back at the head of the queue so it's the next thing placed.
    const placed: Chunk =
      pick.minutes === chunk.minutes ? chunk : { ...chunk, minutes: pick.minutes, isResidue: false };
    if (pick.minutes < chunk.minutes) {
      const remainder = chunk.minutes - pick.minutes;
      queue.unshift({ ...chunk, minutes: remainder, isResidue: remainder < pref });
    }

    placements.push({
      chunk: placed,
      intervalIdx: pick.idx,
      offsetInInterval: pick.offset,
    });
    st.usedMinutes += placed.minutes;
    st.cursorOffset = Math.min(pick.offset + placed.minutes + BUFFER_MINUTES, intervalSize);
    dayLoad[iv.dayIdx]! += placed.minutes;
    cursorMOW = pick.placementMOW + placed.minutes;
  }

  return { placements, unplaced };
}
