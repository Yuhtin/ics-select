'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowRight, Clock, Layers, Presentation, Users } from 'lucide-react';
import type { MeetingSummary } from './lesson-types';
import { Eyebrow } from '../../ui/eyebrow';
import { GROUP_META } from './group-meta';

export function MeetingsList({ meetings }: { meetings: MeetingSummary[] }) {
  return (
    <div className="mx-auto max-w-[1280px] space-y-10 px-6 py-10">
      <header className="space-y-3">
        <Eyebrow>Admin · Meetings</Eyebrow>
        <h1 className="font-serif text-5xl font-semibold tracking-tight text-fg">
          Aulas
        </h1>
        <p className="max-w-2xl font-sans text-lg leading-snug text-fg-soft">
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
  const meta = GROUP_META[meeting.primaryGroup];
  return (
    <li>
      <Link
        href={`/admin/meetings/${meeting.slug}`}
        className="group relative block overflow-hidden rounded-card border border-border-token bg-surface p-7 pl-9 transition-all hover:border-border-strong hover:bg-surface-hover"
      >
        <span
          aria-hidden
          className={clsx('absolute left-0 top-0 h-full w-[3px]', meta.stripeClass)}
        />
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
          <div className="min-w-0 flex-1 space-y-3">
            <Eyebrow className={meta.accentClass}>System Design · {meta.label}</Eyebrow>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-fg">
              {meeting.title}
            </h2>
            <p className="font-sans text-base leading-snug text-fg-soft">
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
              {meeting.slidesUrl && (
                <span className={clsx('inline-flex items-center gap-1.5', meta.accentClass)}>
                  <Presentation className="h-3 w-3" strokeWidth={1.8} />
                  Slides
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {meeting.slidesUrl && (
              <a
                href={meeting.slidesUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-10 items-center gap-2 rounded-card border border-border-token bg-bg-subtle px-3 font-mono text-[10px] uppercase tracking-eyebrow text-fg-soft transition-colors hover:border-fg hover:bg-fg hover:text-bg"
                title="Abrir slides em nova aba"
              >
                <Presentation className="h-3.5 w-3.5" strokeWidth={1.8} />
                Apresentar
              </a>
            )}
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-token bg-bg-subtle text-fg-soft transition-colors group-hover:border-fg group-hover:bg-fg group-hover:text-bg">
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-border-token bg-bg-subtle/40 p-12 text-center">
      <p className="font-sans text-lg text-fg-soft">
        Sem aulas montadas ainda.
      </p>
    </div>
  );
}
