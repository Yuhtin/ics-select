import { computeMemberRanking, type MemberRankingUser } from './member-ranking';

const WEEK_START = new Date('2026-04-13T00:00:00.000Z'); // Monday UTC
const WEEK_END = new Date('2026-04-19T23:59:59.999Z');   // Sunday UTC end
const NOW = new Date('2026-04-17T12:00:00.000Z');         // mid-week Friday

function user(
  userId: string,
  name: string,
  items: Array<{ outcome: string; completedAt: string | null; estimatedMinutes: number }>,
): MemberRankingUser {
  return {
    userId,
    name,
    pictureUrl: null,
    items: items.map((i) => ({
      outcome: i.outcome as any,
      completedAt: i.completedAt ? new Date(i.completedAt) : null,
      libraryItem: { estimatedMinutes: i.estimatedMinutes },
    })),
  };
}

describe('computeMemberRanking', () => {
  it('returns empty array when no member has score > 0', () => {
    const result = computeMemberRanking(
      [user('u1', 'Alice', [])],
      WEEK_START,
      WEEK_END,
      'me',
    );
    expect(result).toEqual([]);
  });

  it('weighs DONE_HARD 1.2× DONE_EASY for the same minutes', () => {
    const easy = user('u-easy', 'Easy', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const hard = user('u-hard', 'Hard', [
      { outcome: 'DONE_HARD', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const result = computeMemberRanking([easy, hard], WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-hard');
    expect(result[1]!.userId).toBe('u-easy');
  });

  it('weighs SKIPPED at 0.3', () => {
    // 100 min SKIPPED = 30 min_weighted; 30 min DONE_EASY = 30 min_weighted.
    // Both with 1 day of activity → consistency 20.
    // pontos_ciclo (≡ pontos_semana for this case) = 30 + 20 = 50.
    // score = 50 + 2 × 50 = 150 for both → tied, alphabetical order kicks in.
    const skipped = user('u-skipped', 'Bravo', [
      { outcome: 'SKIPPED', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 100 },
    ]);
    const done = user('u-done', 'Alpha', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 30 },
    ]);
    const result = computeMemberRanking([skipped, done], WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-done');    // Alpha < Bravo
    expect(result[1]!.userId).toBe('u-skipped');
  });

  it('STUCK and PENDING contribute 0 points', () => {
    const stuckOnly = user('u-stuck', 'Stuck', [
      { outcome: 'STUCK', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'PENDING', completedAt: null, estimatedMinutes: 60 },
    ]);
    const result = computeMemberRanking([stuckOnly], WEEK_START, WEEK_END, 'me');
    expect(result).toEqual([]);
  });

  it('rewards consistency: 5 days × 1h beats 1 day × 5h', () => {
    const consistent = user('u-cons', 'Consistent', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-13T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'DONE_EASY', completedAt: '2026-04-14T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'DONE_EASY', completedAt: '2026-04-15T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'DONE_EASY', completedAt: '2026-04-16T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const marathon = user('u-mara', 'Marathon', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 300 },
    ]);
    const result = computeMemberRanking([consistent, marathon], WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-cons');
    expect(result[1]!.userId).toBe('u-mara');
  });

  it('current-week activity weighs ~3× past-week activity', () => {
    // Both members did 60min DONE_EASY total. One last week, one this week.
    // Past-only: pontos_ciclo = 60 + 20 = 80; pontos_semana = 0; score = 80.
    // This-week-only: pontos_ciclo = 80; pontos_semana = 80; score = 80 + 160 = 240.
    const past = user('u-past', 'Past', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-08T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const now = user('u-now', 'Now', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const result = computeMemberRanking([past, now], WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-now');
    expect(result[1]!.userId).toBe('u-past');
    expect(result[0]!.score).toBe(240);
    expect(result[1]!.score).toBe(80);
  });

  it('caps at top 3 even when more members qualify', () => {
    const users = ['a', 'b', 'c', 'd', 'e'].map((id, idx) =>
      user(`u-${id}`, `User ${id.toUpperCase()}`, [
        { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 30 + idx * 10 },
      ]),
    );
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    expect(result).toHaveLength(3);
    // Highest minutes win → e (70) > d (60) > c (50)
    expect(result.map((r) => r.userId)).toEqual(['u-e', 'u-d', 'u-c']);
  });

  it('returns 2 entries when only 2 members have score > 0', () => {
    const users = [
      user('u-a', 'A', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 30 }]),
      user('u-b', 'B', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 }]),
      user('u-c', 'C', []),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    expect(result).toHaveLength(2);
    expect(result[0]!.userId).toBe('u-b');
  });

  it('sets isMe flag for the current user', () => {
    const users = [
      user('u-other', 'Other', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 }]),
      user('u-me', 'Me', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 30 }]),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'u-me');
    expect(result.find((r) => r.userId === 'u-me')!.isMe).toBe(true);
    expect(result.find((r) => r.userId === 'u-other')!.isMe).toBe(false);
  });

  it('alphabetical tiebreak when score and consistency identical', () => {
    const users = [
      user('u-z', 'Zara', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 }]),
      user('u-a', 'Ana', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 }]),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-a');
    expect(result[1]!.userId).toBe('u-z');
  });

  it('ignores items without completedAt', () => {
    const users = [
      user('u-1', 'A', [
        { outcome: 'DONE_EASY', completedAt: null, estimatedMinutes: 60 },
      ]),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    expect(result).toEqual([]);
  });

  it('counts UTC days, not wall-clock — same UTC day = 1 day bonus', () => {
    const users = [
      user('u-1', 'A', [
        { outcome: 'DONE_EASY', completedAt: '2026-04-17T01:00:00Z', estimatedMinutes: 30 },
        { outcome: 'DONE_EASY', completedAt: '2026-04-17T23:00:00Z', estimatedMinutes: 30 },
      ]),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    // 60 min × 1.0 + 20 × 1 day = 80 (cycle); same for week. score = 80 + 160 = 240.
    expect(result[0]!.score).toBe(240);
  });
});
