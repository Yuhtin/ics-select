'use client';
import { GripVertical, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { WeeklyPlanItem } from '../../../lib/queries/admin-plan-editor';

function formatScheduled(iso: string, minutes: number | null): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return minutes ? `${day} · ${time} · ${minutes}m` : `${day} · ${time}`;
}

const OUTCOME_BORDER: Record<WeeklyPlanItem['outcome'], string | null> = {
  PENDING: null,
  DONE_EASY: 'border border-border-token border-l-[3px] border-l-outcome-done-easy',
  DONE_HARD: 'border border-border-token border-l-[3px] border-l-outcome-done-hard',
  DOUBTS: 'border border-border-token border-l-[3px] border-l-outcome-doubts',
  STUCK: 'border border-border-token border-l-[3px] border-l-outcome-stuck',
  SKIPPED: 'border border-border-token border-l-[3px] border-l-outcome-skipped',
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
      id={`plan-item-${item.libraryItemId}`}
      className={clsx(
        'group flex items-start gap-3 rounded-card p-3 transition-colors',
        outcomeBorder
          ? clsx(outcomeBorder, 'bg-surface')
          : isCarriedOver
            ? 'border bg-bg-subtle border-accent/40'
            : 'border bg-surface border-border-token hover:bg-bg-subtle/60',
      )}
    >
      <span className="font-sans text-lg font-semibold text-fg-mute min-w-[1.5ch]">
        {order + 1}
      </span>
      <GripVertical className="h-4 w-4 text-fg-mute mt-1" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="font-sans text-base font-semibold text-fg">
            {item.libraryItem.title}
          </p>
          {isCarriedOver && (
            <span className="inline-block font-sans text-xs text-accent px-1.5 py-0.5 border border-accent/40 rounded-pill">
              carried over
            </span>
          )}
          {outcomeLabel && (
            <span
              className={clsx(
                'rounded-pill px-2 py-0.5 font-sans text-xs',
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
        <div className="mt-1 flex items-center gap-2 font-sans text-xs text-fg-mute">
          <span>{item.libraryItem.format}</span>
          {topicName && (
            <>
              <span>·</span>
              <span>{topicName}</span>
            </>
          )}
          <span>·</span>
          <span>{item.libraryItem.estimatedMinutes}m</span>
          {item.scheduledAt && (
            <>
              <span>·</span>
              <span className="text-fg-soft">
                {formatScheduled(item.scheduledAt, item.scheduledMinutes)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity font-sans text-xs">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="text-fg-mute hover:text-fg disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          aria-label="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="text-fg-mute hover:text-fg disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          aria-label="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={isCompleted}
          title={isCompleted ? 'Item já tem progresso — não dá pra remover' : undefined}
          className="text-fg-mute hover:text-outcome-stuck disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-fg-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          aria-label="Remove"
        >
          <X className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
