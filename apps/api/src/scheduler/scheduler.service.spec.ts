import { SchedulerService } from './scheduler.service';
import type { AvailabilitySlotInput, SchedulerInput } from './scheduler.types';

const MONDAY = new Date('2026-04-13T00:00:00-03:00'); // Mon 03:00 UTC
const BEFORE_WEEK = new Date('2026-04-12T12:00:00-03:00');

const NO_CAPS: (number | null)[] = [null, null, null, null, null, null, null];

function allSlots0822(): AvailabilitySlotInput[] {
  return [0, 1, 2, 3, 4].map((d) => ({ dayOfWeek: d, startMinute: 480, endMinute: 1320 }));
}

function input(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    weekStart: MONDAY,
    availability: {
      slots: allSlots0822(),
      caps: NO_CAPS,
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
    },
    busyBlocks: [],
    items: [],
    now: BEFORE_WEEK,
    ...overrides,
  };
}

describe('SchedulerService.plan — canonical cases', () => {
  const svc = new SchedulerService();

  it('1. packs 3h of ordered work forward onto the same day, respecting order', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [
            { dayOfWeek: 0, startMinute: 480, endMinute: 600 },   // Mon 08-10
            { dayOfWeek: 0, startMinute: 1260, endMinute: 1440 }, // Mon 21-00
          ],
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [
          { id: 'a', estimatedMinutes: 60, order: 1 },
          { id: 'b', estimatedMinutes: 60, order: 2 },
          { id: 'c', estimatedMinutes: 60, order: 3 },
        ],
      }),
    );
    expect(result.overflow).toHaveLength(0);
    expect(result.sessions).toHaveLength(3);
    // Strict order in time: a < b < c.
    const t = (id: string) =>
      result.sessions.find((s) => s.itemId === id)!.scheduledAt.getTime();
    expect(t('a')).toBeLessThan(t('b'));
    expect(t('b')).toBeLessThan(t('c'));
  });

  it('2. packs ordered items forward when capacity is abundant', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [0, 1, 2, 3, 4].map((d) => ({ dayOfWeek: d, startMinute: 1140, endMinute: 1320 })),
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [1, 2, 3].map((n) => ({ id: `i${n}`, estimatedMinutes: 60, order: n })),
      }),
    );
    expect(result.overflow).toHaveLength(0);
    expect(result.sessions).toHaveLength(3);
    // Order is preserved; the scheduler packs forward, so multiple items can
    // share the earliest day until that day's slot is exhausted.
    const ts = result.sessions
      .slice()
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .map((s) => s.itemId);
    expect(ts).toEqual(['i1', 'i2', 'i3']);
  });

  it('3. cap overrides slot capacity', () => {
    const caps: (number | null)[] = [60, null, null, null, null, null, null];
    const result = svc.plan(
      input({
        availability: {
          slots: [{ dayOfWeek: 0, startMinute: 1140, endMinute: 1320 }],
          caps,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [
          { id: 'a', estimatedMinutes: 60, order: 1 },
          { id: 'b', estimatedMinutes: 60, order: 2 },
        ],
      }),
    );
    expect(result.sessions).toHaveLength(1);
    expect(result.overflow).toHaveLength(1);
    expect(result.overflow[0]!.itemId).toBe('b');
  });

  it('4. busy block carves a slot and sessions avoid the busy range', () => {
    const busyStart = new Date('2026-04-13T20:00:00-03:00'); // 23:00 UTC
    const busyEnd = new Date('2026-04-13T20:30:00-03:00');   // 23:30 UTC
    const result = svc.plan(
      input({
        availability: {
          slots: [{ dayOfWeek: 0, startMinute: 1140, endMinute: 1320 }],
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        busyBlocks: [{ start: busyStart, end: busyEnd }],
        items: [{ id: 'a', estimatedMinutes: 120, order: 1 }],
      }),
    );
    expect(result.overflow).toHaveLength(0);
    for (const s of result.sessions) {
      const end = new Date(s.scheduledAt.getTime() + s.durationMinutes * 60_000);
      const overlaps = s.scheduledAt < busyEnd && end > busyStart;
      expect(overlaps).toBe(false);
    }
  });

  it('5. honors a short declared slot (< pref)', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [{ dayOfWeek: 1, startMinute: 1140, endMinute: 1170 }], // Tue 19:00-19:30
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [{ id: 'a', estimatedMinutes: 30, order: 1 }],
      }),
    );
    expect(result.overflow).toHaveLength(0);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]!.durationMinutes).toBe(30);
  });

  it('6. order preference: lower order lands on earlier day when tied', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [
            { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
            { dayOfWeek: 1, startMinute: 480, endMinute: 600 },
          ],
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [
          { id: 'a', estimatedMinutes: 60, order: 1 },
          { id: 'b', estimatedMinutes: 60, order: 2 },
        ],
      }),
    );
    const byId = new Map(result.sessions.map((s) => [s.itemId, s.scheduledAt.getTime()]));
    expect(byId.get('a')!).toBeLessThan(byId.get('b')!);
  });

  it('7. no slots on Monday → nothing scheduled there', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [
            { dayOfWeek: 1, startMinute: 480, endMinute: 600 },
            { dayOfWeek: 2, startMinute: 480, endMinute: 600 },
          ],
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [{ id: 'a', estimatedMinutes: 60, order: 1 }],
      }),
    );
    expect(result.overflow).toHaveLength(0);
    const onMonday = result.sessions.filter((s) => s.scheduledAt.getUTCDate() === MONDAY.getUTCDate());
    expect(onMonday).toHaveLength(0);
  });

  it('9. diagnostics are returned for a large input', () => {
    const slots: AvailabilitySlotInput[] = [];
    for (let d = 0; d < 7; d++) slots.push({ dayOfWeek: d, startMinute: 480, endMinute: 720 });
    const items = [];
    for (let k = 0; k < 20; k++) items.push({ id: `c${k}`, estimatedMinutes: 60, order: k + 1 });
    const result = svc.plan(input({
      availability: {
        slots, caps: NO_CAPS, preferredSessionMinutes: 60, timezone: 'America/Sao_Paulo',
      },
      items,
    }));
    expect(result.sessions.length + result.overflow.length).toBeGreaterThan(0);
    expect(result.diagnostics).toBeDefined();
    expect(typeof result.diagnostics.cost).toBe('number');
    expect(typeof result.diagnostics.durationMs).toBe('number');
  });

  it('11. hard-order regression: short items never jump ahead of earlier-order long items', () => {
    // Mirrors Cauan's plan cmor7o4s where order=4 (8min) was scheduled on Mon
    // before order=2 (13min) and order=3 (18min). Under hard ordering, every
    // item must start strictly before the next one in admin-defined order.
    const result = svc.plan(
      input({
        availability: {
          slots: [0, 1, 2, 3, 4].map((d) => ({ dayOfWeek: d, startMinute: 480, endMinute: 600 })),
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [
          { id: 'i0', estimatedMinutes: 60, order: 0 },
          { id: 'i1', estimatedMinutes: 60, order: 1 },
          { id: 'i2', estimatedMinutes: 13, order: 2 },
          { id: 'i3', estimatedMinutes: 18, order: 3 },
          { id: 'i4', estimatedMinutes: 8,  order: 4 },
        ],
      }),
    );
    expect(result.overflow).toHaveLength(0);
    const ts = ['i0', 'i1', 'i2', 'i3', 'i4'].map((id) =>
      result.sessions.find((s) => s.itemId === id)!.scheduledAt.getTime(),
    );
    for (let i = 0; i < ts.length - 1; i++) {
      expect(ts[i]!).toBeLessThan(ts[i + 1]!);
    }
  });

  it('10. deterministic: same input → byte-equal session list', () => {
    const data = input({
      availability: {
        slots: [
          { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
          { dayOfWeek: 1, startMinute: 480, endMinute: 600 },
        ],
        caps: NO_CAPS,
        preferredSessionMinutes: 60,
        timezone: 'America/Sao_Paulo',
      },
      items: [
        { id: 'a', estimatedMinutes: 60, order: 1 },
        { id: 'b', estimatedMinutes: 60, order: 2 },
      ],
    });
    const a = svc.plan(data);
    const b = svc.plan(data);
    expect(JSON.stringify(a.sessions)).toBe(JSON.stringify(b.sessions));
    expect(JSON.stringify(a.overflow)).toBe(JSON.stringify(b.overflow));
  });
});
