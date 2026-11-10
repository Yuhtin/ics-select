'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, Plus } from 'lucide-react';
import { OPPORTUNITY_TYPES, OPPORTUNITY_TYPE_LABELS, daysUntilClose, type OpportunityType } from '@ics-select/shared';
import { useAuth } from '../../../../lib/auth/auth-context';
import {
  useOpportunities,
  useSaveOpportunity,
  useSetInterest,
  type OpportunityDto,
} from '../../../../lib/queries/opportunities';
import { StudioPageHeader } from '../../../../components/member/studio-page-header';
import { OpportunityCard } from '../../../../components/opportunities/opportunity-card';
import { OpportunityDetailModal } from '../../../../components/opportunities/opportunity-detail-modal';
import { OpportunityFormModal } from '../../../../components/opportunities/opportunity-form-modal';

type Filter = 'ALL' | 'INTERESTED' | OpportunityType;

const GRID =
  'grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] min-[1400px]:[grid-template-columns:repeat(auto-fill,minmax(300px,380px))]';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Chip({ on, onPress, label, count }: { on: boolean; onPress: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPress}
      className={clsx(
        'inline-flex min-h-8 items-center gap-1 rounded-pill border px-3 font-sans text-xs transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        on ? 'border-fg bg-fg text-bg' : 'border-border-token bg-surface text-fg-soft hover:bg-surface-hover',
      )}
    >
      {label}
      <span className={clsx('font-mono', on ? 'text-bg/70' : 'text-fg-faint')}>{count}</span>
    </button>
  );
}

export default function MeOpportunitiesPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useOpportunities();
  const setInterest = useSetInterest();
  const save = useSaveOpportunity();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ initial: OpportunityDto | null } | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const all = data ?? [];
  const open = all.filter((o) => o.isOpen);
  const closed = all.filter((o) => !o.isOpen);
  const now = new Date();
  const closingSoon = open.filter((o) => {
    const d = daysUntilClose(o, now);
    return d !== null && d <= 7;
  }).length;
  const typeCounts = OPPORTUNITY_TYPES.map((t) => [t, open.filter((o) => o.type === t).length] as const).filter(
    ([, n]) => n > 0,
  );
  const matches = (o: OpportunityDto) =>
    filter === 'ALL' ? true : filter === 'INTERESTED' ? o.interestedByMe : o.type === filter;
  const shownOpen = open.filter(matches);
  const shownClosed = closed.filter(matches);
  const detail = all.find((o) => o.id === openId) ?? null;

  const toggle = (o: OpportunityDto) => setInterest.mutate({ id: o.id, on: !o.interestedByMe });
  const shareButton = (
    <button
      type="button"
      onClick={() => setForm({ initial: null })}
      className="inline-flex min-h-11 items-center gap-2 rounded-input bg-fg px-4 font-sans text-sm font-semibold text-bg hover:bg-fg/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
      Share an opportunity
    </button>
  );

  if (isLoading || error) {
    return (
      <div className="max-w-[1180px]">
        <p role={isLoading ? 'status' : 'alert'} className="border-t border-border-token py-6 font-sans text-sm text-fg-mute">
          {isLoading ? 'Loading…' : 'Could not load opportunities.'}
        </p>
      </div>
    );
  }

  const renderCard = (o: OpportunityDto) => (
    <OpportunityCard key={o.id} o={o} onOpen={() => setOpenId(o.id)} onToggleInterest={() => toggle(o)} />
  );

  return (
    <div className="max-w-[1180px] space-y-6">
      <StudioPageHeader
        eyebrow="Opportunities"
        title={<span className="font-serif font-medium tracking-normal">O que está aberto agora</span>}
        description={
          <span className="font-serif text-base">
            {plural(open.length, 'oportunidade aberta', 'oportunidades abertas')} ·{' '}
            {plural(closingSoon, 'fecha', 'fecham')} esta semana
          </span>
        }
        action={shareButton}
      />

      {open.length === 0 ? (
        <section className="flex flex-col items-start gap-4 py-6">
          <p className="font-serif text-lg text-fg-soft">Nothing open right now.</p>
          {shareButton}
        </section>
      ) : (
        <>
          <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
            <Chip on={filter === 'ALL'} onPress={() => setFilter('ALL')} label="All" count={open.length} />
            {typeCounts.map(([t, n]) => (
              <Chip key={t} on={filter === t} onPress={() => setFilter(t)} label={OPPORTUNITY_TYPE_LABELS[t]} count={n} />
            ))}
            <span className="ml-2" />
            <Chip
              on={filter === 'INTERESTED'}
              onPress={() => setFilter('INTERESTED')}
              label="Interested"
              count={open.filter((o) => o.interestedByMe).length}
            />
          </div>
          {shownOpen.length > 0 ? (
            <div className={GRID}>{shownOpen.map(renderCard)}</div>
          ) : (
            <p className="py-6 font-sans text-sm text-fg-mute">
              {filter === 'INTERESTED' ? 'You haven’t flagged any open opportunity yet.' : 'Nothing open in this category.'}
            </p>
          )}
        </>
      )}

      {shownClosed.length > 0 && (
        <section className="border-t border-border-token pt-3">
          <button
            type="button"
            aria-expanded={showClosed}
            onClick={() => setShowClosed((s) => !s)}
            className="inline-flex min-h-9 items-center gap-1 font-sans text-[13px] text-fg-mute hover:text-fg"
          >
            <ChevronRight
              aria-hidden="true"
              className={clsx('h-4 w-4 transition-transform duration-150', showClosed && 'rotate-90')}
              strokeWidth={1.5}
            />
            Closed <span className="font-mono">({shownClosed.length})</span>
          </button>
          {showClosed && <div className={clsx(GRID, 'mt-3')}>{shownClosed.map(renderCard)}</div>}
        </section>
      )}

      <OpportunityDetailModal
        o={detail}
        meId={user?.id}
        onClose={() => setOpenId(null)}
        onToggleInterest={toggle}
        onEdit={(o) => {
          setOpenId(null);
          setForm({ initial: o });
        }}
        onArchive={(o) => save.mutate({ id: o.id, input: { status: 'ARCHIVED' } }, { onSuccess: () => setOpenId(null) })}
      />
      <OpportunityFormModal
        mode="member"
        isOpen={form !== null}
        initial={form?.initial}
        onClose={() => setForm(null)}
      />
    </div>
  );
}
