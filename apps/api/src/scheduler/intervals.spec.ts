import { buildEffectiveIntervals, chunkItems } from './intervals';
import type { AvailabilitySlotInput, BusyBlock, ItemInput } from './scheduler.types';

const MONDAY = new Date('2026-04-13T00:00:00-03:00'); // 03:00 UTC
const BEFORE_WEEK = new Date('2026-04-12T12:00:00-03:00');

describe('buildEffectiveIntervals', () => {
  it('returns one interval per slot when there are no busy blocks', () => {
    const slots: AvailabilitySlotInput[] = [
      { dayOfWeek: 0, startMinute: 480, endMinute: 1320 },
      { dayOfWeek: 1, startMinute: 1140, endMinute: 1320 },
    ];
    const ivs = buildEffectiveIntervals(slots, [], MONDAY, 'America/Sao_Paulo', BEFORE_WEEK);
    expect(ivs).toHaveLength(2);
    expect(ivs[0]!.dayIdx).toBe(0);
    expect(ivs[0]!.startMinute).toBe(480);
    expect(ivs[0]!.slotSize).toBe(1320 - 480);
    expect(ivs[1]!.dayIdx).toBe(1);
  });

  it('splits a slot when a busy block falls inside', () => {
    const slots: AvailabilitySlotInput[] = [
      { dayOfWeek: 0, startMinute: 480, endMinute: 1320 },
    ];
    const busy: BusyBlock[] = [{
      start: new Date('2026-04-13T12:00:00-03:00'),
      end: new Date('2026-04-13T14:00:00-03:00'),
    }];
    const ivs = buildEffectiveIntervals(slots, busy, MONDAY, 'America/Sao_Paulo', BEFORE_WEEK);
    expect(ivs.length).toBeGreaterThanOrEqual(2);
    // slotSize is preserved on both remnants (rule iii depends on it)
    for (const iv of ivs) expect(iv.slotSize).toBe(840);
  });

  it('skips intervals that end at or before "now"', () => {
    const slots: AvailabilitySlotInput[] = [
      { dayOfWeek: 0, startMinute: 480, endMinute: 1320 },
    ];
    const now = new Date('2026-04-13T23:00:00-03:00'); // past the slot
    const ivs = buildEffectiveIntervals(slots, [], MONDAY, 'America/Sao_Paulo', now);
    expect(ivs.filter((iv) => iv.dayIdx === 0)).toHaveLength(0);
  });
});

describe('chunkItems', () => {
  it('splits items into pref-sized chunks + a tail residue when needed', () => {
    const items: ItemInput[] = [{ id: 'i1', estimatedMinutes: 75, order: 1 }];
    const chunks = chunkItems(items, 30);
    expect(chunks.map((c) => c.minutes)).toEqual([30, 30, 15]);
    expect(chunks[0]!.isResidue).toBe(false);
    expect(chunks[1]!.isResidue).toBe(false);
    expect(chunks[2]!.isResidue).toBe(true);
  });

  it('marks a single item smaller than pref as a residue chunk', () => {
    const items: ItemInput[] = [{ id: 'i1', estimatedMinutes: 20, order: 1 }];
    const chunks = chunkItems(items, 60);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.minutes).toBe(20);
    expect(chunks[0]!.isResidue).toBe(true);
  });

  it('preserves order from the input array', () => {
    const items: ItemInput[] = [
      { id: 'a', estimatedMinutes: 60, order: 2 },
      { id: 'b', estimatedMinutes: 60, order: 1 },
    ];
    const chunks = chunkItems(items, 60);
    expect(chunks.map((c) => c.order)).toEqual([2, 1]);
  });
});
