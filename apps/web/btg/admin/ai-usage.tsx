'use client';

import { useMemo, useState } from 'react';
import { useAdminAiUsage, type AiUsageRow } from '../../lib/queries/admin-ai-usage';
import { Icon, Loading } from '../ui';

type Range = 7 | 30 | 90;
const DAY = 86_400_000;

const PURPOSE: Record<string, string> = {
  'draft-plan': 'Rascunho de plano',
  'brief-plan': 'Resumo do plano',
  diagnose: 'Diagnóstico',
  chat: 'Chat',
};

const usd = (n: number) => `US$ ${n.toFixed(n < 1 ? 4 : 2)}`;
const int = (n: number) => n.toLocaleString('pt-BR');
const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const utcKey = (d: Date) => d.toISOString().slice(0, 10);

// One bar per UTC day in the range (empty days included, so gaps read as gaps).
function daily(rows: AiUsageRow[], range: Range) {
  const byDay = new Map<string, { cost: number; calls: number }>();
  for (const r of rows) {
    const k = utcKey(new Date(r.createdAt));
    const cur = byDay.get(k) ?? { cost: 0, calls: 0 };
    cur.cost += Number(r.costUsd);
    cur.calls += 1;
    byDay.set(k, cur);
  }
  const today = Date.now();
  return Array.from({ length: range }, (_, i) => {
    const key = utcKey(new Date(today - (range - 1 - i) * DAY));
    return { key, ...(byDay.get(key) ?? { cost: 0, calls: 0 }) };
  });
}

export function BtgAiUsage() {
  const [range, setRange] = useState<Range>(30);
  const { data, isLoading } = useAdminAiUsage(range);
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const totalCost = data?.totalCost ?? 0;
  const totalTokens = rows.reduce((s, r) => s + r.promptTokens + r.responseTokens, 0);
  const days = useMemo(() => daily(rows, range), [rows, range]);
  const maxCost = Math.max(0.0001, ...days.map((d) => d.cost));
  const labelEvery = Math.max(1, Math.floor(days.length / 8));

  const byPurpose = useMemo(() => {
    const m = new Map<string, { cost: number; calls: number }>();
    for (const r of rows) {
      const cur = m.get(r.purpose) ?? { cost: 0, calls: 0 };
      cur.cost += Number(r.costUsd);
      cur.calls += 1;
      m.set(r.purpose, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost);
  }, [rows]);

  const kpis = [
    { icon: 'payments', label: `Custo · ${range} dias`, value: usd(totalCost) },
    { icon: 'token', label: 'Tokens', value: int(totalTokens) },
    { icon: 'bolt', label: 'Chamadas', value: int(rows.length) },
    { icon: 'avg_pace', label: 'Custo médio por chamada', value: rows.length ? usd(totalCost / rows.length) : '—' },
  ];

  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          <span>OpenAI · gpt-6-luna</span>
          <span>Uso de IA</span>
        </div>
        <div className="btg-al-seg" role="group" aria-label="Período">
          {([7, 30, 90] as Range[]).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              <span className="btg-mono">{r}</span> dias
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <Loading />
      ) : (
        <main className="btg-admin-main">
          <div className="btg-stack">
            <div className="btg-kpis">
              {kpis.map((k) => (
                <div key={k.label} className="btg-card btg-kpi">
                  <span className="btg-kpi-label"><Icon name={k.icon} />{k.label}</span>
                  <span className="btg-mono btg-kpi-value">{k.value}</span>
                </div>
              ))}
            </div>

            <section className="btg-card btg-card--pad" style={{ padding: '16px 20px' }}>
              <span className="btg-card-title">Custo diário</span>
              {rows.length === 0 ? (
                <div className="btg-al-empty">Nenhum uso de IA neste período.</div>
              ) : (
                <div>
                  <div className="btg-al-bars" role="img" aria-label={`Custo diário dos últimos ${range} dias`}>
                    {days.map((d) => (
                      <span
                        key={d.key}
                        data-zero={d.cost === 0}
                        style={{ height: `${Math.max(2, (d.cost / maxCost) * 100)}%` }}
                        title={`${dayLabel(d.key)} · ${usd(d.cost)} · ${d.calls} ${d.calls === 1 ? 'chamada' : 'chamadas'}`}
                      />
                    ))}
                  </div>
                  <div className="btg-al-axis btg-mono" style={{ marginTop: 6 }}>
                    {days.map((d, i) => (
                      <span key={d.key} style={{ visibility: i % labelEvery === 0 ? 'visible' : 'hidden' }}>
                        {dayLabel(d.key)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="btg-card">
              <div className="btg-card-head" style={{ padding: '16px 20px' }}>
                <span className="btg-card-title">Chamadas</span>
                <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>{int(rows.length)}</span>
              </div>
              {rows.length === 0 ? (
                <p className="btg-empty">Nenhum uso ainda.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="btg-table">
                    <thead>
                      <tr>
                        <th>Quando</th>
                        <th>Finalidade</th>
                        <th className="btg-al-hide-sm">Modelo</th>
                        <th style={{ textAlign: 'right' }} className="btg-al-hide-sm">Prompt</th>
                        <th style={{ textAlign: 'right' }} className="btg-al-hide-sm">Resposta</th>
                        <th style={{ textAlign: 'right' }}>Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r) => (
                        <tr key={r.id}>
                          <td className="btg-mono btg-mute" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{dayLabel(utcKey(new Date(r.createdAt)))}</td>
                          <td>{PURPOSE[r.purpose] ?? r.purpose}</td>
                          <td className="btg-mono btg-soft btg-al-hide-sm" style={{ fontSize: 13 }}>{r.model}</td>
                          <td className="btg-mono btg-mute btg-al-hide-sm" style={{ fontSize: 13, textAlign: 'right' }}>{int(r.promptTokens)}</td>
                          <td className="btg-mono btg-mute btg-al-hide-sm" style={{ fontSize: 13, textAlign: 'right' }}>{int(r.responseTokens)}</td>
                          <td className="btg-mono" style={{ fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap' }}>{usd(Number(r.costUsd))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.length > 50 && (
                <p className="btg-mute" style={{ fontSize: 13, padding: '12px 20px', borderTop: '1px solid var(--btg-border)' }}>
                  Mostrando as <span className="btg-mono">50</span> primeiras de <span className="btg-mono">{int(rows.length)}</span>.
                </p>
              )}
            </section>
          </div>

          <aside className="btg-card btg-card--pad" style={{ padding: 20, gap: 16 }}>
            <span className="btg-card-title">Custo por finalidade</span>
            {byPurpose.length === 0 && <span className="btg-mute" style={{ fontSize: 14 }}>Sem chamadas no período.</span>}
            {byPurpose.map(([purpose, v]) => (
              <div key={purpose} className="btg-al-hbar">
                <div className="btg-al-hbar-top">
                  <span>{PURPOSE[purpose] ?? purpose}</span>
                  <span className="btg-mono">{usd(v.cost)}</span>
                </div>
                <div className="btg-track">
                  <div style={{ width: `${totalCost > 0 ? (v.cost / totalCost) * 100 : 0}%` }} />
                </div>
                <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>
                  {int(v.calls)} {v.calls === 1 ? 'chamada' : 'chamadas'} · {totalCost > 0 ? Math.round((v.cost / totalCost) * 100) : 0}%
                </span>
              </div>
            ))}
          </aside>
        </main>
      )}
    </>
  );
}
