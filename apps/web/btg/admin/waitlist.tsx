'use client';

import { useState } from 'react';
import { getAccessToken } from '../../lib/api/client';
import { useWaitlistConfig, useWaitlistList, useWaitlistStats } from '../../lib/queries/waitlist';
import type { WaitlistFilters } from '../../lib/waitlist/api';
import { WAITLIST_COURSES, courseToLabel } from '../../lib/waitlist/course';
import { Icon, Loading } from '../ui';

// The classic page links straight to the export URL; a plain link carries no
// Authorization header, so fetch it with the session token and save the blob.
async function downloadCsv() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const token = getAccessToken();
  const res = await fetch(`${base}/admin/waitlist/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Falha ao exportar (${res.status})`);
  const csv = await res.text();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `waitlist-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const numOrUndef = (raw: string) => {
  const n = raw === '' ? undefined : Number(raw);
  return n !== undefined && Number.isFinite(n) ? n : undefined;
};

export function BtgWaitlist() {
  const [filters, setFilters] = useState<WaitlistFilters>({ page: 1, pageSize: 50 });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { data, isLoading } = useWaitlistList(filters);
  const { data: stats } = useWaitlistStats();
  const { data: config } = useWaitlistConfig();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const patch = (p: Partial<WaitlistFilters>) => setFilters({ ...filters, ...p, page: 1 });

  const skillTotal = stats?.bySkill.reduce((s, b) => s + b.count, 0) ?? 0;
  const kpis = [
    { icon: 'group_add', label: 'Total de inscritos', value: stats?.total },
    { icon: 'trending_up', label: 'Últimos 7 dias', value: stats?.last7d },
    { icon: 'school', label: 'Cursos distintos', value: stats?.byCourse.filter((c) => c.count > 0).length },
    {
      icon: 'insights',
      label: 'Skill médio',
      value: skillTotal ? (stats!.bySkill.reduce((s, b) => s + b.skillLevel * b.count, 0) / skillTotal).toFixed(1) : undefined,
    },
  ];

  async function onExport() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Falha ao exportar.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          <span>Lista de espera · {config?.cycleTarget ? `Ciclo ${config.cycleTarget}` : 'Próximo ciclo'}</span>
          <span>Inscritos</span>
        </div>
        <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={() => void onExport()} disabled={exporting}>
          <Icon name="download" />
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </header>

      <main className="btg-al-main">
        {exportError && (
          <div className="btg-notice btg-notice--bad">
            <Icon name="error" />
            {exportError}
          </div>
        )}
        <div className="btg-kpis">
          {kpis.map((k) => (
            <div key={k.label} className="btg-card btg-kpi">
              <span className="btg-kpi-label"><Icon name={k.icon} />{k.label}</span>
              <span className="btg-mono btg-kpi-value">{k.value ?? '—'}</span>
            </div>
          ))}
        </div>

        <section className="btg-card btg-al-filters">
          <div className="btg-al-chips">
            {WAITLIST_COURSES.map((c) => (
              <button
                key={c}
                type="button"
                className="btg-al-chip"
                aria-pressed={filters.course === c}
                onClick={() => patch({ course: filters.course === c ? undefined : c })}
              >
                {courseToLabel(c)}
                {stats && <span className="btg-mono btg-mute">{stats.byCourse.find((b) => b.course === c)?.count ?? 0}</span>}
              </button>
            ))}
          </div>
          <div className="btg-al-filter-row">
            <label className="btg-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              Skill mín.
              <input className="btg-input btg-mono btg-al-num" type="number" min={1} max={5} value={filters.skillMin ?? ''} onChange={(e) => patch({ skillMin: numOrUndef(e.target.value) })} />
            </label>
            <label className="btg-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              Skill máx.
              <input className="btg-input btg-mono btg-al-num" type="number" min={1} max={5} value={filters.skillMax ?? ''} onChange={(e) => patch({ skillMax: numOrUndef(e.target.value) })} />
            </label>
            <div className="btg-al-search" style={{ flex: '1 1 240px' }}>
              <Icon name="search" />
              <input
                className="btg-input"
                type="search"
                placeholder="Nome ou email"
                aria-label="Buscar inscritos"
                value={filters.q ?? ''}
                onChange={(e) => patch({ q: e.target.value || undefined })}
              />
            </div>
          </div>
        </section>

        <section className="btg-card">
          {isLoading ? (
            <Loading />
          ) : (data?.items ?? []).length === 0 ? (
            <p className="btg-empty">Nenhum inscrito.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="btg-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Curso</th>
                    <th>Ano</th>
                    <th>Skill</th>
                    <th>Links</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((r) => (
                    <tr key={r.id}>
                      <td className="btg-mono btg-mute" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                        {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.name}</td>
                      <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                      <td className="btg-soft" style={{ whiteSpace: 'nowrap' }}>{courseToLabel(r.course)}</td>
                      <td className="btg-mono btg-soft">{r.year}º</td>
                      <td>
                        <span className="btg-al-skill" role="img" aria-label={`Skill ${r.skillLevel} de 5`} title={`${r.skillLevel}/5`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} data-on={n <= r.skillLevel} />
                          ))}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                        {r.github && <a href={r.github} target="_blank" rel="noreferrer">GitHub</a>}
                        {r.github && r.linkedin && <span className="btg-mute"> · </span>}
                        {r.linkedin && <a href={r.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && data.total > data.pageSize && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--btg-border)' }}>
              <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total)} de {data.total}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" disabled={page <= 1} onClick={() => setFilters({ ...filters, page: Math.max(1, page - 1) })}>
                  <Icon name="chevron_left" />
                  Anterior
                </button>
                <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" disabled={page * pageSize >= data.total} onClick={() => setFilters({ ...filters, page: page + 1 })}>
                  Próxima
                  <Icon name="chevron_right" />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
