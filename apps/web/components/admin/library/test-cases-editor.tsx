'use client';
import { useEffect, useState } from 'react';
import { Trash2, Plus, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import {
  useSetTestCases,
  type AdminLibraryItem,
  type AdminLibraryTestCase,
  type ChallengeLanguage,
} from '../../../lib/queries/admin-library';

const INPUT_CLASS =
  'w-full rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40';
const MONO_CLASS =
  'w-full rounded-input border border-rule bg-paper p-3 font-mono text-xs leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-focus/40';

const LANGUAGE_LABEL: Record<ChallengeLanguage, string> = {
  PYTHON: 'Python 3.12',
  CPP: 'C++ 17',
};

type DraftCase = AdminLibraryTestCase & { _expanded?: boolean };

function makeEmptyCase(idx: number): DraftCase {
  return {
    name: `case-${idx + 1}`,
    stdin: '',
    expectedStdout: '',
    hidden: false,
    _expanded: true,
  };
}

interface TestCasesEditorProps {
  item: AdminLibraryItem;
}

/**
 * Inline editor for the Challenge Mode test cases on a PROBLEM library
 * item. Shown only when the parent item-form modal is editing an item
 * with `format === 'PROBLEM'` — the controller rejects test cases on
 * other formats and we don't want the UI to silently accept and lose
 * data.
 *
 * Saves independently from the main item-edit save: the admin can change
 * test cases without touching title/topic/etc and vice versa. Two save
 * paths surfaced as separate buttons keeps the responsibility crisp.
 */
export function TestCasesEditor({ item }: TestCasesEditorProps) {
  const setTestCases = useSetTestCases();
  const [open, setOpen] = useState((item.testCases?.length ?? 0) > 0);
  const [languages, setLanguages] = useState<ChallengeLanguage[]>(
    item.testCasesLanguages ?? ['PYTHON'],
  );
  const [cases, setCases] = useState<DraftCase[]>(
    () => (item.testCases ?? []).map((c) => ({ ...c, _expanded: false })),
  );

  // Reset local draft whenever the parent item changes (e.g. modal closed
  // and reopened on a different item). Otherwise edits leak across items.
  useEffect(() => {
    setLanguages(item.testCasesLanguages ?? ['PYTHON']);
    setCases((item.testCases ?? []).map((c) => ({ ...c, _expanded: false })));
    setOpen((item.testCases?.length ?? 0) > 0);
  }, [item.id, item.testCases, item.testCasesLanguages]);

  function toggleLanguage(lang: ChallengeLanguage) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  function addCase() {
    setCases((prev) => [...prev, makeEmptyCase(prev.length)]);
  }

  function removeCase(idx: number) {
    setCases((prev) => prev.filter((_, i) => i !== idx));
  }

  function patchCase(idx: number, patch: Partial<DraftCase>) {
    setCases((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  // Up-front client validation so the API doesn't have to reject. Mirrors
  // TestCaseSchema in the backend.
  const validationErrors: string[] = [];
  if (languages.length === 0 && cases.length > 0) {
    validationErrors.push('Pick at least one language when there are test cases.');
  }
  for (const [i, c] of cases.entries()) {
    if (c.name.trim().length === 0) validationErrors.push(`Case ${i + 1}: name is required.`);
    if (c.name.length > 60) validationErrors.push(`Case ${i + 1}: name exceeds 60 chars.`);
    if (c.stdin.length > 8192) validationErrors.push(`Case ${i + 1}: stdin exceeds 8KB.`);
    if (c.expectedStdout.length > 8192) validationErrors.push(`Case ${i + 1}: expected stdout exceeds 8KB.`);
  }
  if (cases.length > 30) validationErrors.push('Maximum 30 test cases per item.');

  const canSave = validationErrors.length === 0 && !setTestCases.isPending;

  async function handleSave() {
    if (!canSave) return;
    const payload = cases.map(({ _expanded: _drop, ...c }) => ({
      name: c.name.trim(),
      stdin: c.stdin,
      expectedStdout: c.expectedStdout,
      hidden: c.hidden ?? false,
    }));
    await setTestCases.mutateAsync({
      id: item.id,
      testCases: payload,
      testCasesLanguages: languages,
    });
  }

  return (
    <section className="mt-4 rounded-card border border-rule bg-paper-warm/30 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-ink-mute" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-ink-mute" strokeWidth={1.5} />
        )}
        <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute font-semibold">
          Challenge mode test cases
        </span>
        <span className="ml-auto font-mono text-[10px] text-ink-faint tabular-nums">
          {cases.length} case{cases.length === 1 ? '' : 's'}
          {languages.length > 0 && ` · ${languages.length} lang`}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute mb-2">
              Languages
            </p>
            <div className="flex gap-2">
              {(['PYTHON', 'CPP'] as ChallengeLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={
                    languages.includes(lang)
                      ? 'font-mono text-[11px] px-3 py-1.5 rounded-pill bg-ink text-paper border border-ink'
                      : 'font-mono text-[11px] px-3 py-1.5 rounded-pill bg-paper text-ink-soft border border-rule hover:bg-rule'
                  }
                >
                  {LANGUAGE_LABEL[lang]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-ink-faint">
              Members can only pick a language with test cases here.
            </p>
          </div>

          {cases.length === 0 ? (
            <p className="font-mono text-[11px] text-ink-mute italic">
              No test cases yet. Members can still use Run + stdout, but submits won't grade.
            </p>
          ) : (
            <ol className="space-y-3">
              {cases.map((c, idx) => (
                <li key={idx} className="rounded-card border border-rule bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={c.name}
                      onChange={(e) => patchCase(idx, { name: e.target.value })}
                      className="flex-1 rounded-input border border-rule bg-paper px-2 py-1 font-mono text-xs"
                      placeholder="case name"
                    />
                    <button
                      type="button"
                      title={c.hidden ? 'Hidden from member' : 'Visible to member'}
                      onClick={() => patchCase(idx, { hidden: !c.hidden })}
                      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label px-2 py-1 rounded-pill border border-rule text-ink-soft hover:bg-paper-warm"
                    >
                      {c.hidden ? (
                        <EyeOff className="w-3 h-3" strokeWidth={1.5} />
                      ) : (
                        <Eye className="w-3 h-3" strokeWidth={1.5} />
                      )}
                      {c.hidden ? 'hidden' : 'visible'}
                    </button>
                    <button
                      type="button"
                      onClick={() => patchCase(idx, { _expanded: !c._expanded })}
                      className="font-mono text-[10px] uppercase tracking-label px-2 py-1 rounded-pill text-ink-soft hover:bg-paper-warm"
                    >
                      {c._expanded ? 'collapse' : 'expand'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCase(idx)}
                      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label px-2 py-1 rounded-pill text-outcome-stuck hover:bg-paper-warm"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                      remove
                    </button>
                  </div>

                  {c._expanded && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                          stdin
                        </span>
                        <textarea
                          value={c.stdin}
                          onChange={(e) => patchCase(idx, { stdin: e.target.value })}
                          rows={5}
                          placeholder="3&#10;1 2 3"
                          className={`mt-1 ${MONO_CLASS}`}
                        />
                      </label>
                      <label className="block">
                        <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                          expected stdout
                        </span>
                        <textarea
                          value={c.expectedStdout}
                          onChange={(e) => patchCase(idx, { expectedStdout: e.target.value })}
                          rows={5}
                          placeholder="6"
                          className={`mt-1 ${MONO_CLASS}`}
                        />
                      </label>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          <button
            type="button"
            onClick={addCase}
            disabled={cases.length >= 30}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-label px-3 py-1.5 bg-paper text-ink-soft border border-rule rounded-pill hover:bg-rule disabled:opacity-40"
          >
            <Plus className="w-3 h-3" strokeWidth={1.5} />
            Add test case
          </button>

          {validationErrors.length > 0 && (
            <ul className="space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i} className="font-mono text-[10px] text-outcome-stuck">
                  {err}
                </li>
              ))}
            </ul>
          )}

          {setTestCases.error && (
            <p className="font-mono text-[10px] text-outcome-stuck">
              {(setTestCases.error as Error).message}
            </p>
          )}
          {setTestCases.isSuccess && (
            <p className="font-mono text-[10px] text-outcome-done-easy">
              Saved.
            </p>
          )}

          <div className="flex justify-end pt-2 border-t border-rule">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
            >
              {setTestCases.isPending ? 'Saving…' : 'Save test cases'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
