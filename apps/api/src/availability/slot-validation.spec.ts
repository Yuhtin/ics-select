import { validateSlots, SlotValidationError } from './slot-validation';

describe('validateSlots', () => {
  it('accepts a well-formed, non-overlapping set', () => {
    expect(() =>
      validateSlots([
        { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
        { dayOfWeek: 0, startMinute: 1140, endMinute: 1320 },
        { dayOfWeek: 1, startMinute: 1140, endMinute: 1320 },
      ]),
    ).not.toThrow();
  });

  it('rejects dayOfWeek outside 0..6', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 7, startMinute: 0, endMinute: 60 }]),
    ).toThrow(SlotValidationError);
  });

  it('rejects startMinute not multiple of 30', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 475, endMinute: 600 }]),
    ).toThrow(/granularity/);
  });

  it('rejects endMinute not multiple of 30', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 480, endMinute: 601 }]),
    ).toThrow(/granularity/);
  });

  it('rejects slot shorter than 30 minutes', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 480, endMinute: 500 }]),
    ).toThrow(/too_short/);
  });

  it('rejects endMinute <= startMinute', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 600, endMinute: 600 }]),
    ).toThrow(/too_short/);
  });

  it('rejects inverted slot (end before start, e.g. 17:00-05:00)', () => {
    try {
      validateSlots([{ dayOfWeek: 0, startMinute: 17 * 60, endMinute: 5 * 60 }]);
      fail('should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(SlotValidationError);
      expect(e.reason).toBe('inverted');
      expect(e.dayOfWeek).toBe(0);
    }
  });

  it('rejects endMinute > 1440', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 1380, endMinute: 1500 }]),
    ).toThrow(/range/);
  });

  it('rejects startMinute < 0', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: -30, endMinute: 60 }]),
    ).toThrow(/range/);
  });

  it('rejects strict overlap in same day', () => {
    expect(() =>
      validateSlots([
        { dayOfWeek: 0, startMinute: 480, endMinute: 720 },
        { dayOfWeek: 0, startMinute: 600, endMinute: 900 },
      ]),
    ).toThrow(/overlap/);
  });

  it('allows touching boundary in same day (08-10 + 10-12)', () => {
    expect(() =>
      validateSlots([
        { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
        { dayOfWeek: 0, startMinute: 600, endMinute: 720 },
      ]),
    ).not.toThrow();
  });

  it('allows same time-range on different days', () => {
    expect(() =>
      validateSlots([
        { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
        { dayOfWeek: 1, startMinute: 480, endMinute: 600 },
      ]),
    ).not.toThrow();
  });

  it('exposes violation details on the error', () => {
    try {
      validateSlots([{ dayOfWeek: 0, startMinute: 480, endMinute: 500 }]);
      fail('should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(SlotValidationError);
      expect(e.reason).toBe('too_short');
      expect(e.dayOfWeek).toBe(0);
    }
  });
});
