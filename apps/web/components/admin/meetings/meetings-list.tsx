'use client';

import Link from 'next/link';
import { ArrowRight, Clock, Layers, Users } from 'lucide-react';
import type { MeetingSummary } from './lesson-types';
import { Eyebrow } from '../../ui/eyebrow';

export function MeetingsList({ meetings }: { meetings: MeetingSummary[] }) {
  return (
    <div className="mx-auto max-w-[1280px] space-y-10 px-6 py-10">
      <header className="space-y-3">
        <Eyebrow>Admin · Meetings</Eyebrow>
        <h1 className="font-serif text-5xl font-semibold tracking-tight text-fg">
          Aulas
        </h1>
        <p className="max-w-2xl font-serif text-lg italic leading-snug text-fg-soft">
          Roteiros prontos pra facilitar — cada aula tem Study Mode pra você
          preparar e Live Mode pra navegar durante o encontro.
        </p>
      </header>

      <div className="border-t border-border-token pt-8">
        {meetings.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-4">
            {meetings.map((m) => (
              <MeetingCard key={m.slug} meeting={m} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: MeetingSummary }) {
  return (
    <li>
      <Link
        href={`/admin/meetings/${meeting.slug}`}
        className="group block rounded-card border border-border-token bg-surface p-7 transition-all hover:border-border-strong hover:bg-surface-hover"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
          <div className="min-w-0 flex-1 space-y-3">
            <Eyebrow>System Design</Eyebrow>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-fg">
              {meeting.title}
            </h2>
            <p className="font-serif text-base italic leading-snug text-fg-soft">
              {meeting.subtitle}
            </p>
            <p className="max-w-2xl text-sm leading-relaxed text-fg-soft">
              {meeting.blurb}
            </p>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-2 font-mono text-[11px] uppercase tracking-eyebrow text-fg-mute">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3 w-3" strokeWidth={1.8} />
                {meeting.audience}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" strokeWidth={1.8} />
                {meeting.durationMin} min
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3 w-3" strokeWidth={1.8} />
                {meeting.beatCount} beats
              </span>
            </div>
          </div>

          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-token bg-bg-subtle text-fg-soft transition-colors group-hover:border-fg group-hover:bg-fg group-hover:text-bg">
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </span>
        </div>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-border-token bg-bg-subtle/40 p-12 text-center">
      <p className="font-serif text-lg italic text-fg-soft">
        Sem aulas montadas ainda.
      </p>
    </div>
  );
}
