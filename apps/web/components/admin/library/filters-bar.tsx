'use client';
import { clsx } from 'clsx';
import type { Topic } from '../../../lib/queries/admin-topics';

const FORMATS = ['VIDEO', 'ARTICLE', 'BOOK', 'PROBLEM', 'OTHER'] as const;
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
const TRACKS = [
  'BIG_TECH',
  'CONSULTING_TECH',
  'COMPETITIVE_PROGRAMMING',
  'STARTUP',
  'OTHER',
] as const;

export interface FiltersState {
  format: string[];
  difficulty: string[];
  tracks: string[];
  topicId: string | null;
}

interface Props {
  topics: Topic[];
  value: FiltersState;
  onChange: (next: FiltersState) => void;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'font-mono text-[10px] uppercase tracking-label px-3 py-1 rounded-pill border transition-colors',
        active
          ? 'bg-ink text-paper border-ink'
          : 'bg-paper text-ink-soft border-rule hover:bg-paper-warm',
      )}
    >
      {children}
    </button>
  );
}

export function FiltersBar({ topics, value, onChange }: Props) {
  const toggle = <K extends keyof FiltersState>(key: K, item: string) => {
    if (key === 'topicId') {
      onChange({ ...value, topicId: value.topicId === item ? null : item });
      return;
    }
    const cur = value[key] as string[];
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold w-20">
          format
        </span>
        {FORMATS.map((f) => (
          <Chip
            key={f}
            active={value.format.includes(f)}
            onClick={() => toggle('format', f)}
          >
            {f.toLowerCase()}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold w-20">
          diff
        </span>
        {DIFFICULTIES.map((d) => (
          <Chip
            key={d}
            active={value.difficulty.includes(d)}
            onClick={() => toggle('difficulty', d)}
          >
            {d.toLowerCase()}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold w-20">
          tracks
        </span>
        {TRACKS.map((t) => (
          <Chip
            key={t}
            active={value.tracks.includes(t)}
            onClick={() => toggle('tracks', t)}
          >
            {t.replace(/_/g, ' ').toLowerCase()}
          </Chip>
        ))}
      </div>
      {topics.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold w-20">
            topic
          </span>
          {topics.map((t) => (
            <Chip
              key={t.id}
              active={value.topicId === t.id}
              onClick={() => toggle('topicId', t.id)}
            >
              {t.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
