'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  useAdminChallenges,
  useDeleteAdminChallenge,
  type AdminChallengeAttempt,
  type AdminChallengeLanguage,
  type AdminChallengeRating,
} from '../../../lib/queries/admin-challenges';
import { ConfirmDialog } from '../../ui/confirm-dialog';

const LANGUAGE_LABEL: Record<AdminChallengeLanguage, string> = {
  PYTHON: 'Python',
  CPP: 'C++',
};

const RATING_TONE: Record<AdminChallengeRating, string> = {
  EASY: 'text-outcome-done-easy',
  MEDIUM: 'text-ink',
  HARD: 'text-outcome-done-hard',
  ABANDONED: 'text-ink-faint',
};

type TestResult = {
  name: string;
  hidden?: boolean;
  status: 'PASS' | 'FAIL' | 'TIMEOUT' | 'RUNTIME_ERROR' | 'COMPILE_ERROR' | 'SANDBOX_ERROR';
  durationMs: number;
  stdout?: string;
  expected?: string;
  stderr?: string;
};

function asTestResults(json: unknown): TestResult[] {
  if (!Array.isArray(json)) return [];
  return json.filter((c): c is TestResult => Boolean(c && typeof c === 'object' && 'name' in c && 'status' in c));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

type Props = {
  memberId: string;
  cycleId: string | null;
};

export function ChallengesTab({ memberId, cycleId }: Props) {
  const { data, isLoading } = useAdminChallenges(memberId, cycleId);
  const remove = useDeleteAdminChallenge();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminChallengeAttempt | null>(null);

  if (isLoading) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
        Loading challenges…
      </p>
    );
  }

  const attempts = data ?? [];

  if (attempts.length === 0) {
    return (
      <p className="font-mono text-xs text-ink-mute">
        No challenges yet for this member in this cycle.
      </p>
    );
  }

  function confirmRemove() {
    if (!deleteTarget) return;
    remove.mutate(
      { id: deleteTarget.id, userId: memberId },
      { onSettled: () => setDeleteTarget(null) },
    );
  }

  return (
    <div className="space-y-3">
      {attempts.map((a) => {
        const isExpanded = expanded === a.id;
        const finished = Boolean(a.submittedAt);
        const ratingClass = RATING_TONE[a.selfRating];
        const results = asTestResults(a.testResults);
        const passedCount = a.testsPassed ?? 0;
        const totalCount = a.testsTotal ?? 0;

        return (
          <article key={a.id} className="border border-rule rounded-card bg-surface">
            <button
              type="button"
              onClick={() => setExpanded(isExpanded ? null : a.id)}
              className="w-full flex items-start gap-3 p-3 text-left hover:bg-paper-warm/40"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-ink-mute mt-1 shrink-0" strokeWidth={1.5} />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-ink-mute mt-1 shrink-0" strokeWidth={1.5} />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-serif-tool text-sm font-semibold text-ink truncate">
                  {a.libraryItem.title}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-mute tabular-nums flex flex-wrap items-center gap-x-2">
                  <span>{formatDate(a.startedAt)}</span>
                  <span aria-hidden>·</span>
                  <span>{LANGUAGE_LABEL[a.language]}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDuration(a.durationSec)}</span>
                  <span aria-hidden>·</span>
                  <span className={clsx('uppercase tracking-label font-semibold', ratingClass)}>
                    {a.selfRating.toLowerCase()}
                  </span>
                  {totalCount > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span className={clsx('tabular-nums', passedCount === totalCount ? 'text-outcome-done-easy' : 'text-outcome-stuck')}>
                        {passedCount}/{totalCount} tests
                      </span>
                    </>
                  )}
                  {!finished && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="uppercase tracking-label text-focus font-semibold">
                        in progress
                      </span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(a);
                }}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label px-2 py-1 text-ink-soft hover:text-outcome-stuck"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                delete
              </button>
            </button>

            {isExpanded && (
              <div className="border-t border-rule p-3 space-y-4">
                {a.libraryItem.url && (
                  <a
                    href={a.libraryItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-mute hover:text-ink"
                  >
                    Original problem
                    <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                  </a>
                )}

                {a.approachText && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                      Approach
                    </p>
                    <p className="mt-1 font-serif-tool text-sm text-ink whitespace-pre-wrap leading-relaxed">
                      {a.approachText}
                    </p>
                  </div>
                )}

                {a.notes && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                      Notes
                    </p>
                    <p className="mt-1 font-serif-tool text-sm text-ink-soft whitespace-pre-wrap">
                      {a.notes}
                    </p>
                  </div>
                )}

                {results.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute mb-1.5">
                      Tests
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {results.map((r, i) => (
                        <li
                          key={`${r.name}-${i}`}
                          className={clsx(
                            'inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label px-2 py-1 rounded-pill border',
                            r.status === 'PASS'
                              ? 'border-outcome-done-easy/30 text-outcome-done-easy bg-outcome-done-easy/[0.04]'
                              : 'border-outcome-stuck/30 text-outcome-stuck bg-outcome-stuck/[0.04]',
                          )}
                          title={r.status === 'PASS' ? `${r.durationMs}ms` : `${r.status} · ${r.durationMs}ms`}
                        >
                          {r.status === 'PASS' ? (
                            <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
                          ) : r.status === 'TIMEOUT' || r.status === 'SANDBOX_ERROR' ? (
                            <AlertCircle className="w-3 h-3" strokeWidth={1.5} />
                          ) : (
                            <XCircle className="w-3 h-3" strokeWidth={1.5} />
                          )}
                          {r.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {a.finalCode && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute mb-1">
                      Code ({LANGUAGE_LABEL[a.language]})
                    </p>
                    <pre className="font-mono text-[11px] text-ink bg-paper-warm/40 rounded-input p-3 overflow-x-auto whitespace-pre max-h-[400px] overflow-y-auto">
                      {a.finalCode}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => {
          if (!remove.isPending) setDeleteTarget(null);
        }}
        onConfirm={confirmRemove}
        title="Apagar challenge?"
        description="Essa ação não pode ser desfeita."
        confirmLabel="Apagar"
        isLoading={remove.isPending}
      />
    </div>
  );
}
