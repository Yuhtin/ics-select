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
  cover: 'bg-gradient-to-br from-[#4C1D95] to-[#1E1B4B]',
  hours: 'bg-gradient-to-br from-[#C45D3A] to-[#9A1F47]',
  topic: 'bg-gradient-to-br from-[#3730A3] to-[#0F172A]',
  mover: 'bg-gradient-to-br from-[#D97706] to-[#92400E]',
  grid: 'bg-gradient-to-br from-[#1F2937] to-[#0B0F1A]',
  fame: 'bg-gradient-to-br from-[#F59E0B] to-[#C2410C]',
  close: 'bg-gradient-to-br from-[#FEF3C7] to-[#FAFAF7]',
};

const inkClasses: Record<WrappedGradient, string> = {
  cover: 'text-white',
  hours: 'text-white',
  topic: 'text-white',
  mover: 'text-white',
  grid: 'text-white',
  fame: 'text-white',
  close: 'text-ink',
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
      className={`flex min-h-screen flex-col items-center justify-center px-8 py-16 ${gradients[gradient]} ${inkClasses[gradient]}`}
    >
      <div className="max-w-2xl text-center">{children}</div>
    </section>
  );
}
