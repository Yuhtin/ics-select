'use client';

import { WAITLIST_COURSES, courseToLabel, type WaitlistCourse } from '../../../lib/waitlist/course';
import type { WaitlistFilters } from '../../../lib/waitlist/api';

type Props = {
  value: WaitlistFilters;
  onChange: (next: WaitlistFilters) => void;
};

export function WaitlistFilters({ value, onChange }: Props) {
  const toggleCourse = (c: WaitlistCourse) => {
    onChange({ ...value, course: value.course === c ? undefined : c, page: 1 });
  };
  return (
    <div className="flex flex-col gap-3 border-t border-border-token pt-4">
      <div className="flex flex-wrap gap-2">
        {WAITLIST_COURSES.map((c) => (
          <button
            key={c}
            onClick={() => toggleCourse(c)}
            aria-pressed={value.course === c}
            className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface font-sans text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              value.course === c
                ? 'bg-primary text-primary-fg border-primary'
                : 'bg-surface text-fg-soft border-border-token hover:border-border-strong-soft'
            }`}
          >
            {courseToLabel(c)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-xs text-fg-soft">
          <span>Skill min</span>
          <input
            type="number" min={1} max={5}
            value={value.skillMin ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              const parsed = raw === '' ? undefined : Number(raw);
              onChange({
                ...value,
                skillMin: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
                page: 1,
              });
            }}
            className="w-16 rounded-input border border-border-token px-2 py-1 font-mono text-sm bg-surface text-fg"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-fg-soft">
          <span>Skill max</span>
          <input
            type="number" min={1} max={5}
            value={value.skillMax ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              const parsed = raw === '' ? undefined : Number(raw);
              onChange({
                ...value,
                skillMax: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
                page: 1,
              });
            }}
            className="w-16 rounded-input border border-border-token px-2 py-1 font-mono text-sm bg-surface text-fg"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-fg-soft flex-1 min-w-[200px]">
          <span>Busca</span>
          <input
            type="search"
            placeholder="nome ou email"
            value={value.q ?? ''}
            onChange={(e) => onChange({ ...value, q: e.target.value || undefined, page: 1 })}
            className="flex-1 rounded-input border border-border-token px-2 py-1 text-sm bg-surface text-fg"
          />
        </label>
      </div>
    </div>
  );
}
