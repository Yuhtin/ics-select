'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAdminCycles, useArchiveCycle, useCreateCycle, type CycleRow } from '../../lib/queries/admin-cycles';
import { Icon, Loading, Modal } from '../ui';
import { Confirm, shortDate } from './cycles-ui';
import { BTG_ADMIN_BASE } from './shell';

type Phase = 'active' | 'upcoming' | 'past' | 'archived';

// Phase is a pure function of date range + status: every running ACTIVE cycle shows as
// "Em andamento" (a bench cycle overlapping the main one included), same as the classic list.
function phaseOf(c: CycleRow, now: number): Phase {
  if (c.status === 'ARCHIVED') return 'archived';
  if (now < new Date(c.startsAt).getTime()) return 'upcoming';
  if (now > new Date(c.endsAt).getTime()) return 'past';
  return 'active';
}

const PHASE: Record<Phase, { label: string; className: string; order: number }> = {
  active: { label: 'Em andamento', className: 'btg-pill', order: 0 },
  upcoming: { label: 'Próximo', className: 'btg-pill btg-pill--neutral', order: 1 },
  past: { label: 'Encerrado', className: 'btg-pill btg-pill--neutral', order: 2 },
  archived: { label: 'Arquivado', className: 'btg-pill btg-pill--neutral', order: 3 },
};

function NewCycleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const create = useCreateCycle();
  const valid = Boolean(name.trim() && startsAt && endsAt);

  async function submit() {
    if (!valid) return;
    await create.mutateAsync({
      name: name.trim(),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    });
    setName('');
    setStartsAt('');
    setEndsAt('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo ciclo"
      width={480}
      footer={
        <>
          <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => void submit().catch(() => {})} disabled={!valid || create.isPending}>
            {create.isPending ? 'Criando…' : 'Criar ciclo'}
          </button>
        </>
      }
    >
      <label className="btg-field">
        Nome
        <input className="btg-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ciclo 2027.1" />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <label className="btg-field">
          Início
          <input type="date" className="btg-input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="btg-field">
          Fim
          <input type="date" className="btg-input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
      </div>
      {create.error && <span className="btg-ac-danger" style={{ fontSize: 13 }}>{(create.error as Error).message}</span>}
    </Modal>
  );
}

export function BtgCycles() {
  const { data, isLoading } = useAdminCycles();
  const archive = useArchiveCycle();
  const [newOpen, setNewOpen] = useState(false);
  const [target, setTarget] = useState<CycleRow | null>(null);

  const rows = useMemo(() => {
    const now = Date.now();
    return (data ?? [])
      .map((cycle) => ({ cycle, phase: phaseOf(cycle, now) }))
      .sort(
        (a, b) =>
          PHASE[a.phase].order - PHASE[b.phase].order ||
          new Date(b.cycle.startsAt).getTime() - new Date(a.cycle.startsAt).getTime(),
      );
  }, [data]);

  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          <span>{data ? `${data.length} ${data.length === 1 ? 'ciclo' : 'ciclos'}` : 'Carregando…'}</span>
          <span>Ciclos</span>
        </div>
        <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => setNewOpen(true)}>
          <Icon name="add" />
          Novo ciclo
        </button>
      </header>

      <main className="btg-ac-main">
        {isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <section className="btg-card btg-empty">Nenhum ciclo ainda. Crie o primeiro para abrir a seleção.</section>
        ) : (
          <section className="btg-card">
            {rows.map(({ cycle, phase }) => {
              const members = cycle._count?.memberships ?? cycle.memberships?.length ?? 0;
              return (
                <div key={cycle.id} className={phase === 'active' ? 'btg-ac-row btg-ac-row--active' : 'btg-ac-row'}>
                  <Link href={`${BTG_ADMIN_BASE}/cycle/${cycle.id}`} className="btg-ac-grow" style={{ color: 'inherit' }}>
                    <span style={{ fontSize: 16 }}>{cycle.name}</span>
                    <span className="btg-ac-meta">
                      <span className="btg-mono">
                        {shortDate(cycle.startsAt)} – {shortDate(cycle.endsAt, true)}
                      </span>
                      {' · '}
                      {members} {members === 1 ? 'membro' : 'membros'}
                      {cycle.rankingVisibleToMembers && ' · ranking visível'}
                    </span>
                  </Link>
                  <span className={PHASE[phase].className}>{PHASE[phase].label}</span>
                  {cycle.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="btg-btn btg-btn--ghost btg-btn--sm"
                      onClick={() => setTarget(cycle)}
                      disabled={archive.isPending}
                      title="Arquivar ciclo"
                    >
                      <Icon name="archive" />
                      Arquivar
                    </button>
                  ) : (
                    <Link href={`${BTG_ADMIN_BASE}/cycle/${cycle.id}/resumo`} className="btg-btn btg-btn--ghost btg-btn--sm">
                      <Icon name="receipt_long" />
                      Resumo
                    </Link>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </main>

      <NewCycleModal open={newOpen} onClose={() => setNewOpen(false)} />
      <Confirm
        open={target !== null}
        title="Arquivar ciclo?"
        confirmLabel="Arquivar"
        busy={archive.isPending}
        onClose={() => setTarget(null)}
        onConfirm={() => target && archive.mutate(target.id, { onSuccess: () => setTarget(null) })}
      >
{archive.isError && (
          <div className="btg-notice btg-notice--bad" role="alert">
            <Icon name="error" />
            Não foi possível concluir: {archive.error instanceof Error ? archive.error.message : 'erro desconhecido'}.
          </div>
        )}
        Arquivar <strong>{target?.name}</strong>? Os membros mantêm todo o histórico, mas o ciclo deixa de aparecer como ativo.
      </Confirm>
    </>
  );
}
