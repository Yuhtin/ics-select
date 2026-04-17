'use client';

import { useState } from 'react';
import type { ItemOutcome } from '@ics-select/shared';
import { Button } from '../../../components/ui/button';
import { Pill } from '../../../components/ui/pill';
import { OutcomeDot } from '../../../components/ui/outcome-dot';
import { OutcomePicker } from '../../../components/ui/outcome-picker';
import { Card } from '../../../components/ui/card';
import { Eyebrow } from '../../../components/ui/eyebrow';
import { SectionLabel } from '../../../components/ui/section-label';
import { ListRow } from '../../../components/ui/list-row';
import { DayHeader } from '../../../components/ui/day-header';
import { StreakCard } from '../../../components/ui/streak-card';

export default function DesignSystemPage() {
  const [outcome, setOutcome] = useState<ItemOutcome | null>('DONE_HARD');

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-10">
      <header>
        <Eyebrow>Dev · Design System</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">
          Magazine Editorial primitives
        </h1>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          Sandbox to visually verify tokens, fonts, and components. Delete this route before ship.
        </p>
      </header>

      <section>
        <SectionLabel>Typography</SectionLabel>
        <Card className="p-6 space-y-4">
          <p className="font-serif text-[40px] font-medium leading-none tracking-tight">
            Newsreader 40 — headlines.
          </p>
          <p className="font-serif-tool text-2xl font-semibold tabular-nums">
            Source Serif 4 · tabular 1,234,567 · tool tone
          </p>
          <p className="font-sans text-base text-ink-soft">
            Inter 16 — body copy. UI chrome, labels, paragraphs.
          </p>
          <p className="font-mono text-xs uppercase tracking-eyebrow text-ink-mute">
            IBM Plex Mono · 12 · eyebrow label
          </p>
        </Card>
      </section>

      <section>
        <SectionLabel>Buttons</SectionLabel>
        <Card className="p-6 flex flex-wrap gap-3 items-center">
          <Button variant="primary" size="sm">Small primary</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="primary" size="lg">Large primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link button</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </Card>
      </section>

      <section>
        <SectionLabel>Pills</SectionLabel>
        <Card className="p-6 flex flex-wrap gap-2">
          <Pill>LEETCODE</Pill>
          <Pill variant="soft">DP</Pill>
          <Pill variant="outline">45 min</Pill>
        </Card>
      </section>

      <section>
        <SectionLabel>Outcome dots</SectionLabel>
        <Card className="p-6 flex flex-wrap gap-4 items-center text-sm">
          {(['PENDING', 'DONE_EASY', 'DONE_HARD', 'DOUBTS', 'STUCK'] as ItemOutcome[]).map((o) => (
            <span key={o} className="inline-flex items-center gap-2">
              <OutcomeDot outcome={o} />
              <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                {o}
              </span>
            </span>
          ))}
          <span className="inline-flex items-center gap-2 ml-6">
            <OutcomeDot outcome="PENDING" active />
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
              PENDING · active
            </span>
          </span>
        </Card>
      </section>

      <section>
        <SectionLabel>Outcome picker</SectionLabel>
        <Card className="p-6 space-y-3">
          <OutcomePicker value={outcome} onChange={setOutcome} />
          <p className="font-mono text-[11px] text-ink-mute">
            current: <span className="text-ink">{outcome ?? 'null'}</span>
          </p>
        </Card>
      </section>

      <section>
        <SectionLabel>List rows (Today)</SectionLabel>
        <Card className="px-6">
          <DayHeader label="Today" hint="3 items · 110 min" />
          <ListRow
            time="13:00"
            outcome="DONE_EASY"
            title="Recursion intro"
            meta="VIDEO · 30 MIN"
          />
          <ListRow
            time="19:00"
            outcome="PENDING"
            active
            title="Binary search patterns"
            meta="LEETCODE · 45 MIN · NOW"
          />
          <ListRow
            time="21:00"
            outcome="PENDING"
            title="Complexity review"
            meta="ARTICLE · 20 MIN"
          />
        </Card>
      </section>

      <section>
        <SectionLabel>Streak card</SectionLabel>
        <div className="max-w-xs">
          <StreakCard current={12} last7={[true, true, true, false, true, true, true]} />
        </div>
      </section>
    </div>
  );
}
