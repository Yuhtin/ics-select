import type { ItemOutcome } from '@ics-select/prisma';

export type MemberRankingUser = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  items: Array<{
    outcome: ItemOutcome;
    completedAt: Date | null;
    libraryItem: { estimatedMinutes: number };
  }>;
};

export type MemberRankingEntry = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  score: number;
  isMe: boolean;
};

const OUTCOME_WEIGHT: Record<ItemOutcome, number> = {
  DONE_EASY: 1.0,
  DONE_HARD: 1.2,
  DOUBTS: 1.0,
  SKIPPED: 0.3,
  STUCK: 0,
  PENDING: 0,
};

const CONSISTENCY_BONUS_PER_DAY = 20;
const CURRENT_WEEK_MULTIPLIER = 2;
const TOP_N = 3;

function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

type Pontos = {
  minutesWeighted: number;
  distinctDays: Set<string>;
};

function emptyPontos(): Pontos {
  return { minutesWeighted: 0, distinctDays: new Set() };
}

function pontosTotal(p: Pontos): number {
  return p.minutesWeighted + CONSISTENCY_BONUS_PER_DAY * p.distinctDays.size;
}

export function computeMemberRanking(
  users: MemberRankingUser[],
  weekStart: Date,
  weekEnd: Date,
  currentUserId: string,
): MemberRankingEntry[] {
  const scored = users.map((u) => {
    const cycle = emptyPontos();
    const week = emptyPontos();

    for (const item of u.items) {
      if (!item.completedAt) continue;
      const weight = OUTCOME_WEIGHT[item.outcome];
      if (weight === 0) continue;
      const minutes = item.libraryItem.estimatedMinutes ?? 0;
      const minutesWeighted = minutes * weight;
      const dayKey = utcDayKey(item.completedAt);

      cycle.minutesWeighted += minutesWeighted;
      cycle.distinctDays.add(dayKey);

      if (item.completedAt >= weekStart && item.completedAt <= weekEnd) {
        week.minutesWeighted += minutesWeighted;
        week.distinctDays.add(dayKey);
      }
    }

    const pontosCiclo = pontosTotal(cycle);
    const pontosSemana = pontosTotal(week);
    const score = pontosCiclo + CURRENT_WEEK_MULTIPLIER * pontosSemana;

    return {
      user: u,
      score,
      consistencyDaysCycle: cycle.distinctDays.size,
      pontosSemana,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.consistencyDaysCycle !== a.consistencyDaysCycle) {
        return b.consistencyDaysCycle - a.consistencyDaysCycle;
      }
      if (b.pontosSemana !== a.pontosSemana) return b.pontosSemana - a.pontosSemana;
      return a.user.name.localeCompare(b.user.name, 'pt-BR', { sensitivity: 'base' });
    })
    .slice(0, TOP_N)
    .map(({ user }) => ({
      userId: user.userId,
      name: user.name,
      pictureUrl: user.pictureUrl,
      score: scored.find((s) => s.user.userId === user.userId)!.score,
      isMe: user.userId === currentUserId,
    }));
}
