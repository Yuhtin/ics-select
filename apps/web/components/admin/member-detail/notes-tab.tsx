'use client';
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  useAdminNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  type AdminNote,
} from '../../../lib/queries/admin-notes';
import { ConfirmDialog } from '../../ui/confirm-dialog';

function formatRelative(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function NotesTab({ memberId }: { memberId: string }) {
  const { data: notes } = useAdminNotes(memberId);
  const create = useCreateNote();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminNote | null>(null);

  const submitNew = () => {
    if (draft.trim().length === 0) return;
    create.mutate({ aboutId: memberId, text: draft.trim() }, {
      onSuccess: () => setDraft(''),
    });
  };

  const saveEdit = (note: AdminNote) => {
    if (editText.trim().length === 0) return;
    update.mutate({ id: note.id, aboutId: memberId, text: editText.trim() }, {
      onSuccess: () => {
        setEditingId(null);
        setEditText('');
      },
    });
  };

  const removeNote = (note: AdminNote) => {
    setDeleteTarget(note);
  };
  const confirmRemove = () => {
    if (!deleteTarget) return;
    remove.mutate(
      { id: deleteTarget.id, aboutId: memberId },
      { onSettled: () => setDeleteTarget(null) },
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nota privada sobre este membro…"
          rows={3}
          className="w-full rounded-input border border-border-token bg-bg p-3 font-sans text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submitNew}
            disabled={draft.trim().length === 0 || create.isPending}
            className="font-sans text-xs px-4 py-2 bg-primary text-primary-fg rounded-pill hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {create.isPending ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </div>

      {(!notes || notes.length === 0) ? (
        <p className="font-sans text-xs text-fg-mute">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => {
            const editing = editingId === note.id;
            return (
              <li key={note.id} className="border border-border-token rounded-card bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-sans text-xs text-fg-mute">
                    {formatRelative(note.createdAt)}
                  </p>
                  <div className="flex items-center gap-2 font-sans text-xs">
                    {editing ? null : (
                      <>
                        <button onClick={() => { setEditingId(note.id); setEditText(note.text); }} className="text-fg-soft hover:text-fg inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                          <Pencil className="h-3 w-3" strokeWidth={1.5} /> edit
                        </button>
                        <button onClick={() => removeNote(note)} className="text-fg-soft hover:text-outcome-stuck inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                          <Trash2 className="h-3 w-3" strokeWidth={1.5} /> delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editing ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full rounded-input border border-border-token bg-bg p-3 font-sans text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingId(null); setEditText(''); }} className="font-sans text-xs px-3 py-1.5 text-fg-soft hover:bg-bg-subtle rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                        Cancel
                      </button>
                      <button onClick={() => saveEdit(note)} disabled={update.isPending} className="font-sans text-xs px-3 py-1.5 bg-primary text-primary-fg rounded-pill disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 font-sans text-sm text-fg leading-relaxed whitespace-pre-wrap">{note.text}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => {
          if (!remove.isPending) setDeleteTarget(null);
        }}
        onConfirm={confirmRemove}
        title="Apagar nota?"
        description="Essa ação não pode ser desfeita."
        confirmLabel="Apagar"
        isLoading={remove.isPending}
      />
    </div>
  );
}
