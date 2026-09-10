'use client';

import { useEffect } from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

export interface GuidedChoiceOption<T extends string> { value: T; label: string }
export interface GuidedChoiceProps<T extends string> {
  name: string;
  labelledBy: string;
  options: readonly GuidedChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

export function GuidedChoice<T extends string>({ name, labelledBy, options, value, onChange }: GuidedChoiceProps<T>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('textarea, select, input:not([type="radio"])'))) return;
      if (!/^[a-d]$/i.test(event.key)) return;
      const option = options[event.key.toUpperCase().charCodeAt(0) - 65];
      if (option) { event.preventDefault(); onChange(option.value); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onChange, options]);

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="border-t border-border-token">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <label key={option.value} className="relative grid min-h-14 cursor-pointer grid-cols-[28px_minmax(0,1fr)_16px] items-center gap-3 border-b border-border-token py-3 has-[:focus-visible]:z-10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg">
            <input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="radio" name={name} value={option.value} checked={selected} onChange={() => onChange(option.value)} />
            {index < 4 ? <kbd aria-hidden className={clsx('pointer-events-none grid h-7 w-7 place-items-center rounded-md border font-mono text-xs', selected ? 'border-primary bg-primary text-primary-fg' : 'border-border-strong text-fg-mute')}>{String.fromCharCode(65 + index)}</kbd> : <span aria-hidden className="h-7 w-7" />}
            <span className={clsx('pointer-events-none break-words font-sans text-base', selected ? 'font-semibold text-primary dark:text-primary-fg' : 'text-fg-soft')}>{option.label}</span>
            {selected && <Check aria-hidden className="pointer-events-none h-4 w-4 text-primary dark:text-primary-fg" strokeWidth={1.5} />}
          </label>
        );
      })}
    </div>
  );
}
