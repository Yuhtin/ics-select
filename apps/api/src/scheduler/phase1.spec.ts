import { phase1 } from './phase1';
import type { Chunk, EffectiveInterval } from './scheduler.types';

function ch(id: string, minutes: number, order: number, isResidue = false): Chunk {
  return { itemId: id, order, minutes, isResidue };
}
function iv(dayIdx: number, start: number, end: number, slotSize = end - start): EffectiveInterval {
  return { dayIdx, startMinute: start, endMinute: end, slotSize };
}

describe('phase1 FFD', () => {
  const pref = 60;

  it('places a single 60-min chunk into a 60-min slot', () => {
    const intervals = [iv(0, 480, 540)];
    const sol = phase1([ch('a', 60, 1)], intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.unplaced).toHaveLength(0);
    expect(sol.placements).toHaveLength(1);
    expect(sol.placements[0]!.intervalIdx).toBe(0);
  });

  it('places all three 60-min chunks into intervals on Monday (consolidation is phase 2 job)', () => {
    const intervals = [
      iv(0, 480, 600),   // Mon 08-10 (2h)
      iv(0, 1260, 1440), // Mon 21-00 (3h)
    ];
    const chunks: Chunk[] = [
      ch('a', 60, 1), ch('b', 60, 2), ch('c', 60, 3),
    ];
    const sol = phase1(chunks, intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.unplaced).toHaveLength(0);
    expect(sol.placements).toHaveLength(3);
    for (const p of sol.placements) {
      expect(intervals[p.intervalIdx]!.dayIdx).toBe(0);
    }
  });

  it('respects day cap: 60min cap on Monday holds only one 60-min chunk', () => {
    const intervals = [
      iv(0, 480, 720), // Mon 4h
      iv(1, 480, 720), // Tue 4h
    ];
    const chunks: Chunk[] = [ch('a', 60, 1), ch('b', 60, 2)];
    const caps: (number | null)[] = [60, null, null, null, null, null, null];
    const sol = phase1(chunks, intervals, caps, pref);
    const onMonday = sol.placements.filter((p) => intervals[p.intervalIdx]!.dayIdx === 0);
    const onTuesday = sol.placements.filter((p) => intervals[p.intervalIdx]!.dayIdx === 1);
    expect(onMonday).toHaveLength(1);
    expect(onTuesday).toHaveLength(1);
  });

  it('rule iii: a residue rejects placement in a busy-carved sub-pref interval of a big slot', () => {
    // Interval 0: size 20min but parent slot is 240min — carved by busy → unusable.
    // Interval 1: size 200min, parent slot 240min — usable.
    const intervals = [
      iv(0, 480, 500, 240),
      iv(0, 520, 720, 240),
    ];
    const sol = phase1([ch('r', 20, 1, true)], intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.placements).toHaveLength(1);
    expect(sol.placements[0]!.intervalIdx).toBe(1);
  });

  it('honors a short declared slot (slot.size < pref): places a 30-min chunk', () => {
    // Slot = 30min, pref = 60. slotSize === interval size, so rule iii allows it.
    const intervals = [iv(0, 480, 510, 30)];
    const sol = phase1([ch('a', 30, 1)], intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.placements).toHaveLength(1);
    expect(sol.placements[0]!.intervalIdx).toBe(0);
  });

  it('overflows when total work exceeds total capacity', () => {
    const intervals = [iv(0, 480, 540)]; // 60 min capacity
    const sol = phase1(
      [ch('a', 60, 1), ch('b', 60, 2)],
      intervals,
      [null, null, null, null, null, null, null],
      pref,
    );
    expect(sol.placements).toHaveLength(1);
    expect(sol.unplaced).toHaveLength(1);
    expect(sol.unplaced[0]!.itemId).toBe('b');
  });
});
