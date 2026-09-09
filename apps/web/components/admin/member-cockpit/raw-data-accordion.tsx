'use client';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { TimelineTab } from '../member-detail/timeline-tab';
import { RetrosTab } from '../member-detail/retros-tab';
import { DiagnoseTab } from '../member-detail/diagnose-tab';
import { NotesTab } from '../member-detail/notes-tab';
import { AttendanceTab } from '../member-detail/attendance-tab';
import { MocksTab } from '../member-detail/mocks-tab';
import { TopicCoverageMatrix } from '../member-detail/topic-coverage-matrix';
import { clsx } from 'clsx';

type Tab = 'timeline' | 'retros' | 'topic-coverage' | 'diagnose' | 'mocks' | 'notes' | 'attendance';

type Props = {
  memberId: string;
  cycleId: string | null;
  timeline: any;
  retros: any;
  attendance: any;
  topicCoverage: any;
};

const TAB_LABELS: Record<Tab, string> = {
  timeline: 'Timeline',
  retros: 'Retros',
  'topic-coverage': 'Topic coverage',
  diagnose: 'Diagnose',
  mocks: 'Mocks',
  notes: 'Notes',
  attendance: 'Attendance',
};

export function RawDataAccordion(props: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('timeline');

  return (
    <details
      className="bg-surface border border-border-token rounded-card"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="rounded-card px-5 py-4 cursor-pointer flex items-center gap-2 hover:bg-bg-subtle list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <ChevronRight className={clsx('w-3 h-3 text-fg-mute transition-transform', open && 'rotate-90')} />
        <span className="font-sans text-xs text-fg-mute font-medium">
          Raw data &amp; member retrospective
        </span>
        <span className="ml-auto hidden xl:inline font-sans text-xs text-fg-mute">
          timeline · retros · topic coverage · diagnose · mocks · notes · attendance
        </span>
      </summary>
      <div className="border-t border-border-token p-5 space-y-4">
        <nav aria-label="Member detail" className="flex gap-2 overflow-x-auto py-1 font-sans text-xs">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={
                tab === t
                  ? 'shrink-0 px-3 py-2 rounded-input bg-primary text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                  : 'shrink-0 px-3 py-2 rounded-input bg-bg-subtle text-fg-soft hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              }
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>
        <div>
          {tab === 'timeline' && <TimelineTab memberId={props.memberId} plans={props.timeline} />}
          {tab === 'retros' && <RetrosTab retros={props.retros} />}
          {tab === 'topic-coverage' && (
            <TopicCoverageMatrix
              topics={(props.topicCoverage ?? []).map((t: any) => ({
                topicId: t.topicId,
                slug: t.topicSlug,
                label: t.topicLabel,
                order: t.order,
                itemsPlanned: t.itemsPlanned,
                itemsDone: t.itemsDone,
              }))}
            />
          )}
          {tab === 'diagnose' && <DiagnoseTab memberId={props.memberId} />}
          {tab === 'mocks' && <MocksTab memberId={props.memberId} cycleId={props.cycleId} />}
          {tab === 'notes' && <NotesTab memberId={props.memberId} />}
          {tab === 'attendance' && <AttendanceTab attendance={props.attendance} />}
        </div>
      </div>
    </details>
  );
}
