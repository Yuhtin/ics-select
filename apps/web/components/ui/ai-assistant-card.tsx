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
    <div className="rounded-card border border-border-token bg-surface p-6 text-fg">
      <div>
        <p className="font-sans text-xs font-medium text-fg-mute flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          IA Assistant
        </p>
        <h3 className="font-sans text-lg font-semibold mt-3 tracking-tight">{title}</h3>
        <p className="text-sm text-fg-soft mt-2 leading-relaxed">{description}</p>
        <button
          type="button"
          onClick={onCtaClick}
          className="min-h-11 bg-primary text-primary-fg rounded-pill px-4 py-2 text-sm font-semibold hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg mt-5 inline-flex items-center gap-2 transition-colors"
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
