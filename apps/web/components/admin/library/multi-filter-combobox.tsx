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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface inline-flex items-center gap-1.5 font-sans text-xs font-medium px-3 py-1.5 rounded-pill border transition-colors',
          value.length > 0
            ? 'bg-bg-subtle border-border-strong text-fg'
            : 'bg-surface border-border-token text-fg-soft hover:bg-bg-subtle',
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
        <div className="absolute z-20 mt-1 w-56 rounded-card border border-border-token bg-surface shadow-sm">
          <ul className="max-h-72 overflow-auto py-1">
            {options.map((opt) => {
              const active = value.includes(opt.value);
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={clsx(
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface flex w-full items-center justify-between px-3 py-1.5 font-sans text-sm text-left',
                      active ? 'bg-primary-soft text-fg' : 'text-fg-soft hover:bg-bg-subtle',
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
            <div className="border-t border-border-token px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface font-sans text-xs font-medium text-fg-mute hover:text-fg"
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
