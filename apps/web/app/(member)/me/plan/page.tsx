'use client';

import { useMeHome } from '../../../../lib/queries/me-home';
import { WeekList } from '../../../../components/member/week-list';
import { Eyebrow } from '../../../../components/ui/eyebrow';

export default function MePlanPage() {
  const { data, isLoading } = useMeHome();
  if (isLoading || !data) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
        Loading…
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Eyebrow>This week</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">
          Your full plan.
        </h1>
      </div>
      <WeekList today={data.today} days={data.days} />
    </div>
  );
}
