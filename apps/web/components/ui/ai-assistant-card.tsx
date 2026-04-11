'use client';

import { ArrowRight, Sparkles } from 'lucide-react';

interface AiAssistantCardProps {
  title: string;
  description: string;
  ctaLabel: string;
  onCtaClick?: () => void;
}

export function AiAssistantCard({
  title,
  description,
  ctaLabel,
  onCtaClick,
}: AiAssistantCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-brand to-brand-hover text-white shadow-brand">
      <div
        className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative">
        <p className="text-xs font-medium opacity-80 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          IA Assistant
        </p>
        <h3 className="text-lg font-bold mt-3 tracking-tight">{title}</h3>
        <p className="text-sm opacity-90 mt-2 leading-relaxed">{description}</p>
        <button
          type="button"
          onClick={onCtaClick}
          className="bg-white text-brand rounded-md px-4 py-2 text-sm font-semibold hover:bg-white/90 mt-5 inline-flex items-center gap-2 transition-colors"
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
