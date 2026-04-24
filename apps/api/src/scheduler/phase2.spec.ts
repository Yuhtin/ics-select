import { phase1 } from './phase1';
import { phase2 } from './phase2';
import { computeCost } from './objective';
import type { Chunk, EffectiveInterval } from './scheduler.types';

function ch(id: string, minutes: number, order: number, isResidue = false): Chunk {
  return { itemId: id, order, minutes, isResidue };
}
function iv(dayIdx: number, start: number, end: number, slotSize = end - start): EffectiveInterval {
  return { dayIdx, startMinute: start, endMinute: end, slotSize };
}
const NO_CAPS: (number | null)[] = [null, null, null, null, null, null, null];

describe('phase2 branch-and-bound', () => {
  const pref = 60;

  it('never worsens the phase 1 solution', () => {
    const intervals = [
      iv(0, 480, 600),
      iv(0, 1260, 1440),
      iv(1, 480, 600),
    ];
    const chunks = [ch('a', 60, 1), ch('b', 60, 2), ch('c', 60, 3)];
    const s1 = phase1(chunks, intervals, NO_CAPS, pref);
    const c1 = computeCost(s1, intervals, pref);
    const result = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 500, nodeBudget: 50_000 });
    expect(result.cost).toBeLessThanOrEqual(c1);
  });

  it('returns the phase-1 solution unchanged if no improvement is possible', () => {
    const intervals = [iv(0, 480, 540)];
    const chunks = [ch('a', 60, 1)];
    const s1 = phase1(chunks, intervals, NO_CAPS, pref);
    const result = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 500, nodeBudget: 50_000 });
    expect(result.cost).toBe(computeCost(s1, intervals, pref));
  });

  it('deterministic: same input → same output across two runs', () => {
    const intervals = [
      iv(0, 480, 720),
      iv(1, 480, 720),
      iv(2, 480, 720),
    ];
    const chunks = [ch('a', 60, 1), ch('b', 60, 2), ch('c', 60, 3)];
    const s1 = phase1(chunks, intervals, NO_CAPS, pref);
    const a = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 500, nodeBudget: 50_000 });
    const b = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 500, nodeBudget: 50_000 });
    expect(a.cost).toBe(b.cost);
    expect(JSON.stringify(a.solution.placements)).toBe(JSON.stringify(b.solution.placements));
  });

  it('flags timeout and returns best-so-far when budget is tiny', () => {
    const intervals = [
      iv(0, 480, 720), iv(1, 480, 720), iv(2, 480, 720),
      iv(3, 480, 720), iv(4, 480, 720), iv(5, 480, 720), iv(6, 480, 720),
    ];
    const chunks: Chunk[] = [];
    for (let k = 0; k < 10; k++) chunks.push(ch(`c${k}`, 60, k + 1));
    const s1 = phase1(chunks, intervals, NO_CAPS, pref);
    const result = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 1, nodeBudget: 10 });
    expect(result.timedOut).toBe(true);
    expect(result.cost).toBeLessThanOrEqual(computeCost(s1, intervals, pref));
  });
});
