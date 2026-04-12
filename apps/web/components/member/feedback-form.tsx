'use client';

import { useState } from 'react';
import { Check, HelpCircle, X } from 'lucide-react';

type CompletionStatus = 'DONE' | 'STUCK' | 'DOUBTS';

interface FeedbackFormProps {
  onSubmit: (status: CompletionStatus, feedback: string) => void;
  isSubmitting: boolean;
}

const STATUS_OPTIONS: Array<{
  value: CompletionStatus;
  label: string;
  icon: typeof Check;
  colorClass: string;
}> = [
  { value: 'DONE', label: 'Consegui', icon: Check, colorClass: 'bg-success/10 border-success text-success hover:bg-success/20' },
  { value: 'STUCK', label: 'Travei', icon: X, colorClass: 'bg-danger/10 border-danger text-danger hover:bg-danger/20' },
  { value: 'DOUBTS', label: 'Tive duvidas', icon: HelpCircle, colorClass: 'bg-warning/10 border-warning text-warning hover:bg-warning/20' },
];

export function FeedbackForm({ onSubmit, isSubmitting }: FeedbackFormProps) {
  const [selected, setSelected] = useState<CompletionStatus | null>(null);
  const [feedback, setFeedback] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {STATUS_OPTIONS.map(({ value, label, icon: Icon, colorClass }) => (
          <button
            key={value}
            type="button"
            onClick={() => setSelected(value)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
              selected === value ? colorClass : 'border-border text-foreground-muted hover:border-border-strong'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Deixe um feedback sobre este estudo..."
        rows={3}
        className="w-full rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none"
      />
      <button
        type="button"
        disabled={!selected || isSubmitting}
        onClick={() => selected && onSubmit(selected, feedback)}
        className="w-full bg-brand text-white rounded-xl py-2.5 text-sm font-bold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Enviando...' : 'Enviar'}
      </button>
    </div>
  );
}
