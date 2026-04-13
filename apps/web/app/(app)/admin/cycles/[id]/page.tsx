'use client';

import { use, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Chip,
  Input,
  Progress,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Download, Lock, Plus, Search, Trash2, Users, BookOpen, FileText } from 'lucide-react';
import Link from 'next/link';
import { apiFetch, getAccessToken } from '../../../../../lib/api/client';
import { StatCard } from '../../../../../components/admin/stat-card';

type User = { id: string; name: string; email: string; pictureUrl: string | null };
type Membership = { id: string; user: User };
type PlanItem = { status: string };
type WeeklyPlan = {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  _count: { items: number };
  items: PlanItem[];
};
type CycleDetail = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  memberships: Membership[];
  weeklyPlans?: WeeklyPlan[];
};
type MemberListItem = { id: string; name: string; email: string; pictureUrl: string | null };

type DisplayStatus = 'ACTIVE' | 'UPCOMING' | 'ENDED' | 'ARCHIVED';

function getDisplayStatus(c: { status: string; startsAt: string; endsAt: string }): DisplayStatus {
  if (c.status === 'ARCHIVED') return 'ARCHIVED';
  const now = new Date();
  if (new Date(c.startsAt) > now) return 'UPCOMING';
  if (new Date(c.endsAt) < now) return 'ENDED';
  return 'ACTIVE';
}

const statusConfig: Record<DisplayStatus, { label: string; color: 'primary' | 'warning' | 'danger' | 'default' }> = {
  ACTIVE: { label: 'Ativo', color: 'primary' },
  UPCOMING: { label: 'Futuro', color: 'warning' },
  ENDED: { label: 'Encerrado', color: 'danger' },
  ARCHIVED: { label: 'Arquivado', color: 'default' },
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));
  } catch { return iso; }
}

function formatDateFull(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
  } catch { return iso; }
}

export default function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [memberSearch, setMemberSearch] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cycle', id],
    queryFn: () => apiFetch<CycleDetail>(`/cycles/${id}`),
  });

  const { data: allMembers } = useQuery({
    queryKey: ['members'],
    queryFn: () => apiFetch<MemberListItem[]>('/members'),
    enabled: showAddMember,
  });

  const addMember = useMutation({
    mutationFn: (userId: string) => apiFetch(`/cycles/${id}/members`, { method: 'POST', body: JSON.stringify({ userId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle', id] });
      setMemberSearch('');
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => apiFetch(`/cycles/${id}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cycle', id] }),
  });

  const archiveCycle = useMutation({
    mutationFn: () => apiFetch(`/cycles/${id}/archive`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cycle', id] }),
  });

  const downloadReport = async () => {
    const token = getAccessToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/cycles/${id}/report`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${data?.name ?? id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Members not yet in this cycle (for the add dropdown)
  const existingMemberIds = useMemo(
    () => new Set(data?.memberships.map((m) => m.user.id) ?? []),
    [data?.memberships],
  );
  const availableMembers = useMemo(() => {
    if (!allMembers) return [];
    const filtered = allMembers.filter((m) => !existingMemberIds.has(m.id));
    if (!memberSearch.trim()) return filtered;
    const q = memberSearch.toLowerCase();
    return filtered.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [allMembers, existingMemberIds, memberSearch]);

  // Plans grouped by member
  const plansByMember = useMemo(() => {
    const map = new Map<string, WeeklyPlan[]>();
    for (const plan of data?.weeklyPlans ?? []) {
      const list = map.get(plan.userId) ?? [];
      list.push(plan);
      map.set(plan.userId, list);
    }
    return map;
  }, [data?.weeklyPlans]);

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-64 skeleton-pulse rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-5 h-24 skeleton-pulse" />
          ))}
        </div>
        <div className="glass rounded-xl h-48 skeleton-pulse" />
      </div>
    );
  }

  const displayStatus = getDisplayStatus(data);
  const cfg = statusConfig[displayStatus];
  const members = data.memberships;
  const totalPlans = data.weeklyPlans?.length ?? 0;
  const doneItems = data.weeklyPlans?.flatMap((p) => p.items).filter((i) => i.status === 'DONE').length ?? 0;
  const totalItems = data.weeklyPlans?.flatMap((p) => p.items).length ?? 0;
  const avgProgress = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
            <Chip size="sm" color={cfg.color} variant="flat">
              {cfg.label}
            </Chip>
          </div>
          <p className="text-sm text-foreground-muted mt-1 flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDateFull(data.startsAt)} — {formatDateFull(data.endsAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="bordered" startContent={<Download className="h-4 w-4" />} onPress={downloadReport}>
            Relatorio
          </Button>
          {data.status === 'ACTIVE' && (
            <Button color="danger" variant="light" onPress={() => archiveCycle.mutate()} isLoading={archiveCycle.isPending}>
              Arquivar
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Membros" value={members.length} />
        <StatCard icon={FileText} label="Planos semanais" value={totalPlans} />
        <StatCard icon={BookOpen} label="Itens concluidos" value={`${doneItems}/${totalItems}`} />
        <StatCard icon={Calendar} label="Progresso medio" value={`${avgProgress}%`} />
      </div>

      {/* Members section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Membros ({members.length})</h2>
          <Button
            size="sm"
            color="primary"
            variant={showAddMember ? 'flat' : 'bordered'}
            startContent={<Plus className="h-4 w-4" />}
            onPress={() => setShowAddMember(!showAddMember)}
          >
            Adicionar membro
          </Button>
        </div>

        {/* Add member panel */}
        {showAddMember && (
          <div className="glass rounded-xl">
            <div className="p-4 space-y-3">
              <Input
                placeholder="Buscar por nome ou email..."
                value={memberSearch}
                onValueChange={setMemberSearch}
                startContent={<Search className="h-4 w-4 text-foreground-muted" />}
                size="sm"
              />
              {availableMembers.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {availableMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-subtle transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={m.pictureUrl ?? undefined} name={m.name.charAt(0)} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-foreground-muted">{m.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        isLoading={addMember.isPending}
                        onPress={() => addMember.mutate(m.id)}
                      >
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-foreground-muted text-center py-2">
                  {allMembers ? 'Nenhum membro disponivel.' : 'Carregando...'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Members table with plans */}
        <div className="space-y-3">
          {members.map((m) => {
            const userPlans = plansByMember.get(m.user.id) ?? [];
            const userDone = userPlans.flatMap((p) => p.items).filter((i) => i.status === 'DONE').length;
            const userTotal = userPlans.flatMap((p) => p.items).length;
            const userPct = userTotal === 0 ? 0 : Math.round((userDone / userTotal) * 100);

            return (
              <div key={m.id} className="glass rounded-xl">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Member info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={m.user.pictureUrl ?? undefined} name={m.user.name.charAt(0)} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{m.user.name}</p>
                        <p className="text-xs text-foreground-muted truncate">{m.user.email}</p>
                      </div>
                    </div>

                    {/* Plan stats */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {userPlans.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs text-foreground-muted">{userPlans.length} plano{userPlans.length !== 1 ? 's' : ''}</p>
                            <p className="text-xs font-medium text-foreground">{userPct}% concluido</p>
                          </div>
                          <Progress value={userPct} color="primary" size="sm" className="w-20" />
                        </div>
                      ) : (
                        <span className="text-xs text-foreground-muted">Sem planos</span>
                      )}

                      <Button
                        as={Link}
                        href={`/admin/plans/${m.user.id}`}
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<Plus className="h-3 w-3" />}
                      >
                        Plano
                      </Button>

                      <Button
                        size="sm"
                        color="danger"
                        variant="light"
                        isIconOnly
                        onPress={() => removeMember.mutate(m.user.id)}
                        aria-label="Remover membro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Inline plan list */}
                  {userPlans.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex flex-wrap gap-2">
                        {userPlans.map((p) => {
                          const pDone = p.items.filter((i) => i.status === 'DONE').length;
                          const pTotal = p.items.length;
                          const pPct = pTotal === 0 ? 0 : Math.round((pDone / pTotal) * 100);
                          return (
                            <Chip
                              key={p.id}
                              size="sm"
                              variant="flat"
                              color={p.status === 'PUBLISHED' ? (pPct === 100 ? 'success' : 'primary') : 'default'}
                            >
                              {formatDate(p.weekStart)} — {formatDate(p.weekEnd)} ({pPct}%)
                            </Chip>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="text-center py-8">
              <p className="text-foreground-muted text-sm">Nenhum membro neste ciclo.</p>
              <p className="text-foreground-muted text-xs mt-1">Use o botao acima para adicionar membros.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
