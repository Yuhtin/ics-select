'use client';

import { Activity, AlertTriangle, BookOpen, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api/client';
import { PageHeader } from '../../../../components/shell/page-header';
import { StatCard } from '../../../../components/ui/stat-card';
import { MemberCard } from '../../../../components/ui/member-card';

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
  const totalPlans = members.reduce((sum, m) => sum + m.stats.plansCount, 0);
  const totalDone = members.reduce((sum, m) => sum + m.stats.doneItems, 0);
  const totalStuck = members.reduce((sum, m) => sum + m.stats.stuckItems, 0);

  return (
    <>
      <PageHeader
        eyebrow="Visão do administrador"
        title="Dashboard"
        description="Acompanhe o progresso do ciclo atual e o engajamento dos membros."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Membros ativos" value={totalMembers} />
        <StatCard icon={BookOpen} label="Planos atribuídos" value={totalPlans} />
        <StatCard icon={Activity} label="Itens concluídos" value={totalDone} />
        <StatCard
          icon={AlertTriangle}
          label="Itens travados"
          value={totalStuck}
        />
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            Membros do ciclo
          </h2>
          <p className="text-sm text-foreground-muted">
            {totalMembers} {totalMembers === 1 ? 'membro' : 'membros'}
          </p>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-foreground-muted italic">
            Nenhum membro cadastrado ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={{
                  id: m.id,
                  name: m.name,
                  email: m.email,
                  avatarUrl: m.pictureUrl,
                }}
                stats={{
                  done: m.stats.doneItems,
                  stuck: m.stats.stuckItems,
                }}
                onViewPlan={() => router.push(`/admin/members/${m.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
