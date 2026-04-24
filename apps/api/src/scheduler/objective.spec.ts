import { computeCost, WEIGHTS } from './objective';
import type { Chunk, EffectiveInterval, Solution } from './scheduler.types';

function chunk(id: string, minutes: number, order: number, isResidue = false): Chunk {
  return { itemId: id, order, minutes, isResidue };
}
function interval(idx: number, start: number, end: number, slotSize: number): EffectiveInterval {
  return { dayIdx: idx, startMinute: start, endMinute: end, slotSize };
}

describe('computeCost', () => {
  const pref = 60;

  it('unplaced dominates everything', () => {
    const sol: Solution = { placements: [], unplaced: [chunk('a', 60, 1)] };
    const cost = computeCost(sol, [], pref);
    expect(cost).toBeGreaterThanOrEqual(WEIGHTS.UNPLACED_PENALTY);
  });

  it('zero cost for single full chunk in a perfectly-sized slot', () => {
    const intervals = [interval(0, 480, 540, 60)]; // 08:00-09:00, slot size 60
    const sol: Solution = {
      placements: [{ chunk: chunk('a', 60, 1), intervalIdx: 0, offsetInInterval: 0 }],
      unplaced: [],
    };
    const cost = computeCost(sol, intervals, pref);
    expect(cost).toBe(WEIGHTS.SLOT_COUNT_WEIGHT);
  });

  it('penalizes residue placed in a big slot', () => {
    const intervals = [interval(0, 480, 720, 240)]; // 4h slot
    const sol: Solution = {
      placements: [
        { chunk: chunk('a', 30, 1, true), intervalIdx: 0, offsetInInterval: 0 },
      ],
      unplaced: [],
    };
    const cost = computeCost(sol, intervals, pref);
    expect(cost).toBeGreaterThanOrEqual(
      WEIGHTS.SLOT_COUNT_WEIGHT + WEIGHTS.RESIDUE_IN_BIG_WEIGHT * 30,
    );
  });

  it('penalizes placement in a small slot', () => {
    const intervals = [interval(0, 480, 510, 30)]; // 30-min slot, slot size < pref
    const sol: Solution = {
      placements: [
        { chunk: chunk('a', 30, 1, false), intervalIdx: 0, offsetInInterval: 0 },
      ],
      unplaced: [],
    };
    const cost = computeCost(sol, intervals, pref);
    expect(cost).toBeGreaterThanOrEqual(WEIGHTS.SMALL_SLOT_WEIGHT * 30);
  });

  it('penalizes order inversion (higher-order chunk scheduled earlier)', () => {
    const intervals = [
      interval(0, 480, 600, 120), // Monday 08-10
      interval(1, 480, 600, 120), // Tuesday 08-10
    ];
    const sol: Solution = {
      placements: [
        { chunk: chunk('b', 60, 2), intervalIdx: 0, offsetInInterval: 0 }, // Mon
        { chunk: chunk('a', 60, 1), intervalIdx: 1, offsetInInterval: 0 }, // Tue
      ],
      unplaced: [],
    };
    const cost = computeCost(sol, intervals, pref);
    expect(cost).toBeGreaterThanOrEqual(WEIGHTS.ORDER_VIOLATION_WEIGHT);
  });

  it('penalizes day imbalance: 3h on one day vs evenly spread', () => {
    const intervals = [
      interval(0, 480, 720, 240), // Mon 4h
      interval(1, 480, 720, 240), // Tue 4h
      interval(2, 480, 720, 240), // Wed 4h
    ];
    const piledMonday: Solution = {
      placements: [
        { chunk: chunk('a', 60, 1), intervalIdx: 0, offsetInInterval: 0 },
        { chunk: chunk('b', 60, 2), intervalIdx: 0, offsetInInterval: 70 },
        { chunk: chunk('c', 60, 3), intervalIdx: 0, offsetInInterval: 140 },
      ],
      unplaced: [],
    };
    const spread: Solution = {
      placements: [
        { chunk: chunk('a', 60, 1), intervalIdx: 0, offsetInInterval: 0 },
        { chunk: chunk('b', 60, 2), intervalIdx: 1, offsetInInterval: 0 },
        { chunk: chunk('c', 60, 3), intervalIdx: 2, offsetInInterval: 0 },
      ],
      unplaced: [],
    };
    expect(computeCost(piledMonday, intervals, pref)).toBeGreaterThan(
      computeCost(spread, intervals, pref),
    );
  });
});
