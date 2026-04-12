'use client';

import { motion } from 'framer-motion';
import { ExternalLink, X as XIcon, Check, HelpCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';
import { getPlatformKey, PLATFORM_BORDER_CLASS, PLATFORM_LABEL } from './platform-colors';
import { FeedbackForm } from './feedback-form';

interface NodeExpandedCardProps {
  planId: string;
  itemId: string;
  title: string;
  description?: string | null;
  estimatedMinutes: number;
  format: string;
  url: string | null;
  status: 'PENDING' | 'DONE';
  completionStatus?: 'DONE' | 'STUCK' | 'DOUBTS' | null;
  feedback?: string | null;
  onClose: () => void;
}

const COMPLETION_DISPLAY: Record<string, { label: string; icon: typeof Check; colorClass: string }> = {
  DONE: { label: 'Consegui', icon: Check, colorClass: 'text-success' },
  STUCK: { label: 'Travei', icon: XIcon, colorClass: 'text-danger' },
  DOUBTS: { label: 'Tive duvidas', icon: HelpCircle, colorClass: 'text-warning' },
};

export function NodeExpandedCard({
  planId, itemId, title, description, estimatedMinutes, format, url,
  status, completionStatus, feedback, onClose,
}: NodeExpandedCardProps) {
  const platform = getPlatformKey(url, format);
  const borderClass = PLATFORM_BORDER_CLASS[platform];
  const label = PLATFORM_LABEL[platform];
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: { completionStatus: string; feedback: string }) =>
      apiFetch(`/plans/${planId}/items/${itemId}/done`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-week'] });
      queryClient.invalidateQueries({ queryKey: ['me-plans'] });
      onClose();
    },
  });

  const display = completionStatus ? COMPLETION_DISPLAY[completionStatus] : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-w-[90vw] bg-surface border-2 ${borderClass} rounded-2xl shadow-xl p-6`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-foreground-muted hover:text-foreground"
          aria-label="Fechar"
        >
          <XIcon className="h-5 w-5" />
        </button>

        <div className="space-y-4">
          <div>
            <span className="text-xs font-medium text-foreground-muted">{label} · ~{estimatedMinutes}min</span>
            <h3 className="text-lg font-bold text-foreground mt-1">{title}</h3>
          </div>

          {description && (
            <p className="text-sm text-foreground-muted">{description}</p>
          )}

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-brand-hover transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir material
            </a>
          )}

          {status === 'PENDING' ? (
            <FeedbackForm
              onSubmit={(s, f) => mutation.mutate({ completionStatus: s, feedback: f })}
              isSubmitting={mutation.isPending}
            />
          ) : display ? (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className={`flex items-center gap-2 ${display.colorClass}`}>
                <display.icon className="h-5 w-5" />
                <span className="font-medium text-sm">{display.label}</span>
              </div>
              {feedback && (
                <p className="text-sm text-foreground-muted italic">&ldquo;{feedback}&rdquo;</p>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </>
  );
}
