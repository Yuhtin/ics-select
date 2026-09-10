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
        'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // variant
        variant === 'primary' && 'bg-primary text-primary-fg hover:bg-primary/90 rounded-pill',
        variant === 'ghost' && 'border border-border-token bg-surface text-fg hover:bg-surface-hover rounded-input',
        variant === 'link' && 'rounded-input text-fg underline decoration-1 underline-offset-2 hover:text-primary hover:decoration-2',
        // size
        size === 'sm' && variant !== 'link' && 'px-3 text-xs',
        size === 'md' && variant !== 'link' && 'px-4 text-sm',
        size === 'lg' && variant !== 'link' && 'min-h-12 px-5 text-base',
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
