import {
  canonicalCompletions,
  countCanonicalDone,
  countCanonicalPositive,
} from './canonical-completions.js';

const d = (iso: string) => new Date(iso);

describe('canonicalCompletions', () => {
  it('keeps one row per libraryItem, credited to the earliest positive completion', () => {
    const rows = [
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-31T00:00:00Z'), weekStart: d('2026-05-18') },
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-30T00:00:00Z'), weekStart: d('2026-05-11') },
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-06-02T00:00:00Z'), weekStart: d('2026-05-25') },
      { libraryItemId: 'B', outcome: 'DONE_HARD' as const, completedAt: d('2026-05-06T00:00:00Z'), weekStart: d('2026-05-04') },
    ];
    const canon = canonicalCompletions(rows);
    expect(canon).toHaveLength(2);
    expect(canon.find((r) => r.libraryItemId === 'A')!.weekStart).toEqual(d('2026-05-11'));
    expect(canon.find((r) => r.libraryItemId === 'B')!.weekStart).toEqual(d('2026-05-04'));
  });

  it('excludes materials that only have PENDING rows', () => {
    const rows = [
      { libraryItemId: 'C', outcome: 'PENDING' as const, completedAt: null },
      { libraryItemId: 'C', outcome: 'PENDING' as const, completedAt: null },
    ];
    expect(canonicalCompletions(rows)).toHaveLength(0);
    expect(countCanonicalDone(rows)).toBe(0);
    expect(countCanonicalPositive(rows)).toBe(0);
  });

  it('a NULL completedAt positive row sorts after a dated positive row', () => {
    const rows = [
      { libraryItemId: 'D', outcome: 'SKIPPED' as const, completedAt: null },
      { libraryItemId: 'D', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-10T00:00:00Z') },
    ];
    const canon = canonicalCompletions(rows);
    expect(canon).toHaveLength(1);
    expect(canon[0]!.outcome).toBe('DONE_EASY');
  });

  it('prefers a later DONE over an earlier STUCK for the same material', () => {
    // Common carry path: stuck one week, mastered the next. The canonical row
    // must be the DONE (so it counts as positively done), credited to the
    // week it was actually completed.
    const rows = [
      { libraryItemId: 'E', outcome: 'STUCK' as const, completedAt: d('2026-05-01T00:00:00Z'), weekStart: d('2026-04-27') },
      { libraryItemId: 'E', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-08T00:00:00Z'), weekStart: d('2026-05-04') },
    ];
    const canon = canonicalCompletions(rows);
    expect(canon).toHaveLength(1);
    expect(canon[0]!.outcome).toBe('DONE_EASY');
    expect(canon[0]!.weekStart).toEqual(d('2026-05-04'));
    expect(countCanonicalDone(rows)).toBe(1);
    expect(countCanonicalPositive(rows)).toBe(1);
  });

  it('keeps a never-positive material as non-PENDING but not positive', () => {
    const rows = [
      { libraryItemId: 'F', outcome: 'STUCK' as const, completedAt: d('2026-05-02T00:00:00Z') },
      { libraryItemId: 'F', outcome: 'STUCK' as const, completedAt: d('2026-05-09T00:00:00Z') },
    ];
    const canon = canonicalCompletions(rows);
    expect(canon).toHaveLength(1);
    expect(canon[0]!.outcome).toBe('STUCK');
    expect(countCanonicalDone(rows)).toBe(1); // counts toward "any non-PENDING" (cohort rank)
    expect(countCanonicalPositive(rows)).toBe(0); // not a positive completion
  });

  it('countCanonicalDone / countCanonicalPositive over a mixed set', () => {
    const rows = [
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-01T00:00:00Z') },
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-08T00:00:00Z') },
      { libraryItemId: 'B', outcome: 'STUCK' as const, completedAt: d('2026-05-02T00:00:00Z') },
      { libraryItemId: 'G', outcome: 'DOUBTS' as const, completedAt: d('2026-05-03T00:00:00Z') },
      { libraryItemId: 'H', outcome: 'PENDING' as const, completedAt: null },
    ];
    expect(countCanonicalDone(rows)).toBe(3); // A, B, G (non-PENDING materials)
    expect(countCanonicalPositive(rows)).toBe(2); // A (DONE), G (DOUBTS); B is STUCK
  });
});
