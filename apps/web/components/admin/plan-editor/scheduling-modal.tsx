'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Calendar, Check, Loader2, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { WeeklyPlanItem, SchedulingPlacement } from '../../../lib/queries/admin-plan-editor';

export type SchedulingPhase = 'pending' | 'done' | 'overflow';

export interface SchedulingModalProps {
  open: boolean;
  phase: SchedulingPhase;
  /** Items being scheduled in this pass (autoSchedule: all non-skipped; editPublished: only added). */
  items: Pick<WeeklyPlanItem, 'id' | 'libraryItem'>[];
  placements: SchedulingPlacement[];
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  /** Member tz used to format day/time labels. */
  timezone: string;
  /** When done, sessionsFailed > 0 means some Calendar createEvent calls failed. */
  sessionsFailed?: number;
  pendingForce?: boolean;
  onClose: () => void;
  onForce?: () => void;
}

function formatPlacement(scheduledAt: string, timezone: string, minutes: number): string {
  const d = new Date(scheduledAt);
  const day = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(d);
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(d);
  return `${day} · ${time} · ${minutes} min`;
}

export function SchedulingModal({
  open,
  phase,
  items,
  placements,
  overflow,
  timezone,
  sessionsFailed = 0,
  pendingForce = false,
  onClose,
  onForce,
}: SchedulingModalProps) {
  const reduceMotion = useReducedMotion();
  if (!open) return null;

  const placementByItem = new Map(placements.map((p) => [p.itemId, p]));
  const overflowByItem = new Map(overflow.map((o) => [o.itemId, o]));

  const hasOverflow = phase === 'overflow';
  const overflowMinutes = overflow.reduce((s, o) => s + o.minutesRequired, 0);

  const headerEyebrow = (() => {
    if (phase === 'pending') return 'Calculando · Alocando no Google Calendar';
    if (phase === 'overflow') return 'Conflitos detectados';
    return sessionsFailed > 0 ? 'Publicado · com erros no Calendar' : 'Pronto';
  })();

  const headerTitle = (() => {
    if (phase === 'pending') return 'Calculando e alocando…';
    if (phase === 'overflow') return `${overflow.length} item${overflow.length === 1 ? '' : 'ns'} não couberam`;
    return 'Plano publicado';
  })();

  const headerAccentClass = clsx(
    phase === 'overflow' && 'text-outcome-stuck',
    phase === 'done' && sessionsFailed === 0 && 'text-outcome-done-easy',
    phase === 'done' && sessionsFailed > 0 && 'text-outcome-done-hard',
    phase === 'pending' && 'text-fg',
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={phase === 'pending' ? undefined : onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheduling-title"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl rounded-card bg-surface border border-border-token overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-token px-6 py-4">
          <div>
            <p
              className={clsx(
                'font-sans text-xs',
                headerAccentClass,
              )}
            >
              {headerEyebrow}
            </p>
            <h3 id="scheduling-title" className={clsx('mt-1 font-sans text-xl font-semibold', headerAccentClass)}>
              {headerTitle}
            </h3>
            <p className="mt-1 font-sans text-xs text-fg-mute">
              {items.length} item{items.length === 1 ? '' : 's'} · timezone {timezone}
              {hasOverflow && ` · ${overflowMinutes} min sem janela`}
            </p>
          </div>
          {phase !== 'pending' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="grid h-8 w-8 place-items-center rounded-pill text-fg-mute hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="divide-y divide-border-token">
            {items.map((item, index) => {
              const placement = placementByItem.get(item.id);
              const overflowEntry = overflowByItem.get(item.id);
              const state: 'pending' | 'placed' | 'overflow' =
                phase === 'pending'
                  ? 'pending'
                  : overflowEntry
                    ? 'overflow'
                    : placement
                      ? 'placed'
                      : 'pending';
              return (
                <li key={item.id} className="py-2.5 flex items-center gap-3">
                  <span className="font-sans text-xs tabular-nums text-fg-mute w-6 text-right">
                    {index + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm text-fg truncate">
                      {item.libraryItem.title}
                    </p>
                    <SchedulingRowStatus
                      state={state}
                      placementLabel={
                        placement
                          ? formatPlacement(placement.scheduledAt, timezone, placement.durationMinutes)
                          : null
                      }
                      overflowMinutes={overflowEntry?.minutesRequired ?? null}
                      revealDelaySec={index * 0.04}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="border-t border-border-token px-6 py-3 flex items-center justify-between gap-3">
          <div className="font-sans text-xs text-fg-mute">
            {phase === 'pending' && (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                Criando eventos no Google Calendar
              </span>
            )}
            {phase === 'done' && sessionsFailed === 0 && (
              <span className="inline-flex items-center gap-2 text-outcome-done-easy">
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                {placements.length} sessão{placements.length === 1 ? '' : 'ões'} no calendar
              </span>
            )}
            {phase === 'done' && sessionsFailed > 0 && (
              <span className="inline-flex items-center gap-2 text-outcome-done-hard">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
                {sessionsFailed} falha{sessionsFailed === 1 ? '' : 's'} no Calendar
              </span>
            )}
            {phase === 'overflow' && (
              <span className="inline-flex items-center gap-2 text-outcome-stuck">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
                Forçar publicação ignora a disponibilidade declarada
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {phase === 'overflow' && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pendingForce}
                  className="font-sans text-xs px-4 py-2 text-fg-soft hover:bg-bg-subtle rounded-pill disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  Ajustar plano
                </button>
                <button
                  type="button"
                  onClick={onForce}
                  disabled={pendingForce}
                  className="font-sans text-xs px-4 py-2 bg-outcome-stuck text-primary-fg rounded-pill disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  {pendingForce ? 'Forçando…' : 'Forçar publicação'}
                </button>
              </>
            )}
            {phase === 'done' && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 bg-primary text-primary-fg rounded-pill px-4 py-2 font-sans text-xs hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                Concluir
              </button>
            )}
          </div>
        </footer>
      </motion.div>
    </div>
  );
}

function SchedulingRowStatus({
  state,
  placementLabel,
  overflowMinutes,
  revealDelaySec,
}: {
  state: 'pending' | 'placed' | 'overflow';
  placementLabel: string | null;
  overflowMinutes: number | null;
  revealDelaySec: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      {state === 'pending' && (
        <motion.p
          key="pending"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="font-sans text-xs text-fg-mute inline-flex items-center gap-1.5"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-fg-faint animate-pulse" />
          alocando…
        </motion.p>
      )}
      {state === 'placed' && (
        <motion.p
          key="placed"
          initial={reduceMotion ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduceMotion ? 0 : revealDelaySec, duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans text-xs tabular-nums text-outcome-done-easy inline-flex items-center gap-1.5"
        >
          <Calendar className="h-3 w-3" strokeWidth={1.75} />
          {placementLabel}
        </motion.p>
      )}
      {state === 'overflow' && (
        <motion.p
          key="overflow"
          initial={reduceMotion ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduceMotion ? 0 : revealDelaySec, duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans text-xs tabular-nums text-outcome-stuck inline-flex items-center gap-1.5"
        >
          <AlertTriangle className="h-3 w-3" strokeWidth={1.75} />
          Não coube · {overflowMinutes} min faltando
        </motion.p>
      )}
    </AnimatePresence>
  );
}
