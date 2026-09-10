'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ArrowLeft, ChevronDown, MessageCircle } from 'lucide-react';
import { useAdminCockpit } from '../../../../../lib/queries/admin-cockpit';
import { useAdminMember } from '../../../../../lib/queries/admin-member';
import type {
  MemberDetailResponse,
  PlanWeekSlot,
} from '../../../../../lib/queries/admin-member';
import { RiskBanner } from '../../../../../components/admin/member-cockpit/risk-banner';
import { EngagementCard } from '../../../../../components/admin/member-cockpit/engagement-card';
import { ItemsCompletedCard } from '../../../../../components/admin/member-cockpit/items-completed-card';
import { TimeInvestedCard } from '../../../../../components/admin/member-cockpit/time-invested-card';
import { BehaviorStrip } from '../../../../../components/admin/member-cockpit/behavior-strip';
import { TopicEngagementTable } from '../../../../../components/admin/member-cockpit/topic-engagement-table';
import { SessionPatternCard } from '../../../../../components/admin/member-cockpit/session-pattern-card';
import { ClassAttendanceCard } from '../../../../../components/admin/member-cockpit/class-attendance-card';
import { LatestActivityCard } from '../../../../../components/admin/member-cockpit/latest-activity-card';
import { RawDataAccordion } from '../../../../../components/admin/member-cockpit/raw-data-accordion';
import { MocksCard } from '../../../../../components/admin/member-cockpit/mocks-card';
import { PlanWeekModal } from '../../../../../components/admin/member-detail/plan-week-modal';
import { Eyebrow } from '../../../../../components/ui/eyebrow';

type Range = 'cycle' | '7d' | 'all';

export default function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = use(params);
  const router = useRouter();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('cycle');
  const [planWeekOpen, setPlanWeekOpen] = useState(false);
  const { data, isLoading, error } = useAdminCockpit(memberId, selectedCycleId, range);
  const { data: rawData } = useAdminMember(memberId, selectedCycleId);

  function handlePickWeek(slot: PlanWeekSlot) {
    setPlanWeekOpen(false);
    if (slot.planId) {
      router.push(`/admin/member/${memberId}/plan/${slot.planId}`);
    } else {
      const isoDate = slot.weekStart.slice(0, 10);
      router.push(`/admin/member/${memberId}/plan/new?weekStart=${isoDate}`);
    }
  }

  if (isLoading) return <p className="font-sans text-xs text-fg-mute">Loading…</p>;
  if (error || !data) {
    return (
      <div className="max-w-xl space-y-4">
        <Link href="/admin/members" className="inline-flex items-center gap-1.5 font-sans text-xs text-fg-mute hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} /> All members
        </Link>
        <p className="font-sans text-sm text-outcome-stuck">Failed to load cockpit. {error instanceof Error ? error.message : ''}</p>
      </div>
    );
  }

  const { member, cycle, risk } = data;
  const waLink = member.whatsappPhone
    ? `https://wa.me/${member.whatsappPhone.replace(/[^0-9]/g, '')}`
    : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/members" className="inline-flex items-center gap-1.5 font-sans text-xs text-fg-mute hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} /> All members
      </Link>

      <header className="flex items-end justify-between flex-wrap gap-4 pb-5 border-b border-border-token">
        <div className="flex items-end gap-4 min-w-0 w-full lg:w-auto">
          <Avatar name={member.name} pictureUrl={member.pictureUrl} />
          <div className="min-w-0">
            <Eyebrow>Member</Eyebrow>
            <h1 className="font-sans text-3xl leading-tight font-semibold text-fg tracking-tight">
              {member.name}
            </h1>
            <p className="font-sans text-xs text-fg-mute mt-1.5 break-words">
              {member.track ?? 'No track'}
              {cycle && <> · {cycle.name} · week {cycle.weekNumber} of {cycle.weeksTotal}</>}
              {' · '}{member.email}
            </p>
            {rawData && rawData.memberships.length > 1 && (
              <CyclePicker
                memberships={rawData.memberships}
                selectedCycleId={selectedCycleId ?? cycle?.id ?? null}
                onSelect={setSelectedCycleId}
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeSelector value={range} onChange={setRange} />
          <button
            type="button"
            onClick={() => setPlanWeekOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-fg font-sans text-xs px-4 py-2 rounded-pill hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Plan week
            <ChevronDown className="w-3 h-3" strokeWidth={2} />
          </button>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-bg-subtle text-fg-soft font-sans text-xs px-4 py-2 rounded-pill hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <MessageCircle className="w-3 h-3" strokeWidth={1.5} /> WhatsApp
            </a>
          )}
        </div>
      </header>

      {risk.status !== 'ON_TRACK' && (
        <RiskBanner status={risk.status} reasons={risk.reasons} />
      )}

      {/* Engagement is null on range=all (cohort comparison has no meaning
          across cycles). Drop the container to 9 columns so the two remaining
          cards, 6 + 3, still fill the row instead of leaving a gap. */}
      <div className={clsx('grid grid-cols-1 gap-4', data.engagement ? 'lg:grid-cols-12' : 'lg:grid-cols-9')}>
        {data.engagement && (
          <EngagementCard engagement={data.engagement} status={data.risk.status} />
        )}
        <ItemsCompletedCard itemsCompleted={data.itemsCompleted} />
        <TimeInvestedCard timeInvested={data.timeInvested} weeksTotal={data.cycle?.weeksTotal ?? 9} />
      </div>

      <BehaviorStrip behavior={data.behavior} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <TopicEngagementTable topics={data.topicEngagement} />
        <div className="min-w-0 grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          <MocksCard memberId={memberId} cycleId={selectedCycleId ?? cycle?.id ?? null} />
          <SessionPatternCard behavior={data.behavior} />
          <ClassAttendanceCard classAttendance={data.classAttendance} firstSession={data.firstSession} cycle={data.cycle} />
          <LatestActivityCard events={data.recentActivity} />
        </div>
      </div>

      {rawData && (
        <RawDataAccordion
          memberId={memberId}
          cycleId={selectedCycleId ?? cycle?.id ?? null}
          timeline={rawData.timeline}
          retros={rawData.retros}
          attendance={rawData.attendance}
          topicCoverage={rawData.topicCoverage}
        />
      )}

      {rawData && (
        <PlanWeekModal
          isOpen={planWeekOpen}
          onClose={() => setPlanWeekOpen(false)}
          current={rawData.planWeeks.current}
          next={rawData.planWeeks.next}
          onPick={handlePickWeek}
        />
      )}
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
        className="w-14 h-14 shrink-0 rounded-full object-cover border border-border-token"
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
    <div className="w-14 h-14 shrink-0 rounded-full bg-bg-subtle border border-border-token flex items-center justify-center font-sans text-fg text-xl font-semibold">
      {initials || '—'}
    </div>
  );
}

function CyclePicker({
  memberships,
  selectedCycleId,
  onSelect,
}: {
  memberships: MemberDetailResponse['memberships'];
  selectedCycleId: string | null;
  onSelect: (cycleId: string) => void;
}) {
  // Sort: ACTIVE first by startsAt desc, then ARCHIVED by startsAt desc.
  // The current/most-recent ACTIVE cycle ends up first, archived ones trail.
  const sorted = [...memberships].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
    return (
      new Date(b.cycleStartsAt).getTime() - new Date(a.cycleStartsAt).getTime()
    );
  });
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {sorted.map((m) => {
        const isSelected = selectedCycleId === m.cycleId;
        const isArchived = m.status === 'ARCHIVED';
        return (
          <button
            key={m.cycleId}
            type="button"
            onClick={() => onSelect(m.cycleId)}
            aria-pressed={isSelected}
            className={clsx(
              'rounded-pill border px-2.5 py-1.5 font-sans text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isSelected
                ? 'border-primary bg-primary text-primary-fg'
                : isArchived
                  ? 'border-border-token text-fg-mute hover:text-fg-mute'
                  : 'border-border-token text-fg-mute hover:text-fg hover:border-border-strong',
            )}
          >
            {m.cycleName}
            {isArchived && <span className="ml-1 opacity-70">(archived)</span>}
          </button>
        );
      })}
    </div>
  );
}

function RangeSelector({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const opts: Range[] = ['7d', 'cycle', 'all'];
  return (
    <div className="inline-flex bg-bg-subtle rounded-pill p-1 font-sans text-xs">
      {opts.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className={
            value === r
              ? 'px-3 py-1.5 rounded-pill bg-primary text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
              : 'px-3 py-1.5 rounded-pill text-fg-mute hover:text-fg hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          }
        >
          {r === '7d' ? '7d' : r === 'cycle' ? 'Cycle' : 'All'}
        </button>
      ))}
    </div>
  );
}
