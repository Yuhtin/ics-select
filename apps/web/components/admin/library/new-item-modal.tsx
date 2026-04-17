'use client';
import { useState } from 'react';
import {
  useCreateLibraryItem,
  useImportUrl,
} from '../../../lib/queries/admin-library';

const FORMATS = ['VIDEO', 'ARTICLE', 'BOOK', 'PROBLEM', 'OTHER'] as const;
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

const INPUT_CLASS =
  'w-full rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40';

type Tab = 'manual' | 'import';

type Form = {
  title: string;
  url: string;
  description: string;
  format: (typeof FORMATS)[number];
  difficulty: (typeof DIFFICULTIES)[number];
  estimatedMinutes: number;
};

const EMPTY_FORM: Form = {
  title: '',
  url: '',
  description: '',
  format: 'ARTICLE',
  difficulty: 'MEDIUM',
  estimatedMinutes: 30,
};

export function NewItemModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('manual');
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [importUrl, setImportUrl] = useState('');
  const create = useCreateLibraryItem();
  const importer = useImportUrl();

  if (!open) return null;

  async function handleImport() {
    if (!importUrl.trim()) return;
    const meta = await importer.mutateAsync(importUrl.trim());
    setForm((prev) => ({
      ...prev,
      title: meta.title ?? prev.title,
      url: meta.url ?? importUrl.trim(),
      description: meta.description ?? prev.description,
      format: (meta.format as Form['format']) ?? prev.format,
      estimatedMinutes: meta.estimatedMinutes ?? prev.estimatedMinutes,
    }));
    setTab('manual');
  }

  async function handleSave() {
    await create.mutateAsync({
      title: form.title,
      url: form.url || null,
      description: form.description || null,
      format: form.format,
      difficulty: form.difficulty,
      estimatedMinutes: form.estimatedMinutes,
    });
    onClose();
    setForm(EMPTY_FORM);
    setImportUrl('');
  }

  const handleCancel = () => {
    onClose();
    setForm(EMPTY_FORM);
    setImportUrl('');
    setTab('manual');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-xl rounded-card bg-surface border border-rule p-6 shadow-modal max-h-[90vh] overflow-y-auto">
        <h3 className="font-serif-tool text-xl font-semibold text-ink">
          New library item
        </h3>
        <nav className="mt-4 border-b border-rule flex gap-6">
          {(['manual', 'import'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`pb-2 font-mono text-xs uppercase tracking-label ${
                tab === t
                  ? 'text-ink font-semibold border-b-2 border-ink -mb-[1px]'
                  : 'text-ink-mute hover:text-ink'
              }`}
            >
              {t === 'manual' ? 'Manual' : 'Import URL'}
            </button>
          ))}
        </nav>

        {tab === 'import' && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                URL
              </span>
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://..."
                className={`mt-1 ${INPUT_CLASS}`}
              />
            </label>
            <button
              type="button"
              onClick={handleImport}
              disabled={importer.isPending || importUrl.trim().length === 0}
              className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
            >
              {importer.isPending ? 'Fetching…' : 'Fetch metadata'}
            </button>
            {importer.error && (
              <p className="font-mono text-[10px] text-outcome-stuck">
                {(importer.error as Error).message}
              </p>
            )}
            <p className="font-mono text-[10px] text-ink-mute">
              After fetching, review the prefilled fields in the Manual tab and
              click Save.
            </p>
          </div>
        )}

        {tab === 'manual' && (
          <div className="mt-4 space-y-3">
            <Field label="Title">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="URL">
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                className={`${INPUT_CLASS} resize-y`}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Format">
                <select
                  value={form.format}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      format: e.target.value as Form['format'],
                    })
                  }
                  className={INPUT_CLASS}
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Difficulty">
                <select
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      difficulty: e.target.value as Form['difficulty'],
                    })
                  }
                  className={INPUT_CLASS}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Minutes">
                <input
                  type="number"
                  min={1}
                  value={form.estimatedMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estimatedMinutes: Number(e.target.value),
                    })
                  }
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            {create.error && (
              <p className="font-mono text-[10px] text-outcome-stuck">
                {(create.error as Error).message}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={form.title.trim().length === 0 || create.isPending}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
          >
            {create.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
