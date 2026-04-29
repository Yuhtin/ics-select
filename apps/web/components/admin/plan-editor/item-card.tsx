'use client';
import { GripVertical, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { WeeklyPlanItem } from '../../../lib/queries/admin-plan-editor';

const OUTCOME_BORDER: Record<WeeklyPlanItem['outcome'], string | null> = {
  PENDING: null,
  DONE_EASY: 'border-2 border-outcome-done-easy',
  DONE_HARD: 'border-2 border-outcome-done-hard',
  DOUBTS: 'border-2 border-outcome-doubts',
  STUCK: 'border-2 border-outcome-stuck',
  SKIPPED: 'border-2 border-outcome-skipped',
};

const OUTCOME_LABEL: Record<WeeklyPlanItem['outcome'], string | null> = {
  PENDING: null,
  DONE_EASY: 'nailed it',
  DONE_HARD: 'got it · hard',
  DOUBTS: 'doubts',
  STUCK: 'stuck',
  SKIPPED: 'skipped',
};

export function ItemCard({
  item,
  order,
  onMoveUp,
  onMoveDown,
  onRemove,
  isCarriedOver,
  topicName,
  canMoveUp,
  canMoveDown,
}: {
  item: WeeklyPlanItem;
  order: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isCarriedOver: boolean;
  topicName: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const outcomeBorder = OUTCOME_BORDER[item.outcome];
  const outcomeLabel = OUTCOME_LABEL[item.outcome];
  const isCompleted = item.outcome !== 'PENDING';

  return (
    <div
      className={clsx(
        'group flex items-start gap-3 rounded-card p-3 transition-colors',
        outcomeBorder
          ? clsx(outcomeBorder, 'bg-surface')
          : isCarriedOver
            ? 'border bg-paper-warm border-accent/40'
            : 'border bg-surface border-rule hover:bg-paper-warm/60',
      )}
    >
      <span className="font-serif-tool text-lg font-semibold text-ink-mute min-w-[1.5ch]">
        {order + 1}
      </span>
      <GripVertical className="h-4 w-4 text-ink-faint mt-1" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="font-serif-tool text-base font-semibold text-ink">
            {item.libraryItem.title}
          </p>
          {isCarriedOver && (
            <span className="inline-block font-mono text-[9px] uppercase tracking-label text-accent px-1.5 py-0.5 border border-accent/40 rounded-pill">
              carried over
            </span>
          )}
          {outcomeLabel && (
            <span
              className={clsx(
                'rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-label',
                item.outcome === 'DONE_EASY' && 'bg-outcome-done-easy/10 text-outcome-done-easy',
                item.outcome === 'DONE_HARD' && 'bg-outcome-done-hard/10 text-outcome-done-hard',
                item.outcome === 'DOUBTS' && 'bg-outcome-doubts/10 text-outcome-doubts',
                item.outcome === 'STUCK' && 'bg-outcome-stuck/10 text-outcome-stuck',
                item.outcome === 'SKIPPED' && 'bg-outcome-skipped/10 text-outcome-skipped',
              )}
            >
              {outcomeLabel}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-mute">
          <span>{item.libraryItem.format}</span>
          {topicName && (
            <>
              <span>·</span>
              <span>{topicName}</span>
            </>
          )}
          <span>·</span>
          <span>{item.libraryItem.estimatedMinutes}m</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="text-ink-mute hover:text-ink disabled:opacity-30"
          aria-label="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="text-ink-mute hover:text-ink disabled:opacity-30"
          aria-label="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={isCompleted}
          title={isCompleted ? 'Item já tem progresso — não dá pra remover' : undefined}
          className="text-ink-mute hover:text-outcome-stuck disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ink-mute"
          aria-label="Remove"
        >
          <X className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
