'use client';

import { clsx } from 'clsx';
import { useId } from 'react';

/**
 * Masked phone input. Accepts any digits the user types; displays them as
 * `+CC (AA) NNNNN-NNNN` (or `NNNN-NNNN` for landlines). The onChange callback
 * receives the E.164 string (`+CCAANNNNNNNNN`) for storage; the visible value
 * is the formatted display string.
 *
 * Kept simple on purpose — a single formatter instead of a full intl library.
 * Works well for BR and similar 2-digit country codes. For other formats the
 * regex in E164 validation at the service level is the safety net.
 */
export function formatPhoneDisplay(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 2) return `+${digits}`;
  const cc = digits.slice(0, 2);
  if (digits.length <= 4) return `+${cc} (${digits.slice(2)}`;
  const area = digits.slice(2, 4);
  const rest = digits.slice(4);
  if (rest.length <= 4) return `+${cc} (${area}) ${rest}`;
  // 9-digit mobile gets 5+4; 8-digit landline gets 4+4.
  const firstLen = rest.length >= 9 ? 5 : 4;
  const first = rest.slice(0, firstLen);
  const second = rest.slice(firstLen, firstLen + 4);
  return `+${cc} (${area}) ${first}${second ? `-${second}` : ''}`;
}

export function toE164(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

interface PhoneInputProps {
  value: string;
  onChange: (e164: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  error?: boolean;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  label,
  placeholder = '+55 (11) 98765-4321',
  autoFocus,
  error,
  className,
}: PhoneInputProps) {
  const id = useId();
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus={autoFocus}
        value={formatPhoneDisplay(value)}
        onChange={(e) => onChange(toE164(e.target.value))}
        placeholder={placeholder}
        className={clsx(
          'w-full rounded-input border bg-surface px-4 py-3 font-sans text-base text-fg transition-colors placeholder:text-fg-faint focus:outline-none focus:ring-2',
          error
            ? 'border-danger focus:border-danger focus:ring-danger/15'
            : value.length === 0
              ? 'border-border-strong focus:border-primary focus:ring-primary/15'
              : 'border-success focus:border-success focus:ring-success/15',
        )}
      />
    </div>
  );
}
