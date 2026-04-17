'use client';

import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'link';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // variant
        variant === 'primary' && 'bg-ink text-paper hover:bg-ink-soft rounded-pill',
        variant === 'ghost' && 'border border-ink text-ink hover:bg-paper-warm rounded-pill',
        variant === 'link' && 'text-ink underline decoration-1 underline-offset-2 hover:decoration-2',
        // size
        size === 'sm' && variant !== 'link' && 'h-8 px-3 text-xs',
        size === 'md' && variant !== 'link' && 'h-10 px-4 text-sm',
        size === 'lg' && variant !== 'link' && 'h-11 px-5 text-base',
        size === 'sm' && variant === 'link' && 'text-xs',
        size === 'md' && variant === 'link' && 'text-sm',
        size === 'lg' && variant === 'link' && 'text-base',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
