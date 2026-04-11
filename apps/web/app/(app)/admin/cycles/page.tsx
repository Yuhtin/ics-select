'use client';

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
} from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '../../../../lib/api/client';
import { PageHeader } from '../../../../components/shell/page-header';
import { DataTable } from '../../../../components/ui/data-table';

type Cycle = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
};

export default function AdminCyclesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch<Cycle[]>('/cycles'),
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState({ name: '', startsAt: '', endsAt: '' });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      apiFetch<Cycle>('/cycles', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      onClose();
      setForm({ name: '', startsAt: '', endsAt: '' });
    },
  });

  return (
    <>
      <PageHeader
        title="Ciclos"
        description="Gerencie os ciclos do programa."
        actions={
          <Button
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            onPress={onOpen}
          >
            Novo ciclo
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-foreground-muted">Carregando ciclos...</p>
      ) : (
        <DataTable>
          <Table aria-label="Ciclos" removeWrapper>
            <TableHeader>
              <TableColumn>Nome</TableColumn>
              <TableColumn>Início</TableColumn>
              <TableColumn>Fim</TableColumn>
              <TableColumn>Status</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Nenhum ciclo ainda.">
              {(data ?? []).map((cycle) => (
                <TableRow key={cycle.id}>
                  <TableCell>
                    <Link
                      href={`/admin/cycles/${cycle.id}`}
                      className="font-medium text-foreground hover:text-brand transition-colors"
                    >
                      {cycle.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {new Date(cycle.startsAt).toLocaleDateString('pt-BR', {
                      timeZone: 'UTC',
                    })}
                  </TableCell>
                  <TableCell>
                    {new Date(cycle.endsAt).toLocaleDateString('pt-BR', {
                      timeZone: 'UTC',
                    })}
                  </TableCell>
                  <TableCell>{cycle.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      )}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Novo ciclo</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="Nome"
              placeholder="2026.1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              type="date"
              label="Início"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            />
            <Input
              type="date"
              label="Fim"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Cancelar
            </Button>
            <Button
              color="primary"
              isLoading={createMutation.isPending}
              onPress={() => createMutation.mutate(form)}
            >
              Criar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
