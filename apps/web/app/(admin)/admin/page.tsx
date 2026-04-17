'use client';
import { useAdminTriage, useDismissAlert, type TriageAlert } from '../../../lib/queries/admin-triage';
import { TriageAlertRow } from '../../../components/admin/triage-alert-row';
import { CohortStrip } from '../../../components/admin/cohort-strip';
import { SectionLabel } from '../../../components/ui/section-label';
import { Eyebrow } from '../../../components/ui/eyebrow';

export default function AdminTriagePage() {
  const { data, isLoading } = useAdminTriage();
  const dismiss = useDismissAlert();

  if (isLoading || !data) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
    );
  }

  const urgent = data.alerts.filter((a) => a.severity === 'urgent');
  const attention = data.alerts.filter((a) => a.severity === 'attention');
  const scheduled = data.alerts.filter((a) => a.severity === 'scheduled');
  const focusCount = urgent.length + attention.length;

  const handleDismiss = (alert: TriageAlert) => {
    dismiss.mutate({ alertType: alert.type, targetId: alert.targetId ?? alert.member.id });
  };

  return (
    <div className="max-w-5xl space-y-10">
      <header>
        <Eyebrow>Triage · Admin home</Eyebrow>
        <h1 className="mt-3 font-serif-tool text-4xl font-semibold tracking-tight leading-tight">
          {focusCount === 0
            ? `You're all caught up.`
            : `${focusCount} thing${focusCount === 1 ? '' : 's'} need${focusCount === 1 ? 's' : ''} your attention today.`}
        </h1>
      </header>

      {urgent.length > 0 && (
        <section>
          <SectionLabel>URGENT · {urgent.length}</SectionLabel>
          <div className="border-t border-rule">
            {urgent.map((alert) => (
              <TriageAlertRow key={alert.id} alert={alert} onDismiss={() => handleDismiss(alert)} />
            ))}
          </div>
        </section>
      )}

      {attention.length > 0 && (
        <section>
          <SectionLabel>NEEDS ATTENTION · {attention.length}</SectionLabel>
          <div className="border-t border-rule">
            {attention.map((alert) => (
              <TriageAlertRow key={alert.id} alert={alert} onDismiss={() => handleDismiss(alert)} />
            ))}
          </div>
        </section>
      )}

      {scheduled.length > 0 && (
        <section>
          <SectionLabel>SCHEDULED · {scheduled.length}</SectionLabel>
          <div className="border-t border-rule">
            {scheduled.map((alert) => (
              <TriageAlertRow key={alert.id} alert={alert} onDismiss={() => handleDismiss(alert)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Cohort</SectionLabel>
        <CohortStrip entries={data.cohortStrip} />
      </section>

      {data.cycleInfo && (
        <footer className="border-t border-rule pt-4">
          <p className="font-mono text-xs text-ink-mute">
            {data.cycleInfo.cycleName} · week {data.cycleInfo.weekNumber} of {data.cycleInfo.weeksTotal} ·{' '}
            {data.cycleInfo.daysUntilWeekEnds} day{data.cycleInfo.daysUntilWeekEnds === 1 ? '' : 's'} until week ends
          </p>
        </footer>
      )}
    </div>
  );
}
