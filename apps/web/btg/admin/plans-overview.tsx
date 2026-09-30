'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdminCycles } from '../../lib/queries/admin-cycles';
import { useAdminPlansOverview, type PlansOverviewStatus } from '../../lib/queries/admin-plans-overview';
import { resolveActiveCycleId } from '../../lib/cycle/active-cycle';
import { Avatar, Icon, Loading, relativeFromNow } from '../ui';
import { PLAN_STATUS, shortDate } from './cycles-ui';
import { BTG_ADMIN_BASE } from './shell';

const STATUS_OPTIONS: Array<{ value: PlansOverviewStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'published', label: 'Publicados' },
];
const isStatus = (v: string | null): v is PlansOverviewStatus => v === 'all' || v === 'draft' || v === 'published';
const BASE = `${BTG_ADMIN_BASE}/planos`;

export function BtgPlansOverview() {
  const router = useRouter();
  const params = useSearchParams();
  const cycleId = params.get('cycleId');
  const statusParam = params.get('status');
  const status: PlansOverviewStatus = isStatus(statusParam) ? statusParam : 'all';

  const { data: cycles, isLoading: cyclesLoading } = useAdminCycles();
  const { data, isLoading, error } = useAdminPlansOverview(cycleId, status);

  // Without ?cycleId, land on THE active cycle (same resolver as the backend rule).
  useEffect(() => {
    if (cycleId) return;
    const activeId = resolveActiveCycleId(cycles);
    if (!activeId) return;
    const next = new URLSearchParams(params.toString());
    next.set('cycleId', activeId);
    router.replace(`${BASE}?${next}`, { scroll: false });
  }, [cycleId, cycles, params, router]);

  function update(key: 'cycleId' | 'status', value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || (key === 'status' && value === 'all')) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${BASE}?${qs}` : BASE, { scroll: false });
  }

  const total = data?.weeks.reduce((s, w) => s + w.plans.length, 0) ?? 0;

  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          <span>
            {data ? `${data.cycle.name} · ${total} ${total === 1 ? 'plano' : 'planos'}` : 'Rascunhos e publicados, por semana'}
          </span>
          <span>Planos</span>
        </div>
      </header>

      <main className="btg-ac-main">
        <div className="btg-ac-filters">
          <label className="btg-field">
            Ciclo
            <select className="btg-select" value={cycleId ?? ''} onChange={(e) => update('cycleId', e.target.value || null)} disabled={cyclesLoading}>
              <option value="">Selecione um ciclo</option>
              {(cycles ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="btg-field">
            Status
            <select className="btg-select" value={status} onChange={(e) => update('status', e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        {!cycleId ? (
          <section className="btg-card btg-empty">Selecione um ciclo para ver os planos.</section>
        ) : isLoading ? (
          <Loading />
        ) : error ? (
          <section className="btg-notice btg-notice--bad">
            <Icon name="error" />
            Não foi possível carregar os planos · {(error as Error).message}
          </section>
        ) : !data || data.weeks.length === 0 ? (
          <section className="btg-card btg-empty">Nenhum plano neste ciclo ainda.</section>
        ) : (
          data.weeks.map((week) => (
            <section key={week.weekStart} className="btg-card">
              <div className="btg-card-head" style={{ padding: '14px 20px' }}>
                <span className="btg-card-title" style={{ fontSize: 16 }}>
                  <Icon name="date_range" style={{ color: 'var(--btg-secondary)' }} />
                  Semana de {shortDate(week.weekStart)} a {shortDate(week.weekEnd)}
                </span>
                <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>
                  {week.plans.length} {week.plans.length === 1 ? 'plano' : 'planos'}
                </span>
              </div>
              {week.plans.map((plan) => (
                <Link
                  key={plan.id}
                  href={`${BTG_ADMIN_BASE}/member/${plan.user.id}/plan/${plan.id}`}
                  className="btg-ac-row"
                >
                  <Avatar name={plan.user.name} pictureUrl={plan.user.pictureUrl} size="sm" />
                  <span className="btg-ac-grow">
                    <span style={{ fontSize: 15 }}>{plan.user.name}</span>
                    <span className="btg-ac-meta">
                      <span className="btg-mono">{plan.items.done}/{plan.items.total}</span> concluídos · {relativeFromNow(plan.lastActivityAt)}
                    </span>
                  </span>
                  <span className={plan.status === 'DRAFT' ? 'btg-pill btg-pill--neutral' : 'btg-pill'}>
                    {PLAN_STATUS[plan.status] ?? plan.status}
                  </span>
                  <Icon name="chevron_right" style={{ color: 'var(--btg-text-mute)' }} />
                </Link>
              ))}
            </section>
          ))
        )}
      </main>
    </>
  );
}
