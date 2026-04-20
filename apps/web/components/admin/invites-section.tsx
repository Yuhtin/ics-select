'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Trash2 } from 'lucide-react';
import { ApiErrorResponse } from '../../lib/api/client';
import {
  useAdminInvites,
  useCreateInvite,
  useDeleteInvite,
} from '../../lib/queries/admin-invites';
import { Eyebrow } from '../ui/eyebrow';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InvitesSection() {
  const { data: invites, isLoading } = useAdminInvites();
  const create = useCreateInvite();
  const remove = useDeleteInvite();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [formError, setFormError] = useState<string | null>(null);
  const emailOk = EMAIL_REGEX.test(email.trim());

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOk || create.isPending) return;
    setFormError(null);
    try {
      await create.mutateAsync({ email: email.trim(), role });
      setEmail('');
      setRole('MEMBER');
    } catch (err) {
      if (err instanceof ApiErrorResponse) {
        const code = err.apiError?.message;
        if (code === 'user-already-exists') {
          setFormError('Essa pessoa já tem conta — convide outro email.');
        } else if (code === 'invite-already-exists') {
          setFormError('Esse email já foi convidado.');
        } else {
          setFormError(err.apiError?.message ?? 'Não foi possível convidar.');
        }
      } else {
        setFormError('Não foi possível convidar. Tenta de novo.');
      }
    }
  }

  return (
    <section className="space-y-4">
      <header>
        <Eyebrow>Pending invites</Eyebrow>
        <p className="mt-1 font-mono text-xs text-ink-mute">
          {invites ? `${invites.length} pending` : 'Loading…'}
        </p>
      </header>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-start gap-3 rounded-card border border-rule bg-surface px-4 py-3"
      >
        <div className="flex-1 min-w-[220px]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@sou.inteli.edu.br"
            className="w-full rounded-input border border-rule bg-paper px-3 py-1.5 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
          className="rounded-input border border-rule bg-paper px-3 py-1.5 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
        >
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          type="submit"
          disabled={!emailOk || create.isPending}
          className={clsx(
            'rounded-input px-3 py-1.5 font-sans text-sm font-medium transition-colors',
            emailOk && !create.isPending
              ? 'bg-ink text-paper hover:bg-ink-soft'
              : 'cursor-not-allowed bg-paper-warm text-ink-mute',
          )}
        >
          {create.isPending ? 'Invitando…' : 'Convidar'}
        </button>
      </form>
      {formError && (
        <p className="font-mono text-[11px] text-outcome-stuck">{formError}</p>
      )}

      {isLoading ? null : !invites || invites.length === 0 ? (
        <p className="rounded-card border border-dashed border-rule py-8 text-center font-mono text-xs text-ink-mute">
          Nenhum convite pendente.
        </p>
      ) : (
        <ul className="divide-y divide-rule rounded-card border border-rule bg-surface">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center gap-4 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-semibold text-ink">
                  {inv.email}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-label text-ink-mute">
                  Invited {new Date(inv.createdAt).toLocaleDateString()}
                  {inv.createdBy ? ` · by ${inv.createdBy.name.split(' ')[0]}` : null}
                </p>
              </div>
              <span
                className={clsx(
                  'rounded-pill border px-2 py-0.5 font-mono text-[10px] uppercase tracking-label',
                  inv.role === 'ADMIN'
                    ? 'border-accent/40 text-accent'
                    : 'border-rule text-ink-mute',
                )}
              >
                {inv.role}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Revogar convite de ${inv.email}?`)) {
                    remove.mutate(inv.id);
                  }
                }}
                disabled={remove.isPending}
                aria-label={`Revoke invite for ${inv.email}`}
                className="rounded-input p-1.5 text-ink-mute transition-colors hover:bg-paper-warm hover:text-outcome-stuck"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
