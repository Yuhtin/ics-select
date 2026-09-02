'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { clsx } from 'clsx';
import { AlertTriangle, Play, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useAbandonChallenge,
  useAutoSaveCode,
  useRunChallenge,
  useSubmitChallenge,
  type ChallengeAttemptDetail,
  type ChallengeLanguage,
  type SandboxRunResult,
} from '../../lib/queries/me-challenges';

const AUTOSAVE_INTERVAL_MS = 10_000;
const APPROACH_MIN_CHARS = 20;

const RATINGS = [
  { value: 'EASY' as const, label: 'Easy', help: 'Cleared it without much struggle' },
  { value: 'MEDIUM' as const, label: 'Medium', help: 'Got it, but had to think' },
  { value: 'HARD' as const, label: 'Hard', help: 'Stuck for a while or barely made it' },
];

const LANGUAGE_LABEL: Record<ChallengeLanguage, string> = {
  PYTHON: 'Python 3.12',
  CPP: 'C++ 17',
};

function localStorageKey(attemptId: string): string {
  return `ics:challenge:${attemptId}:code`;
}

function formatTimer(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type Props = { attempt: ChallengeAttemptDetail };

export function ChallengeEditor({ attempt }: Props) {
  const router = useRouter();
  const isFinished = attempt.submittedAt !== null;

  const [language, setLanguage] = useState<ChallengeLanguage>(attempt.language);
  const [code, setCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = window.localStorage.getItem(localStorageKey(attempt.id));
      if (cached && cached.length > 0) return cached;
    }
    return attempt.finalCode;
  });
  const [stdin, setStdin] = useState('');
  const [approach, setApproach] = useState(attempt.approachText);
  const [selfRating, setSelfRating] = useState<'EASY' | 'MEDIUM' | 'HARD' | null>(
    attempt.selfRating === 'ABANDONED' ? null : (attempt.selfRating as 'EASY' | 'MEDIUM' | 'HARD'),
  );
  const [notes, setNotes] = useState(attempt.notes ?? '');
  const [runResult, setRunResult] = useState<SandboxRunResult | null>(null);
  const [staleError, setStaleError] = useState<string | null>(null);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  const startedAtMs = useMemo(() => new Date(attempt.startedAt).getTime(), [attempt.startedAt]);
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - startedAtMs);

  const runMutation = useRunChallenge();
  const submitMutation = useSubmitChallenge();
  const abandonMutation = useAbandonChallenge();
  const autoSave = useAutoSaveCode();

  // Tick the timer once per second. Stop ticking when the attempt is finished.
  useEffect(() => {
    if (isFinished) return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAtMs), 1000);
    return () => window.clearInterval(id);
  }, [isFinished, startedAtMs]);

  // localStorage mirror: instant durable persistence so a refresh keeps
  // the code. The 10s server flush below catches device switches.
  useEffect(() => {
    if (isFinished) return;
    try {
      window.localStorage.setItem(localStorageKey(attempt.id), code);
    } catch {
      // Storage quota or private mode — fall back to memory only.
    }
  }, [attempt.id, code, isFinished]);

  // 10s server autosave. Skips when the last save matches the current code
  // so we don't make pointless round-trips while the member is idle.
  const lastSavedRef = useRef<string>(attempt.finalCode);
  const lastSavedLangRef = useRef<ChallengeLanguage>(attempt.language);
  useEffect(() => {
    if (isFinished) return;
    const id = window.setInterval(() => {
      if (code === lastSavedRef.current && language === lastSavedLangRef.current) return;
      autoSave.mutate(
        { attemptId: attempt.id, language, code },
        {
          onSuccess: () => {
            lastSavedRef.current = code;
            lastSavedLangRef.current = language;
          },
        },
      );
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [attempt.id, autoSave, code, isFinished, language]);

  const supportedLanguages = attempt.libraryItem.testCasesLanguages.length > 0
    ? attempt.libraryItem.testCasesLanguages
    : (['PYTHON', 'CPP'] as ChallengeLanguage[]);

  function handleLanguageSwitch(next: ChallengeLanguage) {
    if (next === language) return;
    // Heuristic: if the editor still holds the starter (short code), swap
    // freely. If the member already typed real code, ask before resetting.
    const looksLikeStarter = code.trim().length < 200;
    if (!looksLikeStarter) {
      const confirmed = window.confirm(
        'Switching language will reset the editor. Continue?',
      );
      if (!confirmed) return;
    }
    setLanguage(next);
    setCode('');
    setRunResult(null);
  }

  async function handleRun() {
    setRunResult(null);
    try {
      const result = await runMutation.mutateAsync({
        attemptId: attempt.id,
        language,
        code,
        stdin,
      });
      setRunResult(result);
    } catch (err) {
      setRunResult({
        status: 'SANDBOX_ERROR',
        exitCode: null,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      });
    }
  }

  const approachLength = approach.trim().length;
  const approachShort = approachLength < APPROACH_MIN_CHARS;
  const canSubmit =
    !isFinished &&
    !approachShort &&
    selfRating !== null &&
    !submitMutation.isPending;

  async function handleSubmit() {
    if (!canSubmit || !selfRating) return;
    setStaleError(null);
    try {
      await submitMutation.mutateAsync({
        attemptId: attempt.id,
        libraryItemId: attempt.libraryItem.id,
        language,
        code,
        approachText: approach,
        selfRating,
        notes: notes.trim() || undefined,
      });
      try {
        window.localStorage.removeItem(localStorageKey(attempt.id));
      } catch {
        /* ignore */
      }
      router.push(`/me/item/${attempt.libraryItem.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      if (/stale/i.test(message) || /CHALLENGE_STALE/.test(message)) {
        setStaleError(
          'This attempt has been open for over 4 hours, so it was auto-abandoned. Start a fresh challenge.',
        );
      } else {
        setStaleError(message);
      }
    }
  }

  async function handleAbandon() {
    if (isFinished) return;
    const confirmed = window.confirm(
      'Mark this attempt as abandoned? Your code stays saved but the attempt closes.',
    );
    if (!confirmed) return;
    await abandonMutation.mutateAsync({
      attemptId: attempt.id,
      libraryItemId: attempt.libraryItem.id,
    });
    try {
      window.localStorage.removeItem(localStorageKey(attempt.id));
    } catch {
      /* ignore */
    }
    router.push(`/me/item/${attempt.libraryItem.id}`);
  }

  const langExtension = useMemo(() => (language === 'PYTHON' ? python() : cpp()), [language]);
  const testCases = attempt.libraryItem.testCases ?? [];
  const hasGradedTests =
    testCases.length > 0 && supportedLanguages.includes(language);

  return (
    <div className="flex flex-col min-h-screen bg-paper">
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2.5 max-w-[1400px] mx-auto">
          <button
            type="button"
            onClick={() => router.push(`/me/item/${attempt.libraryItem.id}`)}
            className="font-mono text-xs uppercase tracking-label text-ink-mute hover:text-ink"
          >
            ◀ Back
          </button>
          <h1 className="font-serif text-lg font-semibold text-ink truncate">
            {attempt.libraryItem.title}
          </h1>
          {attempt.libraryItem.url && (
            <a
              href={attempt.libraryItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-label text-ink-mute hover:text-ink"
            >
              open original ↗
            </a>
          )}
          <div className="ml-auto flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => handleLanguageSwitch(e.target.value as ChallengeLanguage)}
              disabled={isFinished}
              className="font-mono text-xs rounded-input border border-rule bg-surface px-2 py-1"
            >
              {(['PYTHON', 'CPP'] as ChallengeLanguage[]).map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABEL[l]}
                </option>
              ))}
            </select>
            <div
              className={clsx(
                'font-mono text-lg tabular-nums px-3 py-1 rounded-input border',
                isFinished
                  ? 'border-rule text-ink-mute'
                  : 'border-ink/30 text-ink bg-paper-warm/60',
              )}
              aria-label="elapsed time"
            >
              {formatTimer(elapsedMs)}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <section className="space-y-3 min-w-0">
          <div className="border border-rule rounded-card overflow-hidden">
            <CodeMirror
              value={code}
              onChange={(v) => setCode(v)}
              extensions={[langExtension]}
              height="500px"
              theme="light"
              editable={!isFinished}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                autocompletion: false,
                indentOnInput: true,
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute mb-1">
                Stdin (for Run)
              </p>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="3&#10;1 2 3"
                rows={5}
                className="w-full rounded-input border border-rule bg-surface p-2 font-mono text-xs resize-y"
                disabled={isFinished}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                  Output
                </p>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={runMutation.isPending || isFinished}
                  className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-label px-3 py-1 bg-ink text-paper rounded-pill disabled:opacity-40"
                >
                  <Play className="w-3 h-3" strokeWidth={2} />
                  {runMutation.isPending ? 'Running…' : 'Run'}
                </button>
              </div>
              <pre
                className={clsx(
                  'rounded-input border bg-surface p-2 font-mono text-xs whitespace-pre-wrap break-words min-h-[110px] max-h-[200px] overflow-y-auto',
                  runResult && runResult.status !== 'OK'
                    ? 'border-outcome-stuck/40 text-outcome-stuck'
                    : 'border-rule text-ink',
                )}
              >
                {runResult
                  ? runResult.status === 'OK'
                    ? runResult.stdout || '(no output)'
                    : `[${runResult.status}]\n${runResult.stderr || runResult.stdout || ''}`
                  : '— Click Run to test against your stdin —'}
              </pre>
            </div>
          </div>
        </section>

        <aside className="space-y-4 min-w-0">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute mb-1">
              Approach{approachShort && <span className="text-outcome-stuck"> · min {APPROACH_MIN_CHARS} chars</span>}
            </p>
            <textarea
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              placeholder="Describe your plan before coding it. What's the data structure? What's the complexity? Why this approach?"
              rows={6}
              className="w-full rounded-input border border-rule bg-surface p-3 font-sans text-sm resize-y"
              disabled={isFinished}
            />
            <p className="mt-1 font-mono text-[10px] text-ink-faint tabular-nums">
              {approachLength} chars
            </p>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute mb-2">
              Test cases ({testCases.length})
              {!hasGradedTests && testCases.length > 0 && (
                <span className="text-ink-faint"> · not graded for {LANGUAGE_LABEL[language]}</span>
              )}
            </p>
            {testCases.length === 0 ? (
              <p className="font-mono text-[10px] text-ink-faint italic">
                No graded tests on this item. Submission will record without scoring.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {testCases.map((tc) => {
                  const expanded = expandedCases.has(tc.name);
                  return (
                    <li key={tc.name} className="border border-rule rounded-card bg-surface">
                      <button
                        type="button"
                        onClick={() => {
                          if (tc.hidden) return;
                          setExpandedCases((s) => {
                            const copy = new Set(s);
                            if (copy.has(tc.name)) copy.delete(tc.name);
                            else copy.add(tc.name);
                            return copy;
                          });
                        }}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left"
                      >
                        {tc.hidden ? (
                          <span className="font-mono text-[10px] text-ink-faint">hidden</span>
                        ) : expanded ? (
                          <ChevronDown className="w-3 h-3 text-ink-mute" strokeWidth={1.5} />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-ink-mute" strokeWidth={1.5} />
                        )}
                        <span className="font-mono text-[11px] text-ink-soft">{tc.name}</span>
                      </button>
                      {!tc.hidden && expanded && (
                        <div className="border-t border-rule px-2 py-2 grid grid-cols-2 gap-2">
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-label text-ink-faint">
                              stdin
                            </p>
                            <pre className="font-mono text-[11px] text-ink whitespace-pre-wrap break-words">
                              {tc.stdin || '(empty)'}
                            </pre>
                          </div>
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-label text-ink-faint">
                              expected
                            </p>
                            <pre className="font-mono text-[11px] text-ink whitespace-pre-wrap break-words">
                              {tc.expectedStdout || '(empty)'}
                            </pre>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute mb-2">
              How was it?
            </p>
            <div className="flex flex-wrap gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setSelfRating(r.value)}
                  disabled={isFinished}
                  title={r.help}
                  className={
                    selfRating === r.value
                      ? 'px-3 py-1.5 rounded-pill bg-ink text-paper font-mono text-xs'
                      : 'px-3 py-1.5 rounded-pill bg-surface text-ink-soft border border-rule font-mono text-xs hover:bg-paper-warm'
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute mb-1">
              Notes (optional)
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What got you, where it clicked, what to revisit…"
              rows={3}
              className="w-full rounded-input border border-rule bg-surface p-3 font-sans text-sm resize-y"
              disabled={isFinished}
            />
          </div>

          {staleError && (
            <div className="flex items-start gap-2 rounded-card border border-outcome-stuck/40 bg-outcome-stuck/[0.04] p-3">
              <AlertTriangle className="w-4 h-4 text-outcome-stuck shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="font-mono text-[11px] text-outcome-stuck">{staleError}</p>
            </div>
          )}

          {!isFinished && (
            <div className="flex justify-between gap-3 pt-2 border-t border-rule">
              <button
                type="button"
                onClick={handleAbandon}
                disabled={abandonMutation.isPending}
                className="font-mono text-xs uppercase tracking-label px-3 py-2 text-ink-soft hover:bg-paper-warm rounded-pill"
              >
                {abandonMutation.isPending ? 'Saving…' : 'I gave up'}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
              >
                {submitMutation.isPending ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
