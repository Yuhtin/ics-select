'use client';
import { useEffect, useState } from 'react';
import {
  useCreateLibraryItem,
  useImportUrl,
  useUpdateLibraryItem,
  type AdminLibraryItem,
} from '../../../lib/queries/admin-library';

const FORMATS = ['VIDEO', 'ARTICLE', 'BOOK', 'PROBLEM', 'OTHER'] as const;
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

const INPUT_CLASS =
  'w-full min-h-10 rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

type Tab = 'manual' | 'import';

type Form = {
  title: string;
  url: string;
  description: string;
  format: (typeof FORMATS)[number];
  difficulty: (typeof DIFFICULTIES)[number];
  estimatedMinutes: number;
};

function makeForm(init: AdminLibraryItem | null | undefined): Form {
  if (!init) {
    return {
      title: '',
      url: '',
      description: '',
      format: 'ARTICLE',
      difficulty: 'MEDIUM',
      estimatedMinutes: 30,
    };
  }
  return {
    title: init.title,
    url: init.url ?? '',
    description: init.description ?? '',
    format: init.format,
    difficulty: init.difficulty,
    estimatedMinutes: init.estimatedMinutes,
  };
}

interface ItemFormModalProps {
  open: boolean;
  initial?: AdminLibraryItem | null;
  onClose: () => void;
}

export function ItemFormModal({ open, initial, onClose }: ItemFormModalProps) {
  const [tab, setTab] = useState<Tab>('manual');
  const [form, setForm] = useState<Form>(() => makeForm(initial));
  const [importUrl, setImportUrl] = useState('');
  const create = useCreateLibraryItem();
  const update = useUpdateLibraryItem();
  const importer = useImportUrl();

  const isEdit = Boolean(initial);

  useEffect(() => {
    setForm(makeForm(initial));
    setTab('manual');
    setImportUrl('');
  }, [initial]);

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
    const payload = {
      title: form.title,
      url: form.url || null,
      description: form.description || null,
      format: form.format,
      difficulty: form.difficulty,
      estimatedMinutes: form.estimatedMinutes,
    };
    if (isEdit && initial) {
      await update.mutateAsync({ id: initial.id, data: payload });
    } else {
      await create.mutateAsync(payload);
    }
    onClose();
    setForm(makeForm(null));
    setImportUrl('');
  }

  const handleCancel = () => {
    onClose();
    setForm(makeForm(initial));
    setImportUrl('');
    setTab('manual');
  };

  const saveError = isEdit ? update.error : create.error;
  const saving = isEdit ? update.isPending : create.isPending;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-card bg-surface border border-border-token p-6 shadow-modal max-h-[90vh] overflow-y-auto">
        <h3 className="font-sans text-xl font-semibold text-fg">
          {isEdit ? 'Edit library item' : 'New library item'}
        </h3>
        {!isEdit && (
          <nav className="mt-4 border-b border-border-token flex gap-6">
            {(['manual', 'import'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface pb-2 font-sans text-xs font-medium ${
                  tab === t
                    ? 'text-fg font-semibold border-b-2 border-border-strong -mb-[1px]'
                    : 'text-fg-mute hover:text-fg'
                }`}
              >
                {t === 'manual' ? 'Manual' : 'Import URL'}
              </button>
            ))}
          </nav>
        )}

        {!isEdit && tab === 'import' && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="font-sans text-xs font-medium text-fg-mute">
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
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface font-sans text-xs font-medium px-4 py-2 bg-primary text-primary-fg rounded-pill disabled:opacity-40"
            >
              {importer.isPending ? 'Fetching…' : 'Fetch metadata'}
            </button>
            {importer.error && (
              <p className="font-sans text-xs text-outcome-stuck">
                {(importer.error as Error).message}
              </p>
            )}
            <p className="font-sans text-xs text-fg-mute">
              After fetching, review the prefilled fields in the Manual tab and
              click Save.
            </p>
          </div>
        )}

        {(isEdit || tab === 'manual') && (
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
            {saveError && (
              <p className="font-sans text-xs text-outcome-stuck">
                {(saveError as Error).message}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface font-sans text-xs font-medium px-4 py-2 text-fg-soft hover:bg-bg-subtle rounded-pill"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={form.title.trim().length === 0 || saving}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface font-sans text-xs font-medium px-4 py-2 bg-primary text-primary-fg rounded-pill disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
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
      <span className="font-sans text-xs font-medium text-fg-mute">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
