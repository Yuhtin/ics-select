import type {
  Chunk,
  EffectiveInterval,
  Solution,
} from './scheduler.types.js';

export const WEIGHTS = {
  UNPLACED_PENALTY: 100_000,
  DAY_IMBALANCE_WEIGHT: 1_000,
  SLOT_COUNT_WEIGHT: 100,
  RESIDUE_IN_BIG_WEIGHT: 50,
  SMALL_SLOT_WEIGHT: 20,
  ORDER_VIOLATION_WEIGHT: 5,
  WASTE_WEIGHT: 1,
} as const;

export function computeCost(
  solution: Solution,
  intervals: EffectiveInterval[],
  pref: number,
): number {
  let cost = 0;

  // 1) Unplaced
  let unplacedMinutes = 0;
  for (const c of solution.unplaced) unplacedMinutes += c.minutes;
  cost += WEIGHTS.UNPLACED_PENALTY * unplacedMinutes;

  // 2) Day imbalance = sum of max(0, dayLoad[d] - mean_load)
  //    Computed only over days that appear in the intervals list (days with capacity).
  const availableDays = new Set<number>(intervals.map((iv) => iv.dayIdx));
  const dayLoad = new Map<number, number>();
  for (const d of availableDays) dayLoad.set(d, 0);
  for (const p of solution.placements) {
    const iv = intervals[p.intervalIdx]!;
    dayLoad.set(iv.dayIdx, (dayLoad.get(iv.dayIdx) ?? 0) + p.chunk.minutes);
  }
  const numDays = availableDays.size || 1;
  const total = [...dayLoad.values()].reduce((s, m) => s + m, 0);
  const mean = total / numDays;
  let imbalance = 0;
  for (const load of dayLoad.values()) imbalance += Math.max(0, load - mean);
  cost += WEIGHTS.DAY_IMBALANCE_WEIGHT * imbalance;

  // 3) Slot count = number of distinct intervalIdx in placements
  const touched = new Set<number>();
  for (const p of solution.placements) touched.add(p.intervalIdx);
  cost += WEIGHTS.SLOT_COUNT_WEIGHT * touched.size;

  // 4) Residue in big slot
  let residueInBig = 0;
  for (const p of solution.placements) {
    const iv = intervals[p.intervalIdx]!;
    if (p.chunk.isResidue && iv.slotSize >= pref) residueInBig += p.chunk.minutes;
  }
  cost += WEIGHTS.RESIDUE_IN_BIG_WEIGHT * residueInBig;

  // 5) Minutes in small (sub-pref) slot
  let inSmall = 0;
  for (const p of solution.placements) {
    const iv = intervals[p.intervalIdx]!;
    if (iv.slotSize < pref) inSmall += p.chunk.minutes;
  }
  cost += WEIGHTS.SMALL_SLOT_WEIGHT * inSmall;

  // 6) Order violation: pair of placements (a, b) with a.order < b.order
  //    AND wall-clock(a) > wall-clock(b).
  const withTime = solution.placements.map((p) => ({
    p,
    t: intervals[p.intervalIdx]!.dayIdx * 1440 +
       intervals[p.intervalIdx]!.startMinute + p.offsetInInterval,
  }));
  let inversions = 0;
  for (let i = 0; i < withTime.length; i++) {
    for (let j = 0; j < withTime.length; j++) {
      if (i === j) continue;
      const a = withTime[i]!, b = withTime[j]!;
      if (a.p.chunk.order < b.p.chunk.order && a.t > b.t) inversions += 1;
    }
  }
  // Each inversion is counted once per direction — divide by 2.
  cost += WEIGHTS.ORDER_VIOLATION_WEIGHT * (inversions / 2);

  // 7) Waste = unused minutes inside touched intervals
  const usedPerInterval = new Map<number, number>();
  for (const p of solution.placements) {
    usedPerInterval.set(
      p.intervalIdx,
      (usedPerInterval.get(p.intervalIdx) ?? 0) + p.chunk.minutes,
    );
  }
  let waste = 0;
  for (const [idx, used] of usedPerInterval) {
    const iv = intervals[idx]!;
    waste += Math.max(0, (iv.endMinute - iv.startMinute) - used);
  }
  cost += WEIGHTS.WASTE_WEIGHT * waste;

  return cost;
}

export function minCostRemaining(
  _remainingChunks: Chunk[],
  _intervals: EffectiveInterval[],
  _pref: number,
): number {
  // Conservative lower bound: 0 is always valid (cost can only grow).
  // Tight enough for our scale — a more sophisticated bound is a follow-up.
  return 0;
}
