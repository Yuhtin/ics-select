'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addToast } from '@heroui/react';
import { ExternalLink, Check, HelpCircle, X as XIcon } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';
import type { PlanItem } from '../../../lib/queries/plan';

interface FocusCardProps {
  planId: string;
  item: PlanItem;
  onClose: () => void;
}

const FORMAT_LABEL: Record<string, string> = {
  VIDEO: 'Vídeo',
  ARTICLE: 'Artigo',
  BOOK: 'Livro',
  PROBLEM: 'Problema',
  CODE: 'Código',
  OTHER: 'Material',
};

export function FocusCard({ planId, item, onClose }: FocusCardProps) {
  const qc = useQueryClient();

  const mutate = useMutation({
    mutationFn: (completionStatus: 'DONE' | 'STUCK' | 'DOUBTS') =>
      apiFetch(`/plans/${planId}/items/${item.id}/done`, {
        method: 'POST',
        body: JSON.stringify({ completionStatus, feedback: '' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-week'] });
      qc.invalidateQueries({ queryKey: ['me-plans'] });
      qc.invalidateQueries({ queryKey: ['plan'] });
      addToast({ title: 'Anotado!', color: 'success' });
      onClose();
    },
    onError: (e: Error) => addToast({ title: 'Erro', description: e.message, color: 'danger' }),
  });

  return (
    <div
      className="fixed right-6 top-1/2 -translate-y-1/2 z-40 w-[360px] bg-white rounded-2xl p-5 shadow-2xl"
      role="dialog"
      aria-label="Detalhes do node"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 text-stone-400 hover:text-stone-700 text-xs"
        aria-label="Fechar"
      >
        Esc
      </button>
      <span className="inline-block bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-2.5">
        {FORMAT_LABEL[item.libraryItem.format] ?? 'Material'} · {item.libraryItem.estimatedMinutes}min
      </span>
      <h3 className="text-lg font-bold text-foreground leading-snug">{item.libraryItem.title}</h3>
      {item.libraryItem.description && (
        <p className="text-[13px] text-foreground-secondary mt-2 leading-relaxed">
          {item.libraryItem.description}
        </p>
      )}
      {item.libraryItem.url && (
        <a
          href={item.libraryItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand font-semibold mt-3 hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Abrir material
        </a>
      )}
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => mutate.mutate('DONE')}
          disabled={mutate.isPending}
          className="flex-1 bg-success text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Consegui
        </button>
        <button
          type="button"
          onClick={() => mutate.mutate('STUCK')}
          disabled={mutate.isPending}
          className="flex-1 bg-amber-100 text-amber-800 rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <XIcon className="h-3.5 w-3.5" /> Travei
        </button>
        <button
          type="button"
          onClick={() => mutate.mutate('DOUBTS')}
          disabled={mutate.isPending}
          className="flex-1 bg-red-100 text-red-800 rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <HelpCircle className="h-3.5 w-3.5" /> Dúvidas
        </button>
      </div>
    </div>
  );
}
