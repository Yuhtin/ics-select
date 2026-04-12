'use client';

import { Button, useDisclosure } from '@heroui/react';
import { Plus } from 'lucide-react';
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
  memberships?: Array<{ id: string }>;
};

export default function CyclesPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { data, isLoading } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch<Cycle[]>('/cycles'),
  });

  if (isLoading) {
    return <p className="text-sm text-foreground-muted">Carregando ciclos...</p>;
  }

  const cycles = data ?? [];
  const active = cycles.filter((c) => c.status === 'ACTIVE');
  const archived = cycles.filter((c) => c.status === 'ARCHIVED');

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

      {active.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-foreground mb-3">Ativos</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {active.map((c) => (
              <CycleCard
                key={c.id}
                id={c.id}
                name={c.name}
                startsAt={c.startsAt}
                endsAt={c.endsAt}
                status={c.status}
                memberCount={c.memberships?.length ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-foreground mb-3">Arquivados</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {archived.map((c) => (
              <CycleCard
                key={c.id}
                id={c.id}
                name={c.name}
                startsAt={c.startsAt}
                endsAt={c.endsAt}
                status={c.status}
                memberCount={c.memberships?.length ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {cycles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-foreground-muted">Nenhum ciclo ainda.</p>
          <Button color="primary" className="mt-4" onPress={onOpen}>Criar primeiro ciclo</Button>
        </div>
      )}

      <CreateCycleModal isOpen={isOpen} onClose={onClose} />
    </div>
  );
}
