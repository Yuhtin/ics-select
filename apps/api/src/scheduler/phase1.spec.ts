import { phase1 } from './phase1';
import type { Chunk, EffectiveInterval } from './scheduler.types';

function ch(id: string, minutes: number, order: number, seq = 0, isResidue = false): Chunk {
  return { itemId: id, order, seq, minutes, isResidue };
}
function iv(dayIdx: number, start: number, end: number, slotSize = end - start): EffectiveInterval {
  return { dayIdx, startMinute: start, endMinute: end, slotSize };
}

describe('phase1 ordered placement', () => {
  const pref = 60;

  it('places a single 60-min chunk into a 60-min slot', () => {
    const intervals = [iv(0, 480, 540)];
    const sol = phase1([ch('a', 60, 1)], intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.unplaced).toHaveLength(0);
    expect(sol.placements).toHaveLength(1);
    expect(sol.placements[0]!.intervalIdx).toBe(0);
  });

  it('packs three 60-min chunks forward into the same day', () => {
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
    // a takes the earliest slot (Mon 8-10); b & c spill into Mon 21-00 because the
    // 8-10 slot's remaining capacity after a's 60min + 10min buffer can't fit another 60.
    const byItem = new Map(sol.placements.map((p) => [p.chunk.itemId, p.intervalIdx]));
    expect(byItem.get('a')).toBe(0);
    expect(byItem.get('b')).toBe(1);
    expect(byItem.get('c')).toBe(1);
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
    expect(onMonday[0]!.chunk.itemId).toBe('a');
    expect(onTuesday[0]!.chunk.itemId).toBe('b');
  });

  it('rule iii: a residue rejects placement in a busy-carved sub-pref interval of a big slot', () => {
    // Interval 0: size 20min but parent slot is 240min — carved by busy → unusable.
    // Interval 1: size 200min, parent slot 240min — usable.
    const intervals = [
      iv(0, 480, 500, 240),
      iv(0, 520, 720, 240),
    ];
    const sol = phase1([ch('r', 20, 1, 0, true)], intervals, [null, null, null, null, null, null, null], pref);
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

  it('hard order: a later-order short chunk never lands before an earlier-order long chunk', () => {
    // The Cauan regression: under the old size-desc heuristic, the small chunk
    // would be tucked into a leftover gap on an earlier day, jumping ahead of
    // bigger items the admin meant to come first.
    const intervals = [
      iv(0, 480, 600), // Mon 08-10
      iv(1, 480, 600), // Tue 08-10
      iv(2, 480, 600), // Wed 08-10
      iv(3, 480, 600), // Thu 08-10
    ];
    const chunks: Chunk[] = [
      ch('a', 60, 1),
      ch('b', 60, 2),
      ch('c', 8,  3),
      ch('d', 60, 4),
    ];
    const sol = phase1(chunks, intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.unplaced).toHaveLength(0);
    const startMOW = (id: string) => {
      const p = sol.placements.find((q) => q.chunk.itemId === id)!;
      const itv = intervals[p.intervalIdx]!;
      return itv.dayIdx * 1440 + itv.startMinute + p.offsetInInterval;
    };
    expect(startMOW('a')).toBeLessThan(startMOW('b'));
    expect(startMOW('b')).toBeLessThan(startMOW('c'));
    expect(startMOW('c')).toBeLessThan(startMOW('d'));
  });
});
