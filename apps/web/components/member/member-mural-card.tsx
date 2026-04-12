'use client';

import { Trophy } from 'lucide-react';

interface MemberMuralCardProps {
  name: string;
  pictureUrl: string | null;
  done: number;
  total: number;
  percent: number;
  rank: number;
  isCurrentUser: boolean;
}

const RANK_STYLES: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-gray-400',
  3: 'text-amber-700',
};

export function MemberMuralCard({ name, pictureUrl, done, total, percent, rank, isCurrentUser }: MemberMuralCardProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={`bg-surface border-2 rounded-2xl p-5 transition-colors ${
      isCurrentUser ? 'border-brand/40 ring-2 ring-brand/10' : 'border-border'
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-brand-soft flex items-center justify-center text-sm font-bold text-brand overflow-hidden flex-shrink-0">
          {pictureUrl ? (
            <img src={pictureUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate">{name}</p>
          <p className="text-xs text-foreground-muted">{done} de {total} modulos</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {rank <= 3 ? (
            <Trophy className={`h-4 w-4 ${RANK_STYLES[rank]}`} />
          ) : (
            <span className="text-xs font-medium text-foreground-subtle">#{rank}</span>
          )}
        </div>
      </div>

      <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-foreground-muted mt-1.5 text-right">{percent}%</p>
    </div>
  );
}
