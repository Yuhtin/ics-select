'use client';

import { Button, useDisclosure } from '@heroui/react';
import { Calendar, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../lib/api/client';
import { CycleCard } from '../../../../components/admin/cycle-card';
import { CreateCycleModal } from '../../../../components/admin/create-cycle-modal';

type Cycle = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
  _count?: { memberships: number };
};

type DisplayStatus = 'ACTIVE' | 'UPCOMING' | 'ENDED' | 'ARCHIVED';

function getDisplayStatus(c: Cycle): DisplayStatus {
  if (c.status === 'ARCHIVED') return 'ARCHIVED';
  const now = new Date();
  if (new Date(c.startsAt) > now) return 'UPCOMING';
  if (new Date(c.endsAt) < now) return 'ENDED';
  return 'ACTIVE';
}

export default function CyclesPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { data, isLoading } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch<Cycle[]>('/cycles'),
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-32 skeleton-pulse rounded-lg" />
            <div className="h-4 w-56 skeleton-pulse rounded-lg mt-2" />
          </div>
          <div className="h-10 w-32 skeleton-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-6 h-44 skeleton-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const cycles = data ?? [];
  const withDisplay = cycles.map((c) => ({ ...c, displayStatus: getDisplayStatus(c) }));
  const active = withDisplay.filter((c) => c.displayStatus === 'ACTIVE');
  const upcoming = withDisplay.filter((c) => c.displayStatus === 'UPCOMING');
  const ended = withDisplay.filter((c) => c.displayStatus === 'ENDED');
  const archived = withDisplay.filter((c) => c.displayStatus === 'ARCHIVED');

  const renderSection = (title: string, items: typeof withDisplay) =>
    items.length > 0 ? (
      <div>
        <h2 className="text-base font-bold text-foreground mb-3">{title}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((c) => (
            <CycleCard
              key={c.id}
              id={c.id}
              name={c.name}
              startsAt={c.startsAt}
              endsAt={c.endsAt}
              displayStatus={c.displayStatus}
              memberCount={c._count?.memberships ?? 0}
            />
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ciclos</h1>
          <p className="text-sm text-foreground-muted mt-1">Gerencie os ciclos do programa</p>
        </div>
        <Button color="primary" startContent={<Plus className="h-4 w-4" />} onPress={onOpen}>
          Novo ciclo
        </Button>
      </div>

      {renderSection('Ativos', active)}
      {renderSection('Futuros', upcoming)}
      {renderSection('Encerrados', ended)}
      {renderSection('Arquivados', archived)}

      {cycles.length === 0 && (
        <div className="glass rounded-xl text-center py-16 px-8">
          <div className="h-12 w-12 rounded-xl bg-brand-soft flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-6 w-6 text-brand" />
          </div>
          <p className="text-foreground-muted font-medium">Nenhum ciclo ainda.</p>
          <p className="text-foreground-subtle text-sm mt-1">Crie o primeiro ciclo para comecar a gerenciar o programa.</p>
          <Button color="primary" className="mt-6" onPress={onOpen}>Criar primeiro ciclo</Button>
        </div>
      )}

      <CreateCycleModal isOpen={isOpen} onClose={onClose} />
    </div>
  );
}
