'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowLeft, BookOpen, Radio } from 'lucide-react';
import type { Lesson } from './lesson-types';
import { Eyebrow } from '../../ui/eyebrow';
import { StudyMode } from './study-mode';
import { LiveMode } from './live-mode';

type Mode = 'study' | 'live';

export function LessonView({ lesson }: { lesson: Lesson }) {
  const [mode, setMode] = useState<Mode>('study');
  const beats = lesson.nodes.filter((n) => typeof n.beat === 'number').length;

  return (
    <div className="mx-auto max-w-[1280px] space-y-10 px-6 py-10">
      <Link
        href="/admin/meetings"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute hover:text-fg"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.8} /> All meetings
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
        <div className="flex-1 min-w-0 space-y-3">
          <Eyebrow>Aula · System Design</Eyebrow>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-fg">
            {lesson.title}
          </h1>
          <p className="max-w-2xl font-serif text-lg italic leading-snug text-fg-soft">
            {lesson.subtitle}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-fg-mute">
            {lesson.audience} · {lesson.durationMin} min · {beats} beats
          </p>
        </div>

        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      <div className="border-t border-border-token pt-8">
        {mode === 'study' ? <StudyMode lesson={lesson} /> : <LiveMode lesson={lesson} />}
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="inline-flex items-stretch rounded-card border border-border-token bg-surface p-1">
      <ToggleButton
        active={mode === 'study'}
        onClick={() => onChange('study')}
        icon={<BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />}
        title="Study"
        subtitle="solo prep"
      />
      <ToggleButton
        active={mode === 'live'}
        onClick={() => onChange('live')}
        icon={<Radio className="h-3.5 w-3.5" strokeWidth={1.8} />}
        title="Live"
        subtitle="durante a aula"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2.5 rounded-[8px] px-4 py-2 text-left transition-colors',
        active ? 'bg-fg text-bg' : 'text-fg-mute hover:text-fg',
      )}
    >
      <span
        className={clsx(
          'inline-grid h-7 w-7 place-items-center rounded-full',
          active ? 'bg-bg/15 text-bg' : 'bg-bg-subtle text-fg-soft',
        )}
      >
        {icon}
      </span>
      <span className="block">
        <span className="block font-sans text-sm font-semibold leading-none">
          {title}
        </span>
        <span
          className={clsx(
            'mt-1 block font-mono text-[10px] uppercase tracking-eyebrow',
            active ? 'text-bg/70' : 'text-fg-faint',
          )}
        >
          {subtitle}
        </span>
      </span>
    </button>
  );
}
