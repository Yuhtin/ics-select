'use client';
import Link from 'next/link';
import {
  useAdminTriage,
  useDismissAlert,
  type TriageAlert,
} from '../../../lib/queries/admin-triage';
import type { CycleOverviewResponse } from '../../../lib/queries/admin-cycle';
import { TriageAlertRow } from '../triage-alert-row';
import { RankingToggle } from '../ranking-toggle';
import { CycleMembersGrid } from '../cycle-members-grid';
import { CohortHeatmap } from '../cohort-heatmap';
import { CohortFeed } from '../../member/cohort-feed';
import { ClassesSection } from '../cycles/classes-section';
import { Eyebrow } from '../../ui/eyebrow';
import { SectionLabel } from '../../ui/section-label';

export function CycleOverviewView({ data }: { data: CycleOverviewResponse }) {
  const triage = useAdminTriage();
  const dismiss = useDismissAlert();

  const alerts = triage.data?.alerts ?? [];
  const urgent = alerts.filter((a) => a.severity === 'urgent');
  const attention = alerts.filter((a) => a.severity === 'attention');
  const scheduled = alerts.filter((a) => a.severity === 'scheduled');
  const focusCount = urgent.length + attention.length;

  const handleDismiss = (alert: TriageAlert) => {
    dismiss.mutate({ alertType: alert.type, targetId: alert.targetId ?? alert.member.id });
  };

  return (
    <div className="max-w-6xl space-y-10">
      <header className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="flex-1 min-w-0">
          <Eyebrow>Cycle · {data.cycle.status}</Eyebrow>
          <h1 className="mt-3 font-serif-tool text-4xl font-semibold tracking-tight leading-tight">
            {data.cycle.name}
            {data.cycle.weekNumber > 0 ? (
              <> · week {data.cycle.weekNumber} of {data.cycle.weeksTotal}</>
            ) : (
              <> · upcoming · {data.cycle.weeksTotal} weeks</>
            )}
          </h1>
          <p className="mt-2 font-mono text-xs text-ink-mute">
            {data.members.length} members
            {data.cycle.weekNumber === 0 && (
              <>
                {' · starts '}
                {new Date(data.cycle.startsAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/plans?cycleId=${data.cycle.id}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label text-ink-soft hover:text-ink"
          >
            All plans →
          </Link>
          <RankingToggle
            cycleId={data.cycle.id}
            checked={data.cycle.rankingVisibleToMembers}
          />
        </div>
      </header>

      {!triage.isLoading && (
        <section className="space-y-6">
          <div className="flex items-baseline justify-between">
            <SectionLabel>Triage</SectionLabel>
            <p className="font-mono text-xs text-ink-mute">
              {focusCount === 0
                ? `You're all caught up.`
                : `${focusCount} thing${focusCount === 1 ? '' : 's'} need${focusCount === 1 ? 's' : ''} your attention today.`}
            </p>
          </div>

          {urgent.length > 0 && (
            <div>
              <SectionLabel>URGENT · {urgent.length}</SectionLabel>
              <div className="border-t border-rule">
                {urgent.map((alert) => (
                  <TriageAlertRow
                    key={alert.id}
                    alert={alert}
                    onDismiss={() => handleDismiss(alert)}
                  />
                ))}
              </div>
            </div>
          )}

          {attention.length > 0 && (
            <div>
              <SectionLabel>NEEDS ATTENTION · {attention.length}</SectionLabel>
              <div className="border-t border-rule">
                {attention.map((alert) => (
                  <TriageAlertRow
                    key={alert.id}
                    alert={alert}
                    onDismiss={() => handleDismiss(alert)}
                  />
                ))}
              </div>
            </div>
          )}

          {scheduled.length > 0 && (
            <div>
              <SectionLabel>SCHEDULED · {scheduled.length}</SectionLabel>
              <div className="border-t border-rule">
                {scheduled.map((alert) => (
                  <TriageAlertRow
                    key={alert.id}
                    alert={alert}
                    onDismiss={() => handleDismiss(alert)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <SectionLabel>Members</SectionLabel>
        <CycleMembersGrid members={data.members} />
      </section>

      <section className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <SectionLabel>Cohort heatmap · all weeks</SectionLabel>
          <CohortHeatmap weeks={data.heatmap.weeks} rows={data.heatmap.rows} />
        </div>
        <aside className="space-y-3">
          <SectionLabel>Activity · last 7d</SectionLabel>
          <CohortFeed feed={data.feed} />
        </aside>
      </section>

      <ClassesSection
        cycleId={data.cycle.id}
        members={data.members.map((m) => ({
          userId: m.userId,
          name: m.name,
          pictureUrl: m.pictureUrl,
        }))}
      />
    </div>
  );
}
