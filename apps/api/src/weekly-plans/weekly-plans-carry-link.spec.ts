import { deriveCarryLinks } from './weekly-plans.service.js';

describe('deriveCarryLinks', () => {
  it('links an item to the previous week PENDING/STUCK row with the same libraryItem', () => {
    const prevItems = [
      { id: 'prev-A', libraryItemId: 'A', outcome: 'PENDING' as const },
      { id: 'prev-B', libraryItemId: 'B', outcome: 'DONE_EASY' as const },
      { id: 'prev-C', libraryItemId: 'C', outcome: 'STUCK' as const },
    ];
    const incoming = [
      { libraryItemId: 'A', order: 0 },
      { libraryItemId: 'B', order: 1 },
      { libraryItemId: 'C', order: 2 },
      { libraryItemId: 'D', order: 3 },
    ];
    const linked = deriveCarryLinks(incoming, prevItems);
    expect(linked[0]).toEqual({ libraryItemId: 'A', order: 0, carriedFromItemId: 'prev-A' });
    // B was DONE last week → not a carry.
    expect(linked[1]).toEqual({ libraryItemId: 'B', order: 1, carriedFromItemId: null });
    // C was STUCK → carried.
    expect(linked[2]).toEqual({ libraryItemId: 'C', order: 2, carriedFromItemId: 'prev-C' });
    // D is brand new.
    expect(linked[3]).toEqual({ libraryItemId: 'D', order: 3, carriedFromItemId: null });
  });

  it('returns all-null links when there is no previous-week plan', () => {
    const linked = deriveCarryLinks([{ libraryItemId: 'A', order: 0 }], []);
    expect(linked).toEqual([{ libraryItemId: 'A', order: 0, carriedFromItemId: null }]);
  });
});
