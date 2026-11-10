'use client';

import { clsx } from 'clsx';
import { Bookmark } from 'lucide-react';
import { OPPORTUNITY_TYPE_LABELS, daysUntilClose, type WorkMode } from '@ics-select/shared';
import type { OpportunityDto } from '../../lib/queries/opportunities';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WORK_MODE_LABELS: Record<WorkMode, string> = { REMOTE: 'Remote', HYBRID: 'Hybrid', ONSITE: 'Onsite' };

/** 'YYYY-MM-DD' → '13 nov'. */
export function shortDate(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

const DAY_MS = 86_400_000;

export function isNewOpportunity(o: OpportunityDto, now = new Date()): boolean {
  return !!o.publishedAt && now.getTime() - Date.parse(o.publishedAt) < 7 * DAY_MS;
}

export function isUrgent(o: OpportunityDto, now = new Date()): boolean {
  const d = daysUntilClose(o, now);
  return o.isOpen && d !== null && d <= 7;
}

function inDays(d: number): string {
  return d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`;
}

/** "Fecha em 3 dias · 13 nov" / "Evento em 6 dias · 16 nov" / "Fecha 30 nov" / "Sem prazo". */
export function closingLine(o: OpportunityDto, now = new Date()): string {
  const date = o.deadline ?? o.eventDate;
  if (!date) return 'Sem prazo';
  const verb = o.deadline ? 'Fecha' : 'Evento';
  if (!o.isOpen) return `${o.deadline ? 'Fechou' : 'Evento'} ${shortDate(date)}`;
  const d = daysUntilClose(o, now)!;
  return d <= 7 ? `${verb} ${inDays(d)} · ${shortDate(date)}` : `${verb} ${shortDate(date)}`;
}

export function placeLine(o: OpportunityDto): string {
  return [o.location, o.workMode && WORK_MODE_LABELS[o.workMode]].filter(Boolean).join(' · ');
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

export function AvatarStack({ people }: { people: { userId: string; name: string; pictureUrl: string | null }[] }) {
  return (
    <span className="flex items-center" aria-hidden="true">
      {people.slice(0, 4).map((p, i) => (
        <span
          key={p.userId}
          className={clsx(
            'inline-grid h-6 w-6 place-items-center overflow-hidden rounded-full border-2 border-surface bg-bg-subtle font-sans text-[10px] font-semibold text-fg-soft',
            i > 0 && '-ml-1.5',
          )}
        >
          {p.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.pictureUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(p.name)
          )}
        </span>
      ))}
    </span>
  );
}

export function TypeMeta({ o, now }: { o: OpportunityDto; now?: Date }) {
  return (
    <>
      <span className="font-mono text-[11px] uppercase tracking-label text-fg-mute">
        {OPPORTUNITY_TYPE_LABELS[o.type]}
      </span>
      {o.isOpen && isNewOpportunity(o, now) && (
        <span className="flex items-center gap-1 font-sans text-[10px] font-bold tracking-label text-focus">
          <span className="h-1.5 w-1.5 rounded-full bg-focus" aria-hidden="true" />
          NEW
        </span>
      )}
    </>
  );
}

export function InterestButton({
  o,
  onToggle,
  className,
  children = 'Interested',
}: {
  o: OpportunityDto;
  onToggle: () => void;
  className?: string;
  children?: string;
}) {
  const on = o.interestedByMe;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!o.isOpen}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={clsx(
        'inline-flex min-h-9 items-center gap-1.5 rounded-input border px-3 font-sans text-xs font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'border-fg bg-fg text-bg' : 'border-border-token bg-surface text-fg hover:bg-surface-hover',
        className,
      )}
    >
      <Bookmark aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} fill={on ? 'currentColor' : 'none'} />
      {children}
    </button>
  );
}

function interestCount(o: OpportunityDto): string {
  const n = o.interests.length;
  if (n === 0) return 'Ninguém ainda';
  if (o.interestedByMe) return `${n} · incluindo você`;
  return `${n} interessado${n === 1 ? '' : 's'}`;
}

export function OpportunityCard({
  o,
  onOpen,
  onToggleInterest,
}: {
  o: OpportunityDto;
  onOpen: () => void;
  onToggleInterest: () => void;
}) {
  const urgent = isUrgent(o);
  const place = placeLine(o);
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="opportunity-card"
      aria-label={`${o.companyName} — ${o.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={clsx(
        'flex w-full max-w-[380px] cursor-pointer flex-col gap-2.5 rounded-[12px] border border-border-token bg-surface p-4 text-left transition-colors duration-150',
        'hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        urgent && 'border-l-[3px] border-l-outcome-done-hard',
        !o.isOpen && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2">
        <TypeMeta o={o} />
      </div>
      <div>
        <p className="font-sans text-[13px] font-semibold text-fg-soft">{o.companyName}</p>
        <h3 className="font-serif text-[19px] font-medium leading-snug text-fg">{o.title}</h3>
      </div>
      {(place || o.compensation) && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 font-sans text-xs text-fg-mute">
          {place && <span>{place}</span>}
          {o.compensation && <span className="text-fg-soft">{o.compensation}</span>}
        </p>
      )}
      <p className={clsx('font-mono text-xs', urgent ? 'font-semibold text-outcome-done-hard' : 'text-fg-mute')}>
        {closingLine(o)}
      </p>
      {o.createdBy.role === 'MEMBER' && (
        <p className="font-sans text-xs text-fg-mute">Shared by {o.createdBy.name}</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-token pt-2.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <AvatarStack people={o.interests} />
          <small className="truncate font-sans text-xs text-fg-mute">{interestCount(o)}</small>
        </span>
        <InterestButton o={o} onToggle={onToggleInterest} />
      </div>
    </div>
  );
}
