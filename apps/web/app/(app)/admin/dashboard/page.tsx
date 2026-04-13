'use client';

import { AlertTriangle, CheckCircle, TrendingUp, Users } from 'lucide-react';
import { Avatar, Chip, Progress, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api/client';
import { StatCard } from '../../../../components/admin/stat-card';
import { AlertList } from '../../../../components/admin/alert-list';

type Member = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: { plansCount: number; doneItems: number; stuckItems: number; totalItems?: number };
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiFetch<Member[]>('/admin/dashboard'),
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="h-8 w-48 skeleton-pulse rounded-lg" />
          <div className="h-4 w-64 skeleton-pulse rounded-lg mt-2" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-5 h-24 skeleton-pulse" />
          ))}
        </div>
        <div className="h-4 w-32 skeleton-pulse rounded-lg" />
        <div className="glass rounded-xl h-48 skeleton-pulse" />
      </div>
    );
  }

  const members = (data ?? []).filter((m) => m.role === 'MEMBER');
  const totalMembers = members.length;
  const totalDone = members.reduce((s, m) => s + m.stats.doneItems, 0);
  const totalItems = members.reduce((s, m) => s + (m.stats.totalItems ?? m.stats.doneItems + m.stats.stuckItems), 0);
  const avgProgress = totalItems === 0 ? 0 : Math.round((totalDone / totalItems) * 100);
  const stuckCount = members.filter((m) => m.stats.stuckItems > 0).length;
  const onTrack = members.filter((m) => m.stats.stuckItems === 0 && m.stats.doneItems > 0).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-foreground-muted mt-1">Visao geral do ciclo ativo</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Progresso medio" value={`${avgProgress}%`} />
        <StatCard icon={Users} label="Membros" value={totalMembers} />
        <StatCard icon={CheckCircle} label="On track" value={onTrack} iconClassName="text-success" />
        <StatCard icon={AlertTriangle} label="Travados" value={stuckCount} iconClassName="text-danger" />
      </div>

      <div>
        <h2 className="text-base font-bold text-foreground mb-3">Alertas</h2>
        <AlertList members={members} />
      </div>

      <div>
        <h2 className="text-base font-bold text-foreground mb-3">Membros</h2>
        <div className="glass rounded-xl overflow-hidden">
        <Table aria-label="Membros do ciclo" shadow="none" isStriped>
          <TableHeader>
            <TableColumn>Membro</TableColumn>
            <TableColumn>Progresso</TableColumn>
            <TableColumn>Modulos</TableColumn>
            <TableColumn>Status</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Nenhum membro no ciclo.">
            {members.map((m) => {
              const total = m.stats.totalItems ?? m.stats.doneItems + m.stats.stuckItems;
              const pct = total === 0 ? 0 : Math.round((m.stats.doneItems / total) * 100);
              const statusColor = m.stats.stuckItems > 0 ? 'danger' : m.stats.doneItems > 0 ? 'success' : 'warning';
              const statusLabel = m.stats.stuckItems > 0 ? 'Travou' : m.stats.doneItems > 0 ? 'On track' : 'Atrasado';
              return (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => router.push(`/admin/plans/${m.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar src={m.pictureUrl ?? undefined} name={m.name.charAt(0)} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-foreground-muted">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-32">
                      <Progress value={pct} color="primary" size="sm" />
                      <p className="text-xs text-foreground-muted mt-0.5">{pct}%</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{m.stats.doneItems}/{total}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color={statusColor} variant="flat">{statusLabel}</Chip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
