'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTopics, type Topic } from '../../../lib/queries/admin-topics';
import {
  useCreateTopic,
  useUpdateTopic,
  useDeleteTopic,
} from '../../../lib/queries/admin-library';
import { ConfirmDialog } from '../../ui/confirm-dialog';

export function TopicsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: topics } = useTopics();
  const createT = useCreateTopic();
  const updateT = useUpdateTopic();
  const removeT = useDeleteTopic();
  const [newSlug, setNewSlug] = useState('');
  const [newLabel, setNewLabel] = useState('');

  if (!open) return null;

  const handleAdd = async () => {
    if (!newSlug.trim() || !newLabel.trim()) return;
    await createT.mutateAsync({
      slug: newSlug.trim(),
      label: newLabel.trim(),
    });
    setNewSlug('');
    setNewLabel('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-card bg-surface border border-rule p-6 shadow-modal max-h-[80vh] overflow-y-auto">
        <h3 className="font-serif-tool text-xl font-semibold text-ink">
          Manage topics
        </h3>
        <ul className="mt-4 space-y-2">
          {(topics ?? []).map((t) => (
            <TopicRow
              key={t.id}
              topic={t}
              onUpdate={(data) => updateT.mutate({ id: t.id, data })}
              onDelete={() => removeT.mutate(t.id)}
            />
          ))}
          {(topics ?? []).length === 0 && (
            <li className="font-mono text-[10px] text-ink-mute py-6 text-center border border-dashed border-rule rounded-card">
              No topics yet.
            </li>
          )}
        </ul>
        <div className="mt-6 pt-4 border-t border-rule space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
            Add new
          </p>
          <div className="flex gap-2">
            <input
              placeholder="slug (e.g. dp)"
              value={newSlug}
              onChange={(e) =>
                setNewSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                )
              }
              className="flex-1 rounded-input border border-rule bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
            />
            <input
              placeholder="Label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={
                createT.isPending || !newSlug.trim() || !newLabel.trim()
              }
              className="font-mono text-xs uppercase tracking-label px-3 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {createT.error && (
            <p className="font-mono text-[10px] text-outcome-stuck">
              {(createT.error as Error).message}
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-paper-warm text-ink-soft rounded-pill hover:bg-rule"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function TopicRow({
  topic,
  onUpdate,
  onDelete,
}: {
  topic: Topic;
  onUpdate: (data: { slug?: string; label?: string }) => void;
  onDelete: () => void;
}) {
  const [slug, setSlug] = useState(topic.slug);
  const [label, setLabel] = useState(topic.label);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dirty = slug !== topic.slug || label !== topic.label;

  return (
    <li className="flex items-center gap-2 border border-rule rounded-card p-2 bg-paper">
      <input
        value={slug}
        onChange={(e) =>
          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
        }
        className="w-24 rounded-input border border-rule bg-paper px-2 py-1 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-focus/40"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="flex-1 rounded-input border border-rule bg-paper px-2 py-1 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
      />
      {dirty && (
        <button
          type="button"
          onClick={() => onUpdate({ slug, label })}
          className="font-mono text-[10px] uppercase tracking-label text-focus hover:underline"
        >
          save
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="text-ink-mute hover:text-outcome-stuck"
        aria-label="Delete topic"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onDelete();
        }}
        title="Delete topic?"
        description={
          <>
            Delete topic <span className="font-semibold text-ink">{topic.label}</span>? Library
            items tagged with this topic will lose the tag.
          </>
        }
        confirmLabel="Delete"
        classNames={{ wrapper: 'z-[110]', backdrop: 'z-[110]' }}
      />
    </li>
  );
}
