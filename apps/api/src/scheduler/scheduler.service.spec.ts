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

  it('1. consolidates 3h of work into the larger of two slots on the same day', () => {
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
    // All sessions at or after 21:00 BRT = 00:00 UTC next day (Apr 14)
    for (const s of result.sessions) {
      expect(s.scheduledAt.getTime()).toBeGreaterThanOrEqual(
        new Date('2026-04-14T00:00:00Z').getTime(),
      );
    }
  });

  it('2. distributes evenly across 5 weekdays when capacity is abundant', () => {
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
    const daysHit = new Set(result.sessions.map((s) => s.scheduledAt.getUTCDate()));
    expect(daysHit.size).toBeGreaterThanOrEqual(3);
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

  it('9. solver diagnostics are returned for a patological-size input', () => {
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
    expect(typeof result.diagnostics.timedOut).toBe('boolean');
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
