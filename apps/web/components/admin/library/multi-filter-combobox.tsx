'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { clsx } from 'clsx';

export interface MultiFilterOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: MultiFilterOption[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function MultiFilterCombobox({ label, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const triggerLabel =
    value.length === 0 ? label : `${label} · ${value.length}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-label px-3 py-1.5 rounded-pill border transition-colors',
          value.length > 0
            ? 'bg-paper-warm border-ink text-ink'
            : 'bg-paper border-rule text-ink-soft hover:bg-paper-warm',
        )}
      >
        {triggerLabel}
        {value.length > 0 ? (
          <X
            className="h-3 w-3"
            strokeWidth={1.5}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          />
        ) : (
          <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 rounded-card border border-rule bg-surface shadow-sm">
          <ul className="max-h-72 overflow-auto py-1">
            {options.map((opt) => {
              const active = value.includes(opt.value);
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={clsx(
                      'flex w-full items-center justify-between px-3 py-1.5 font-sans text-sm text-left',
                      active ? 'bg-focus/5 text-ink' : 'text-ink-soft hover:bg-paper-warm',
                    )}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  </button>
                </li>
              );
            })}
          </ul>
          {value.length > 0 && (
            <div className="border-t border-rule px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="font-mono text-[10px] uppercase tracking-label text-ink-mute hover:text-ink"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
