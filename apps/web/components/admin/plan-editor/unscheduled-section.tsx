'use client';
import { AlertTriangle } from 'lucide-react';
import { SectionLabel } from '../../ui/section-label';
import { detectPlatform, platformLabel } from '../../../lib/format/platform';
import { formatMinutes } from '../../../lib/format/time';
import type { WeeklyPlanItem } from '../../../lib/queries/admin-plan-editor';

export type UnscheduledSectionProps = {
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  items: WeeklyPlanItem[];
  memberId: string;
};

export function UnscheduledSection({
  overflow,
  items,
  memberId,
}: UnscheduledSectionProps) {
  if (overflow.length === 0) return null;

  const itemsByLibId = new Map(items.map((i) => [i.libraryItemId, i]));
  const rows = overflow
    .map((o) => ({ overflow: o, item: itemsByLibId.get(o.itemId) }))
    .filter(
      (r): r is { overflow: (typeof overflow)[number]; item: WeeklyPlanItem } =>
        Boolean(r.item),
    );

  return (
    <section className="mt-8 rounded-card border border-outcome-stuck/40 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>
          <AlertTriangle
            className="mr-1 inline h-3 w-3 text-outcome-stuck"
            strokeWidth={1.5}
          />
          Unscheduled · {overflow.length} {overflow.length === 1 ? 'item' : 'items'}
        </SectionLabel>
      </div>
      <p className="mb-3 font-sans text-sm italic text-ink-soft">
        Não cabem na disponibilidade declarada esta semana.
      </p>
      <ul className="mb-3 space-y-2">
        {rows.map(({ overflow: o, item }) => {
          const platform = detectPlatform(
            item.libraryItem.url ?? null,
            item.libraryItem.format,
          );
          return (
            <li
              key={o.itemId}
              className="border-l-[3px] py-0.5 pl-2"
              style={{ borderLeftColor: `var(--platform-${platform})` }}
            >
              <p className="font-sans text-sm text-ink">{item.libraryItem.title}</p>
              <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                {platformLabel(platform)} ·{' '}
                {formatMinutes(item.libraryItem.estimatedMinutes)} · faltam{' '}
                {o.minutesRequired}min
              </p>
            </li>
          );
        })}
      </ul>
      <div className="space-y-1 font-mono text-[10px] uppercase tracking-label text-ink-mute">
        <p>Possíveis soluções:</p>
        <ul className="ml-3 space-y-0.5">
          <li>
            • Aumentar cap diário ou adicionar slot ·{' '}
            <a
              className="text-focus hover:underline"
              href={`/admin/member/${memberId}/availability`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir availability
            </a>
          </li>
          <li>• Deixar items pro próximo plano (vira carry-over)</li>
          <li>
            • Forçar publicação no modal de scheduling (rolam pra próxima semana)
          </li>
        </ul>
      </div>
    </section>
  );
}
