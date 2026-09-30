'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ApiErrorResponse } from '../../lib/api/client';
import { useAdminMembers } from '../../lib/queries/admin-members-list';
import { useAdminInvites, useCreateInvite, useDeleteInvite, type Invite } from '../../lib/queries/admin-invites';
import { useAdminCycles } from '../../lib/queries/admin-cycles';
import { Avatar, Icon, Loading, Modal } from '../ui';
import { BTG_ADMIN_BASE } from './shell';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVITE_ERRORS: Record<string, string> = {
  'user-already-exists': 'Essa pessoa já tem conta. Convide outro e-mail.',
  'invite-already-exists': 'Esse e-mail já foi convidado.',
  'cycle-required-for-member': 'Selecione um ciclo para esse membro.',
  'cycle-archived': 'Esse ciclo está arquivado.',
  'cycle-not-found': 'Ciclo não encontrado.',
};

export function BtgMembers() {
  const { data, isLoading } = useAdminMembers();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data || !q) return data ?? [];
    return data.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          <span>Pessoas do programa</span>
          <span>Membros</span>
        </div>
        <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>
          {data ? `${data.length} no total` : 'Carregando…'}
        </span>
      </header>

      <main className="btg-admin-main">
        <div className="btg-stack" style={{ gap: 16 }}>
          <label className="btg-am-search">
            <Icon name="search" />
            <input
              className="btg-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              aria-label="Buscar membros"
            />
          </label>

          {isLoading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <div className="btg-card btg-empty" style={{ textAlign: 'center' }}>Nenhum membro encontrado.</div>
          ) : (
            <section className="btg-card">
              {filtered.map((m) => (
                <Link key={m.id} href={`${BTG_ADMIN_BASE}/member/${m.id}`} className="btg-am-row">
                  <Avatar name={m.name} pictureUrl={m.pictureUrl} />
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: 15 }}>{m.name}</span>
                    <span className="btg-mono btg-mute" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</span>
                  </span>
                  <span className={m.role === 'ADMIN' ? 'btg-pill' : 'btg-pill btg-pill--neutral'} style={{ justifySelf: 'start' }}>
                    {m.role === 'ADMIN' ? 'Admin' : 'Membro'}
                  </span>
                  <span className="btg-am-stats btg-mono">
                    <span className="btg-mute">{m.stats.plansCount} planos</span>
                    <span style={{ color: 'var(--btg-done-easy)' }}>
                      {m.stats.doneItems} feitos
                      {m.stats.skippedItems > 0 && <span className="btg-mute"> ({m.stats.skippedItems} pulados)</span>}
                    </span>
                    {m.stats.stuckItems > 0 && <span style={{ color: 'var(--btg-stuck)' }}>{m.stats.stuckItems} travados</span>}
                  </span>
                  <Icon name="chevron_right" style={{ color: 'var(--btg-text-mute)' }} />
                </Link>
              ))}
            </section>
          )}
        </div>

        <Invites />
      </main>
    </>
  );
}

function Invites() {
  const { data: invites, isLoading } = useAdminInvites();
  const { data: cycles } = useAdminCycles();
  const create = useCreateInvite();
  const remove = useDeleteInvite();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [cycleId, setCycleId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null);

  // Same rule as the classic screen: non-archived cycles that haven't ended yet.
  const eligibleCycles = useMemo(() => {
    const now = Date.now();
    return (cycles ?? [])
      .filter((c) => c.status === 'ACTIVE' && new Date(c.endsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [cycles]);

  const emailOk = EMAIL_REGEX.test(email.trim());
  const cycleOk = role === 'ADMIN' || cycleId.length > 0;
  const submitOk = emailOk && cycleOk && !create.isPending;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!submitOk) return;
    setFormError(null);
    try {
      await create.mutateAsync({ email: email.trim(), role, ...(cycleId ? { cycleId } : {}) });
      setEmail('');
      setRole('MEMBER');
      setCycleId('');
    } catch (err) {
      const code = err instanceof ApiErrorResponse ? err.apiError?.message : undefined;
      setFormError((code && INVITE_ERRORS[code]) ?? code ?? 'Não foi possível convidar. Tente de novo.');
    }
  }

  return (
    <aside className="btg-stack" style={{ gap: 16 }}>
      <form onSubmit={handleCreate} className="btg-card btg-card--pad" style={{ padding: 20 }}>
        <span className="btg-card-title"><Icon name="person_add" />Convidar</span>
        <label className="btg-field">
          E-mail
          <input className="btg-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@sou.inteli.edu.br" />
        </label>
        <label className="btg-field">
          Papel
          <select
            className="btg-select"
            value={role}
            onChange={(e) => {
              const next = e.target.value as 'ADMIN' | 'MEMBER';
              setRole(next);
              if (next === 'ADMIN') setCycleId('');
            }}
          >
            <option value="MEMBER">Membro</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <label className="btg-field">
          Ciclo
          <select className="btg-select" value={cycleId} onChange={(e) => setCycleId(e.target.value)} disabled={role === 'ADMIN'}>
            <option value="">{role === 'ADMIN' ? 'Sem ciclo (admin)' : 'Selecione o ciclo…'}</option>
            {eligibleCycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {formError && <div className="btg-notice btg-notice--bad"><Icon name="error" />{formError}</div>}
        <button type="submit" className="btg-btn btg-btn--primary" disabled={!submitOk}>
          {create.isPending ? 'Convidando…' : 'Enviar convite'}
        </button>
      </form>

      <section className="btg-card">
        <div className="btg-card-head" style={{ padding: '16px 20px' }}>
          <span className="btg-card-title">Convites pendentes</span>
          <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>{invites ? invites.length : '—'}</span>
        </div>
        {isLoading ? null : !invites || invites.length === 0 ? (
          <p className="btg-empty">Nenhum convite pendente.</p>
        ) : (
          <div style={{ padding: '0 20px' }}>
            {invites.map((inv) => (
              <div key={inv.id} className="btg-am-list-row">
                <span style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.email}</span>
                  <span className="btg-mute" style={{ fontSize: 12 }}>
                    {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                    {inv.createdBy ? ` · por ${inv.createdBy.name.split(' ')[0]}` : ''}
                    {inv.cycle ? ` · ${inv.cycle.name}` : ' · sem ciclo'}
                  </span>
                </span>
                <span className={inv.role === 'ADMIN' ? 'btg-pill' : 'btg-pill btg-pill--neutral'}>{inv.role === 'ADMIN' ? 'Admin' : 'Membro'}</span>
                <button
                  type="button"
                  className="btg-icon-btn"
                  aria-label={`Revogar convite de ${inv.email}`}
                  disabled={remove.isPending}
                  onClick={() => setRevokeTarget(inv)}
                >
                  <Icon name="delete" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={revokeTarget !== null}
        onClose={() => {
          if (!remove.isPending) setRevokeTarget(null);
        }}
        title="Revogar convite?"
        width={440}
        footer={
          <>
            <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={() => setRevokeTarget(null)} disabled={remove.isPending}>Cancelar</button>
            <button
              type="button"
              className="btg-btn btg-btn--primary btg-btn--sm"
              disabled={remove.isPending}
              onClick={() => revokeTarget && remove.mutate(revokeTarget.id, { onSuccess: () => setRevokeTarget(null) })}
            >
              {remove.isPending ? 'Revogando…' : 'Revogar'}
            </button>
          </>
        }
      >
        {remove.isError && (
          <div className="btg-notice btg-notice--bad" role="alert">
            <Icon name="error" />
            Não foi possível concluir: {remove.error instanceof Error ? remove.error.message : 'erro desconhecido'}.
          </div>
        )}
        <p style={{ fontSize: 15 }}>
          Revogar o convite de <strong>{revokeTarget?.email}</strong>? Para convidar de novo, crie um novo convite.
        </p>
      </Modal>
    </aside>
  );
}
