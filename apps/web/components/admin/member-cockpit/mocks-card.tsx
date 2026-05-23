'use client';
import { useAdminMocks, type AdminMock, type MockType } from '../../../lib/queries/admin-mocks';

const TYPE_LABEL: Record<MockType, string> = {
  BEHAVIORAL: 'BEH',
  CODING: 'COD',
  SYSTEM_DESIGN: 'SD',
};

const TYPE_LABEL_LONG: Record<MockType, string> = {
  BEHAVIORAL: 'Behavioral',
  CODING: 'Coding',
  SYSTEM_DESIGN: 'System Design',
};

type Props = {
  memberId: string;
  cycleId: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function avgScore(mocks: AdminMock[]): { value: string; raw: number } {
  if (mocks.length === 0) return { value: '—', raw: 0 };
  const sum = mocks.reduce((s, m) => s + m.score, 0);
  const avg = sum / mocks.length;
  return { value: avg.toFixed(1), raw: avg };
}

function countsByType(mocks: AdminMock[]): Record<MockType, number> {
  const out: Record<MockType, number> = { BEHAVIORAL: 0, CODING: 0, SYSTEM_DESIGN: 0 };
  for (const m of mocks) out[m.type] += 1;
  return out;
}

export function MocksCard({ memberId, cycleId }: Props) {
  const { data: mocks, isLoading } = useAdminMocks(memberId, cycleId);
  const list = mocks ?? [];
  const { value, raw } = avgScore(list);
  const counts = countsByType(list);
  const latest = list[0];

  // Color cue mirrors the engagement/items pattern: green when avg >= 4
  // (hire-bar territory), terracotta when <= 2 (real concern), neutral
  // otherwise. The admin scans this once per cockpit visit.
  const scoreTone =
    list.length === 0
      ? 'text-ink-faint'
      : raw >= 4
        ? 'text-outcome-done-easy'
        : raw <= 2
          ? 'text-outcome-stuck'
          : 'text-ink';

  return (
    <section className="bg-surface border border-rule rounded-lg p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
        Mocks
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`font-serif-tool tabular-nums font-semibold leading-none ${scoreTone}`}
          style={{ fontSize: 40 }}
        >
          {isLoading ? '—' : value}
        </span>
        <span className="font-serif-tool tabular-nums text-ink-faint text-base">/5.0</span>
      </div>

      <p className="mt-1.5 font-mono text-[11px] text-ink-mute tabular-nums">
        {list.length} mock{list.length === 1 ? '' : 's'}
        {list.length > 0 && (
          <>
            {' · '}
            {(Object.entries(counts) as Array<[MockType, number]>)
              .filter(([, n]) => n > 0)
              .map(([t, n]) => `${TYPE_LABEL[t]} ${n}`)
              .join(' · ')}
          </>
        )}
      </p>

      {latest && (
        <p className="mt-3 pt-3 border-t border-rule font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          Latest · {formatDate(latest.conductedAt)} {TYPE_LABEL_LONG[latest.type]}{' '}
          <span className="text-ink tabular-nums">{latest.score}/5</span>
        </p>
      )}
    </section>
  );
}
