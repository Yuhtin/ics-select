'use client';
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  useAdminMocks,
  useCreateMock,
  useUpdateMock,
  useDeleteMock,
  type AdminMock,
  type MockType,
  MOCK_TYPES,
} from '../../../lib/queries/admin-mocks';
import { ConfirmDialog } from '../../ui/confirm-dialog';

const TYPE_LABEL: Record<MockType, string> = {
  BEHAVIORAL: 'Behavioral',
  CODING: 'Coding',
  SYSTEM_DESIGN: 'System Design',
};

const SCORE_TOOLTIPS: Record<number, string> = {
  1: '1 · No Hire',
  2: '2 · Lean No',
  3: '3 · Borderline',
  4: '4 · Lean Hire',
  5: '5 · Strong Hire',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Returns today as `YYYY-MM-DD` in the local TZ — used as default for the
// <input type="date"> value. Local TZ matches what the admin types into the
// picker; the API coerces to Date on the server.
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Props = {
  memberId: string;
  cycleId: string | null;
};

type Draft = {
  type: MockType;
  score: number;
  conductedAt: string;
  conductedBy: string;
  topicsInput: string;
  feedback: string;
};

const EMPTY_DRAFT: Draft = {
  type: 'CODING',
  score: 3,
  conductedAt: todayIso(),
  conductedBy: '',
  topicsInput: '',
  feedback: '',
};

function parseTopics(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function MocksTab({ memberId, cycleId }: Props) {
  const { data: mocks } = useAdminMocks(memberId, cycleId);
  const create = useCreateMock();
  const update = useUpdateMock();
  const remove = useDeleteMock();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMock | null>(null);

  const canSubmit = Boolean(cycleId) && draft.score >= 1 && draft.score <= 5;

  function submit() {
    if (!cycleId || !canSubmit) return;
    const payload = {
      userId: memberId,
      cycleId,
      type: draft.type,
      score: draft.score,
      feedback: draft.feedback.trim() || undefined,
      conductedBy: draft.conductedBy.trim() || undefined,
      conductedAt: new Date(draft.conductedAt).toISOString(),
      topics: parseTopics(draft.topicsInput),
    };
    if (editingId) {
      const { userId: _u, cycleId: _c, ...rest } = payload;
      update.mutate(
        { id: editingId, userId: memberId, ...rest },
        {
          onSuccess: () => {
            setDraft(EMPTY_DRAFT);
            setEditingId(null);
          },
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => setDraft(EMPTY_DRAFT),
      });
    }
  }

  function startEdit(m: AdminMock) {
    setEditingId(m.id);
    setDraft({
      type: m.type,
      score: m.score,
      conductedAt: m.conductedAt.slice(0, 10),
      conductedBy: m.conductedBy ?? '',
      topicsInput: m.topics.join(', '),
      feedback: m.feedback ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  function confirmRemove() {
    if (!deleteTarget) return;
    remove.mutate(
      { id: deleteTarget.id, userId: memberId },
      { onSettled: () => setDeleteTarget(null) },
    );
  }

  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      {!cycleId && (
        <p className="font-mono text-xs text-outcome-stuck">
          Select a cycle to log mock interviews.
        </p>
      )}

      <fieldset className="border border-rule rounded-card bg-paper-warm/40 p-4 space-y-3">
        <legend className="font-mono text-[10px] uppercase tracking-label text-ink-mute px-2">
          {editingId ? 'Edit mock' : 'New mock'}
        </legend>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">Type</span>
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as MockType })}
              className="mt-1 w-full rounded-input border border-rule bg-surface p-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
            >
              {MOCK_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
              Score · {SCORE_TOOLTIPS[draft.score]}
            </span>
            <div className="mt-1 inline-flex rounded-pill bg-surface border border-rule p-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  title={SCORE_TOOLTIPS[n]}
                  onClick={() => setDraft({ ...draft, score: n })}
                  className={
                    draft.score === n
                      ? 'px-3 py-1 rounded-pill bg-ink text-paper font-mono text-xs tabular-nums'
                      : 'px-3 py-1 rounded-pill text-ink-mute hover:text-ink font-mono text-xs tabular-nums'
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">Date</span>
            <input
              type="date"
              value={draft.conductedAt}
              onChange={(e) => setDraft({ ...draft, conductedAt: e.target.value })}
              className="mt-1 w-full rounded-input border border-rule bg-surface p-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">Conducted by</span>
            <input
              type="text"
              value={draft.conductedBy}
              onChange={(e) => setDraft({ ...draft, conductedBy: e.target.value })}
              placeholder="Nome do mentor (opcional)"
              className="mt-1 w-full rounded-input border border-rule bg-surface p-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
            />
          </label>

          <label className="md:col-span-2 block">
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
              Topics (comma-separated)
            </span>
            <input
              type="text"
              value={draft.topicsInput}
              onChange={(e) => setDraft({ ...draft, topicsInput: e.target.value })}
              placeholder="tree, recursion, base-cases"
              className="mt-1 w-full rounded-input border border-rule bg-surface p-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
            />
          </label>
        </div>

        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">Feedback</span>
          <textarea
            value={draft.feedback}
            onChange={(e) => setDraft({ ...draft, feedback: e.target.value })}
            rows={3}
            placeholder="O que funcionou, o que travou, padrões observados…"
            className="mt-1 w-full rounded-input border border-rule bg-surface p-3 font-sans text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-focus/40"
          />
        </label>

        <div className="flex justify-end gap-2">
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="font-mono text-xs uppercase tracking-label px-3 py-1.5 text-ink-soft hover:bg-paper-warm rounded-pill"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || pending}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill hover:opacity-90 disabled:opacity-40"
          >
            {pending ? 'Saving…' : editingId ? 'Save changes' : 'Add mock'}
          </button>
        </div>
      </fieldset>

      {(!mocks || mocks.length === 0) ? (
        <p className="font-mono text-xs text-ink-mute">No mocks logged yet.</p>
      ) : (
        <ul className="space-y-3">
          {mocks.map((m) => (
            <li key={m.id} className="border border-rule rounded-card bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                    {formatDate(m.conductedAt)} · {TYPE_LABEL[m.type]}
                    {m.conductedBy && ` · ${m.conductedBy}`}
                  </p>
                  <p className="mt-1 font-serif-tool text-lg text-ink tabular-nums font-semibold">
                    {m.score}<span className="text-ink-faint text-sm">/5</span>
                    <span className="ml-2 text-xs font-mono text-ink-mute">
                      {SCORE_TOOLTIPS[m.score]?.split('·')[1]?.trim()}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <button
                    onClick={() => startEdit(m)}
                    className="text-ink-soft hover:text-ink inline-flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={1.5} /> edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="text-ink-soft hover:text-outcome-stuck inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} /> delete
                  </button>
                </div>
              </div>
              {m.topics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.topics.map((t) => (
                    <span
                      key={t}
                      className="font-mono text-[10px] uppercase tracking-label px-2 py-0.5 rounded-pill bg-paper-warm text-ink-soft border border-rule"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {m.feedback && (
                <p className="mt-2 font-serif-tool text-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {m.feedback}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => {
          if (!remove.isPending) setDeleteTarget(null);
        }}
        onConfirm={confirmRemove}
        title="Apagar mock?"
        description="Essa ação não pode ser desfeita."
        confirmLabel="Apagar"
        isLoading={remove.isPending}
      />
    </div>
  );
}
