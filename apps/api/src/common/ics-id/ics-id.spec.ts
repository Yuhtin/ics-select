import { embedIcsId, extractIcsId, ICS_ID_PREFIX } from './ics-id';

describe('ics-id', () => {
  it('embedIcsId wraps with prefix + identifies plan/item pair', () => {
    const out = embedIcsId('Leetcode · binary search', { planId: 'p-1', itemId: 'i-42' });
    expect(out).toContain('Leetcode · binary search');
    expect(out).toContain(`${ICS_ID_PREFIX}p-1/i-42`);
  });

  it('extractIcsId parses embedded description', () => {
    const description = `Some text\nICS ID: plan-abc/item-xyz\nMore text`;
    expect(extractIcsId(description)).toEqual({ planId: 'plan-abc', itemId: 'item-xyz' });
  });

  it('extractIcsId returns null on missing marker', () => {
    expect(extractIcsId('no marker here')).toBeNull();
  });

  it('extractIcsId returns null when format is malformed (missing slash)', () => {
    expect(extractIcsId('ICS ID: just-one-id')).toBeNull();
  });

  it('round-trips embed → extract', () => {
    const body = 'Reminder body\nExisting content';
    const embedded = embedIcsId(body, { planId: 'p-9', itemId: 'i-3' });
    expect(extractIcsId(embedded)).toEqual({ planId: 'p-9', itemId: 'i-3' });
  });
});
