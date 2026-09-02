'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Lock, Unlock, ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import {
  useCohortChallengesOnItem,
  useMyChallengesOnItem,
  useStartChallenge,
  type ChallengeAttempt,
  type ChallengeLanguage,
  type CohortAttempt,
} from '../../lib/queries/me-challenges';
import { Eyebrow } from '../ui/eyebrow';

const LANGUAGE_LABEL: Record<ChallengeLanguage, string> = {
  PYTHON: 'Python',
  CPP: 'C++',
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}min`;
  return `${m}min ${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props {
  libraryItemId: string;
}

export function ChallengeEntry({ libraryItemId }: Props) {
  const router = useRouter();
  const start = useStartChallenge();
  const { data: own } = useMyChallengesOnItem(libraryItemId);
  const { data: cohort } = useCohortChallengesOnItem(libraryItemId);
  const [language, setLanguage] = useState<ChallengeLanguage>('PYTHON');
  const [cohortOpen, setCohortOpen] = useState(false);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);

  async function handleStart() {
    const result = await start.mutateAsync({ libraryItemId, language });
    router.push(`/me/challenge/${result.attemptId}`);
  }

  const ownList = own ?? [];
  const finished = ownList.filter((a) => a.submittedAt && a.selfRating !== 'ABANDONED');
  const inProgress = ownList.find((a) => !a.submittedAt);

  const cohortUnlocked = cohort?.unlocked === true;
  const cohortCount = cohort?.count ?? 0;
  const cohortList: CohortAttempt[] = cohortUnlocked && cohort ? cohort.attempts : [];

  return (
    <section className="space-y-5">
      <div className="rounded-card border border-rule bg-paper-warm/30 p-5">
        <Eyebrow>Challenge mode</Eyebrow>
        <p className="mt-2 font-sans text-sm text-ink-soft">
          Solve it inside the platform with a timer running. You'll write an approach in text,
          run your code against test cases, and submit when ready.
        </p>

        {inProgress ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-focus/30 bg-focus/[0.04] p-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-label text-focus">In progress</p>
              <p className="mt-0.5 font-mono text-xs text-ink-soft">
                {LANGUAGE_LABEL[inProgress.language]} · started {formatDate(inProgress.startedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/me/challenge/${inProgress.id}`)}
              className="font-mono text-xs uppercase tracking-label px-3 py-1.5 bg-focus text-paper rounded-pill"
            >
              Resume
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-pill bg-surface border border-rule p-1">
              {(['PYTHON', 'CPP'] as ChallengeLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={
                    language === lang
                      ? 'px-3 py-1 rounded-pill bg-ink text-paper font-mono text-[11px]'
                      : 'px-3 py-1 rounded-pill text-ink-mute hover:text-ink font-mono text-[11px]'
                  }
                >
                  {LANGUAGE_LABEL[lang]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={start.isPending}
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
            >
              <Play className="w-3 h-3" strokeWidth={2} />
              {start.isPending ? 'Starting…' : 'Start challenge'}
            </button>
          </div>
        )}
        {start.error && (
          <p className="mt-2 font-mono text-[11px] text-outcome-stuck">
            {(start.error as Error).message}
          </p>
        )}
      </div>

      {ownList.length > 0 && (
        <section>
          <Eyebrow>Your attempts ({ownList.length})</Eyebrow>
          <ul className="mt-2 space-y-1.5">
            {ownList.map((a) => (
              <OwnAttemptRow key={a.id} attempt={a} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <button
          type="button"
          onClick={() => setCohortOpen((v) => !v)}
          disabled={!cohortUnlocked && cohortCount === 0}
          className="w-full flex items-center gap-2 text-left"
        >
          {cohortOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-ink-mute" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-ink-mute" strokeWidth={1.5} />
          )}
          <Eyebrow>
            Cohort attempts ({cohortCount})
          </Eyebrow>
          {cohortUnlocked ? (
            <Unlock className="w-3 h-3 text-outcome-done-easy ml-auto" strokeWidth={1.5} />
          ) : (
            <Lock className="w-3 h-3 text-ink-faint ml-auto" strokeWidth={1.5} />
          )}
        </button>

        {!cohortUnlocked && (
          <p className="mt-2 font-mono text-[11px] text-ink-mute italic">
            {cohortCount === 0
              ? 'No one has tried this yet.'
              : 'Submit your own attempt to see how others tackled this.'}
          </p>
        )}

        {cohortOpen && cohortUnlocked && (
          <ul className="mt-3 space-y-2">
            {cohortList.map((a) => {
              const expanded = expandedAttempt === a.id;
              return (
                <li key={a.id} className="border border-rule rounded-card bg-surface">
                  <button
                    type="button"
                    onClick={() => setExpandedAttempt(expanded ? null : a.id)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    {a.user.pictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.user.pictureUrl} alt="" className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-paper-warm border border-rule" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-sm text-ink truncate">{a.user.name}</p>
                      <p className="font-mono text-[10px] text-ink-mute">
                        {LANGUAGE_LABEL[a.language]} · {formatDuration(a.durationSec)} ·
                        {' '}
                        {a.selfRating.toLowerCase()}
                        {a.testsTotal !== null && (
                          <> · {a.testsPassed ?? 0}/{a.testsTotal} tests</>
                        )}
                      </p>
                    </div>
                    {expanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-ink-mute" strokeWidth={1.5} />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-ink-mute" strokeWidth={1.5} />
                    )}
                  </button>
                  {expanded && (
                    <div className="border-t border-rule p-3 space-y-3">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                          Approach
                        </p>
                        <p className="mt-1 font-serif-tool text-sm text-ink whitespace-pre-wrap">
                          {a.approachText}
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                          Code
                        </p>
                        <pre className="mt-1 font-mono text-[11px] text-ink bg-paper-warm/40 p-3 rounded-input overflow-x-auto whitespace-pre">
                          {a.finalCode}
                        </pre>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

function OwnAttemptRow({ attempt }: { attempt: ChallengeAttempt }) {
  const ratingClass =
    attempt.selfRating === 'EASY' ? 'text-outcome-done-easy'
      : attempt.selfRating === 'HARD' ? 'text-outcome-done-hard'
      : attempt.selfRating === 'ABANDONED' ? 'text-ink-faint'
      : 'text-ink';
  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-card border border-rule bg-surface font-mono text-[11px]">
      <span className="text-ink-mute tabular-nums">{formatDate(attempt.startedAt)}</span>
      <span className="text-ink-mute">·</span>
      <span className="text-ink-soft">{LANGUAGE_LABEL[attempt.language]}</span>
      <span className="text-ink-mute">·</span>
      <span className="text-ink tabular-nums">{formatDuration(attempt.durationSec)}</span>
      {attempt.submittedAt ? (
        <>
          <span className="text-ink-mute">·</span>
          <span className={clsx('uppercase tracking-label font-semibold', ratingClass)}>
            {attempt.selfRating.toLowerCase()}
          </span>
          {attempt.testsTotal !== null && (
            <>
              <span className="text-ink-mute">·</span>
              <span className="text-ink-soft tabular-nums">
                {attempt.testsPassed ?? 0}/{attempt.testsTotal} tests
              </span>
            </>
          )}
        </>
      ) : (
        <>
          <span className="text-ink-mute">·</span>
          <span className="text-focus uppercase tracking-label font-semibold">in progress</span>
        </>
      )}
    </li>
  );
}
