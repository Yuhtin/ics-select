'use client';

import { use } from 'react';
import { Avatar, Button, Card, CardBody, Chip, Progress, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Download, Trash2, Users } from 'lucide-react';
import { apiFetch, getAccessToken } from '../../../../../lib/api/client';
import { StatCard } from '../../../../../components/admin/stat-card';

type CycleDetail = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  memberships: Array<{
    id: string;
    user: { id: string; name: string; email: string; pictureUrl: string | null };
  }>;
  weeklyPlans?: Array<{
    id: string;
    userId: string;
    weekStart: string;
    weekEnd: string;
    status: string;
    items: Array<{ id: string; status: string }>;
  }>;
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));
  } catch { return iso; }
}

export default function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cycle', id],
    queryFn: () => apiFetch<CycleDetail>(`/cycles/${id}`),
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

  if (isLoading || !data) {
    return <p className="text-sm text-foreground-muted">Carregando ciclo...</p>;
  }

  const members = data.memberships;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
            <Chip size="sm" color={data.status === 'ACTIVE' ? 'primary' : 'default'} variant="flat">
              {data.status === 'ACTIVE' ? 'Ativo' : 'Arquivado'}
            </Chip>
          </div>
          <p className="text-sm text-foreground-muted mt-1 flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDate(data.startsAt)} — {formatDate(data.endsAt)}
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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Membros" value={members.length} />
        <StatCard icon={Calendar} label="Status" value={data.status === 'ACTIVE' ? 'Ativo' : 'Arquivado'} />
      </div>

      <div>
        <h2 className="text-base font-bold text-foreground mb-3">Membros</h2>
        <Table aria-label="Membros do ciclo" shadow="sm">
          <TableHeader>
            <TableColumn>Membro</TableColumn>
            <TableColumn>Email</TableColumn>
            <TableColumn>Acoes</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Nenhum membro neste ciclo.">
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar src={m.user.pictureUrl ?? undefined} name={m.user.name.charAt(0)} size="sm" />
                    <span className="text-sm font-medium">{m.user.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground-muted">{m.user.email}</span>
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
