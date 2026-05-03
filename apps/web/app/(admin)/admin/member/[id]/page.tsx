'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, MessageCircle } from 'lucide-react';
import { useAdminCockpit } from '../../../../../lib/queries/admin-cockpit';
import { RiskBanner } from '../../../../../components/admin/member-cockpit/risk-banner';
import { EngagementCard } from '../../../../../components/admin/member-cockpit/engagement-card';
import { ItemsCompletedCard } from '../../../../../components/admin/member-cockpit/items-completed-card';
import { TimeInvestedCard } from '../../../../../components/admin/member-cockpit/time-invested-card';
import { BehaviorStrip } from '../../../../../components/admin/member-cockpit/behavior-strip';
import { TopicEngagementTable } from '../../../../../components/admin/member-cockpit/topic-engagement-table';
import { SessionPatternCard } from '../../../../../components/admin/member-cockpit/session-pattern-card';
import { Eyebrow } from '../../../../../components/ui/eyebrow';

type Range = 'cycle' | '7d' | 'all';

export default function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = use(params);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('cycle');
  const { data, isLoading, error } = useAdminCockpit(memberId, selectedCycleId, range);

  if (isLoading) return <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">Loading…</p>;
  if (error || !data) {
    return (
      <div className="max-w-xl space-y-4">
        <Link href="/admin/members" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute hover:text-ink">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} /> All members
        </Link>
        <p className="font-sans text-sm text-stuck">Failed to load cockpit. {error instanceof Error ? error.message : ''}</p>
      </div>
    );
  }

  const { member, cycle, risk } = data;
  const waLink = member.whatsappPhone
    ? `https://wa.me/${member.whatsappPhone.replace(/[^0-9]/g, '')}`
    : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/members" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute hover:text-ink">
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} /> All members
      </Link>

      <header className="flex items-end justify-between flex-wrap gap-4 pb-5 border-b border-rule">
        <div className="flex items-end gap-4 min-w-0">
          <Avatar name={member.name} pictureUrl={member.pictureUrl} />
          <div className="min-w-0">
            <Eyebrow>Member</Eyebrow>
            <h1 className="font-serif text-[34px] leading-[1.05] font-semibold text-ink tracking-tight">
              {member.name}
            </h1>
            <p className="font-mono text-[11px] text-ink-mute mt-1.5">
              {member.track ?? 'No track'}
              {cycle && <> · {cycle.name} · week {cycle.weekNumber} of {cycle.weeksTotal}</>}
              {' · '}{member.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RangeSelector value={range} onChange={setRange} />
          <button
            type="button"
            className="inline-flex items-center gap-2 bg-ink text-paper font-mono text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-pill hover:opacity-90"
          >
            Plan week
            <ChevronDown className="w-3 h-3" strokeWidth={2} />
          </button>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-paper-warm text-ink-soft font-mono text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-pill hover:bg-rule"
            >
              <MessageCircle className="w-3 h-3" strokeWidth={1.5} /> WhatsApp
            </a>
          )}
        </div>
      </header>

      {risk.status !== 'ON_TRACK' && (
        <RiskBanner status={risk.status} reasons={risk.reasons} />
      )}

      <div className="grid grid-cols-12 gap-5">
        <EngagementCard engagement={data.engagement} status={data.risk.status} />
        <ItemsCompletedCard itemsCompleted={data.itemsCompleted} />
        <TimeInvestedCard timeInvested={data.timeInvested} />
      </div>

      <BehaviorStrip behavior={data.behavior} />

      <div className="grid grid-cols-12 gap-5">
        <TopicEngagementTable topics={data.topicEngagement} />
        <div className="col-span-4 space-y-5">
          <SessionPatternCard behavior={data.behavior} />
          <div className="bg-surface border border-rule rounded-lg p-6 text-ink-faint font-mono text-[11px]">
            ClassAttendanceCard (T19)
          </div>
          <div className="bg-surface border border-rule rounded-lg p-6 text-ink-faint font-mono text-[11px]">
            LatestActivityCard (T20)
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, pictureUrl }: { name: string; pictureUrl: string | null }) {
  if (pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={pictureUrl}
        alt=""
        className="w-14 h-14 rounded-full object-cover border border-rule"
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="w-14 h-14 rounded-full bg-paper-warm border border-rule flex items-center justify-center font-serif text-ink text-xl font-semibold">
      {initials || '—'}
    </div>
  );
}

function RangeSelector({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const opts: Range[] = ['7d', 'cycle', 'all'];
  return (
    <div className="inline-flex bg-paper-warm rounded-pill p-1 font-mono text-[11px] uppercase tracking-[0.1em]">
      {opts.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={
            value === r
              ? 'px-3 py-1.5 rounded-pill bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'px-3 py-1.5 rounded-pill text-ink-mute hover:text-ink'
          }
        >
          {r === '7d' ? '7d' : r === 'cycle' ? 'Cycle' : 'All'}
        </button>
      ))}
    </div>
  );
}
