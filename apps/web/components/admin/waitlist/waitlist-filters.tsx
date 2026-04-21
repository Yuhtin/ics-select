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
    <div className="flex flex-col gap-3 border-t border-rule pt-4">
      <div className="flex flex-wrap gap-2">
        {WAITLIST_COURSES.map((c) => (
          <button
            key={c}
            onClick={() => toggleCourse(c)}
            aria-pressed={value.course === c}
            className={`font-mono text-[11px] uppercase tracking-label px-3 py-1.5 rounded-full border transition-colors ${
              value.course === c
                ? 'bg-ink text-surface border-ink'
                : 'bg-surface text-ink-soft border-rule hover:border-ink-soft'
            }`}
          >
            {courseToLabel(c)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-xs text-ink-soft">
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
            className="w-16 rounded-md border border-rule px-2 py-1 font-mono text-sm bg-surface text-ink"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-soft">
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
            className="w-16 rounded-md border border-rule px-2 py-1 font-mono text-sm bg-surface text-ink"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-soft flex-1 min-w-[200px]">
          <span>Busca</span>
          <input
            type="search"
            placeholder="nome ou email"
            value={value.q ?? ''}
            onChange={(e) => onChange({ ...value, q: e.target.value || undefined, page: 1 })}
            className="flex-1 rounded-md border border-rule px-2 py-1 text-sm bg-surface text-ink"
          />
        </label>
      </div>
    </div>
  );
}
