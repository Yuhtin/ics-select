'use client';
import type { ReactNode } from 'react';

export function ThermalPaper({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto my-8" style={{ width: 720 }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-3 top-0 flex h-full flex-col justify-between text-ink-faint"
        style={{ writingMode: 'vertical-rl' as const }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i}>·</span>
        ))}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-3 top-0 flex h-full flex-col justify-between text-ink-faint"
        style={{ writingMode: 'vertical-rl' as const }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i}>·</span>
        ))}
      </div>
      <div id="receipt-capture-root" className="bg-surface px-10 py-12 font-mono text-ink">
        {children}
      </div>
    </div>
  );
}
