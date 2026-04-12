'use client';

import { Rocket, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api/client';

type Member = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: { plansCount: number; doneItems: number; stuckItems: number };
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiFetch<Member[]>('/admin/dashboard'),
  });

  if (isLoading) {
    return <p className="text-sm text-foreground-muted">Carregando dashboard...</p>;
  }

  const members = (data ?? []).filter((m) => m.role === 'MEMBER');
  const totalMembers = members.length;
  const totalDone = members.reduce((s, m) => s + m.stats.doneItems, 0);
  const totalStuck = members.reduce((s, m) => s + m.stats.stuckItems, 0);
  const totalItems = totalDone + totalStuck;
  const avgProgress = totalItems === 0 ? 0 : Math.round((totalDone / totalItems) * 100);

  const onTrack = members.filter((m) => m.stats.stuckItems === 0 && m.stats.doneItems > 0).length;
  const stuck = members.filter((m) => m.stats.stuckItems > 0).length;
  const reviewing = members.filter((m) => m.stats.doneItems === 0 && m.stats.stuckItems === 0).length;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-surface border border-border rounded-xl p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="z-10">
            <span className="text-xs font-bold uppercase tracking-widest text-brand mb-2 block">
              Performance Atual
            </span>
            <h1 className="text-4xl font-extrabold text-foreground mb-2 tracking-tight">
              Dashboard do Ciclo
            </h1>
            <p className="text-foreground-muted max-w-md">
              Visão geral em tempo real da cohort ICS Select. Acompanhe o progresso dos membros e identifique alertas.
            </p>
          </div>
          <div className="flex items-center gap-6 mt-8 z-10">
            <div className="flex flex-col">
              <span className="text-3xl font-extrabold text-foreground">{avgProgress}%</span>
              <span className="text-xs text-foreground-subtle">Progresso Médio</span>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="flex flex-col">
              <span className="text-3xl font-extrabold text-foreground">{String(totalMembers).padStart(2, '0')}</span>
              <span className="text-xs text-foreground-subtle">Membros</span>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="flex flex-col">
              <span className="text-3xl font-extrabold text-danger">{String(totalStuck).padStart(2, '0')}</span>
              <span className="text-xs text-foreground-subtle">Alertas</span>
            </div>
          </div>
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-brand/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        </div>

        <div className="bg-brand p-8 rounded-xl text-white flex flex-col justify-between">
          <div>
            <Rocket className="h-10 w-10 mb-4" aria-hidden="true" />
            <h3 className="text-xl font-bold">Elite Status</h3>
            <p className="text-white/70 text-sm mt-2">
              A cohort possui {totalMembers} membros ativos com {avgProgress}% de progresso médio no ciclo atual.
            </p>
          </div>
          <button
            type="button"
            className="bg-white text-brand px-4 py-2.5 rounded-lg font-bold text-sm w-fit shadow-lg mt-6 hover:bg-white/90 transition-colors"
          >
            Gerar Relatório
          </button>
        </div>
      </section>

      {/* Status Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusMetric label="On Track" value={onTrack} badge="Healthy" badgeColor="emerald" />
        <StatusMetric label="Revisando" value={reviewing} badge="Em dia" badgeColor="blue" />
        <StatusMetric label="Atrasado" value={0} badge="Warning" badgeColor="amber" />
        <StatusMetric label="Travei" value={stuck} badge="Critical" badgeColor="red" />
      </div>

      {/* Member Directory */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground">Member Directory</h2>
          <p className="text-xs text-foreground-muted">{totalMembers} membros</p>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-foreground-muted italic">Nenhum membro cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {members.map((m) => {
              const memberTotal = m.stats.doneItems + m.stats.stuckItems;
              const memberProgress = memberTotal === 0 ? 0 : Math.round((m.stats.doneItems / memberTotal) * 100);
              const isStuck = m.stats.stuckItems > 0;
              const initial = m.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => router.push(`/admin/members/${m.id}`)}
                  className={`bg-surface border p-5 rounded-xl text-left transition-shadow hover:shadow-md ${
                    isStuck ? 'border-danger/20 ring-1 ring-danger/5 shadow-sm' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    {m.pictureUrl ? (
                      <img src={m.pictureUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-surface-subtle flex items-center justify-center font-bold text-foreground-subtle text-xs">
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-foreground truncate">{m.name}</h4>
                      <span className="text-[10px] text-foreground-subtle uppercase font-bold tracking-tight truncate block">
                        {m.email.split('@')[0]}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-foreground-muted uppercase">Progresso</span>
                      <span className={isStuck ? 'text-danger' : 'text-brand'}>{memberProgress}%</span>
                    </div>
                    <div className="w-full bg-surface-subtle h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isStuck ? 'bg-danger' : 'bg-brand'}`}
                        style={{ width: `${memberProgress}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {isStuck ? (
                        <span className="text-[10px] bg-danger-soft text-danger px-2 py-0.5 rounded-full font-bold">
                          Travei
                        </span>
                      ) : memberProgress > 0 ? (
                        <span className="text-[10px] bg-success-soft text-success px-2 py-0.5 rounded-full font-semibold">
                          On Track
                        </span>
                      ) : (
                        <span className="text-[10px] bg-surface-subtle text-foreground-muted px-2 py-0.5 rounded-full font-semibold">
                          Sem dados
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusMetric({
  label,
  value,
  badge,
  badgeColor,
}: {
  label: string;
  value: number;
  badge: string;
  badgeColor: 'emerald' | 'blue' | 'amber' | 'red';
}) {
  const colors = {
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-danger bg-danger-soft',
  };

  return (
    <div className="bg-surface-muted p-5 rounded-lg border border-border">
      <div className="flex justify-between items-start mb-2">
        <span className="text-foreground-muted text-xs font-semibold uppercase">{label}</span>
        <span className={`${colors[badgeColor]} px-2 py-0.5 rounded text-[10px] font-bold`}>{badge}</span>
      </div>
      <div className="text-2xl font-extrabold text-foreground">{String(value).padStart(2, '0')}</div>
    </div>
  );
}
