'use client';
import type { ReactNode } from 'react';

export type WrappedGradient =
  | 'cover'
  | 'hours'
  | 'topic'
  | 'mover'
  | 'grid'
  | 'fame'
  | 'close';

const gradients: Record<WrappedGradient, string> = {
  cover: 'bg-primary',
  hours: 'bg-fg',
  topic: 'bg-primary',
  mover: 'bg-fg',
  grid: 'bg-fg',
  fame: 'bg-primary',
  close: 'bg-surface',
};

const inkClasses: Record<WrappedGradient, string> = {
  cover: 'text-primary-fg',
  hours: 'text-primary-fg',
  topic: 'text-primary-fg',
  mover: 'text-primary-fg',
  grid: 'text-primary-fg',
  fame: 'text-primary-fg',
  close: 'text-fg',
};

export function WrappedBlock({
  gradient,
  children,
}: {
  gradient: WrappedGradient;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-h-[100dvh] flex-col items-center justify-center px-8 py-16 ${gradients[gradient]} ${inkClasses[gradient]} print:bg-surface print:text-fg print:[&_table_*]:!text-fg print:[&_table_*]:!border-border-token`}
    >
      <div className="w-full max-w-2xl text-center">{children}</div>
    </section>
  );
}
