'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ApiErrorResponse } from '../../lib/api/client';
import { useToggleRanking, type CycleOverviewMember, type CycleOverviewResponse } from '../../lib/queries/admin-cycle';
import { useAddCycleMember, useRemoveCycleMember } from '../../lib/queries/admin-cycle-members';
import { useAdminMembers } from '../../lib/queries/admin-members-list';
import { Avatar, Icon, Modal } from '../ui';
import { TRACKS, Toggle } from './cycles-ui';
import { BTG_ADMIN_BASE } from './shell';

/** "Ranking visível para membros" switch. Mount in the cycle overview header. */
export function BtgRankingToggle({ cycleId, checked }: { cycleId: string; checked: boolean }) {
  const toggle = useToggleRanking();
  const shown = toggle.isPending ? !checked : checked;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13 }} className="btg-soft">
      <Toggle
        checked={shown}
        label="Ranking visível para os membros"
        disabled={toggle.isPending}
        onChange={(next) => toggle.mutate({ cycleId, rankingVisibleToMembers: next })}
      />
      {shown ? 'Ranking visível para membros' : 'Ranking oculto para membros'}
    </span>
  );
}

function AvailabilityLine({ a }: { a: CycleOverviewMember['availability'] }) {
  if (a.itemsCount === 0) return null;
  if (a.budgetMinutes === 0) return <span className="btg-ac-meta">Sem disponibilidade declarada.</span>;
  const pct = Math.round((a.plannedMinutes / a.budgetMinutes) * 100);
  const color = pct <= 80 ? 'var(--btg-done-easy)' : pct <= 100 ? 'var(--btg-done-hard)' : 'var(--btg-stuck)';
  return (
    <span className="btg-mono" style={{ fontSize: 12, color }}>
      {a.itemsCount} itens · {a.plannedMinutes}/{a.budgetMinutes} min ({pct}%)
    </span>
  );
}

function RosterModal({
  open,
  onClose,
  cycleId,
  cycleName,
  members,
}: {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  cycleName: string;
  members: CycleOverviewMember[];
}) {
  const { data: users, isLoading } = useAdminMembers();
  const add = useAddCycleMember();
  const remove = useRemoveCycleMember();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = add.isPending || remove.isPending;

  // Admins run the program; they never enrol in a cycle.
  const candidates = useMemo(() => {
    const inCycle = new Set(members.map((m) => m.userId));
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => u.role !== 'ADMIN' && !inCycle.has(u.id))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, members, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Sequential on purpose: the overlap check is read-then-write, and a per-person error
  // must be attributable. The conflict message already names the clashing cycle.
  async function addSelected() {
    const failures: Record<string, string> = {};
    for (const userId of selected) {
      try {
        await add.mutateAsync({ cycleId, userId });
      } catch (err) {
        failures[userId] = err instanceof ApiErrorResponse ? err.apiError?.message ?? 'Não foi possível adicionar.' : 'Não foi possível adicionar.';
      }
    }
    setErrors(failures);
    setSelected(new Set(Object.keys(failures)));
    if (Object.keys(failures).length === 0) setQuery('');
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={`Turma · ${cycleName}`}
      width={640}
      footer={
        <>
          <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={onClose} disabled={busy}>
            Fechar
          </button>
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => void addSelected()} disabled={selected.size === 0 || busy}>
            {add.isPending ? 'Adicionando…' : selected.size === 0 ? 'Adicionar' : `Adicionar ${selected.size}`}
          </button>
        </>
      }
    >
      <span className="btg-eyebrow">No ciclo · {members.length}</span>
      {members.length === 0 ? (
        <span className="btg-mute" style={{ fontSize: 14 }}>Ninguém ainda.</span>
      ) : (
        <div className="btg-ac-scroll" style={{ maxHeight: 220 }}>
          {members.map((m) => (
            <div key={m.userId} className="btg-ac-row" style={{ padding: '8px 12px' }}>
              <Avatar name={m.name} pictureUrl={m.pictureUrl} size="sm" />
              <span className="btg-ac-grow" style={{ fontSize: 14 }}><span>{m.name}</span></span>
              <button
                type="button"
                className="btg-icon-btn"
                aria-label={`Remover ${m.name} do ciclo`}
                disabled={busy}
                onClick={() => remove.mutate({ cycleId, userId: m.userId })}
                style={{ width: 32, height: 32 }}
              >
                <Icon name="person_remove" />
              </button>
            </div>
          ))}
        </div>
      )}

      <span className="btg-eyebrow" style={{ marginTop: 8 }}>Adicionar</span>
      <label style={{ position: 'relative', display: 'block' }}>
        <Icon name="search" style={{ position: 'absolute', left: 10, top: 12, color: 'var(--btg-text-mute)' }} />
        <input
          className="btg-input"
          aria-label="Buscar por nome ou email"
          placeholder="Buscar por nome ou email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ paddingLeft: 38 }}
        />
      </label>
      {isLoading ? (
        <span className="btg-mute" style={{ fontSize: 14 }}>Carregando…</span>
      ) : candidates.length === 0 ? (
        <span className="btg-mute" style={{ fontSize: 14 }}>{query ? 'Ninguém encontrado.' : 'Todo mundo já está no ciclo.'}</span>
      ) : (
        <div className="btg-ac-scroll">
          {candidates.map((u) => (
            <label key={u.id} className="btg-ac-row btg-ac-check" style={{ padding: '10px 12px', background: errors[u.id] ? '#fde8e9' : undefined }}>
              <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} disabled={busy} />
              <span className="btg-ac-grow">
                <span>{u.name}</span>
                <span className="btg-ac-meta btg-mono">{u.email}</span>
                {errors[u.id] && <span className="btg-ac-danger" style={{ fontSize: 13 }}>{errors[u.id]}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

/**
 * Members card for the cycle overview: resumo link, roster management and the member grid.
 * Mount in btg/admin/cycle.tsx.
 */
export function BtgCycleMembers({ data }: { data: CycleOverviewResponse }) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const notStarted = new Date(data.cycle.startsAt) > new Date();
  return (
    <section className="btg-card">
      <div className="btg-card-head" style={{ padding: '14px 20px', flexWrap: 'wrap' }}>
        <span className="btg-card-title">Membros · {data.members.length}</span>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {notStarted ? (
            <span className="btg-btn btg-btn--ghost btg-btn--sm" style={{ opacity: 0.5 }} title="O ciclo ainda não começou">
              <Icon name="receipt_long" />
              Resumo
            </span>
          ) : (
            <Link href={`${BTG_ADMIN_BASE}/cycle/${data.cycle.id}/resumo`} className="btg-btn btg-btn--ghost btg-btn--sm">
              <Icon name="receipt_long" />
              Resumo
            </Link>
          )}
          <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={() => setRosterOpen(true)}>
            <Icon name="group_add" />
            Gerenciar turma
          </button>
        </span>
      </div>
      {data.members.length === 0 ? (
        <p className="btg-empty">Nenhum membro ainda.</p>
      ) : (
        <div className="btg-ac-members">
          {data.members.map((m) => (
            <Link key={m.userId} href={`${BTG_ADMIN_BASE}/member/${m.userId}`} className="btg-ac-member">
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Avatar name={m.name} pictureUrl={m.pictureUrl} size="sm" />
                <span className="btg-ac-grow">
                  <span style={{ fontSize: 15 }}>{m.name}</span>
                  {m.track && <span className="btg-ac-meta">{TRACKS[m.track] ?? m.track}</span>}
                </span>
                {m.hasAlert && <span className="btg-dot" style={{ background: 'var(--btg-stuck)' }} aria-label="Tem alerta" />}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="btg-mono" style={{ fontSize: 22 }}>{m.percentThisWeek}%</span>
                <span className="btg-ac-meta btg-mono">{m.done}/{m.total} na semana</span>
              </span>
              <div className="btg-track btg-track--thin"><div style={{ width: `${Math.min(100, m.percentThisWeek)}%` }} /></div>
              <AvailabilityLine a={m.availability} />
            </Link>
          ))}
        </div>
      )}
      <RosterModal
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        cycleId={data.cycle.id}
        cycleName={data.cycle.name}
        members={data.members}
      />
    </section>
  );
}
