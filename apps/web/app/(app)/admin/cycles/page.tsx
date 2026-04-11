'use client';

import { Button, Card, CardBody, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useDisclosure } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '../../../../lib/api/client';

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
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ciclos</h1>
        <Button color="primary" onPress={onOpen}>
          Novo ciclo
        </Button>
      </div>
      <Card>
        <CardBody>
          {isLoading ? (
            <p>Carregando...</p>
          ) : (
            <Table aria-label="Ciclos">
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
                      <Link href={`/admin/cycles/${cycle.id}`} className="font-medium">
                        {cycle.name}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(cycle.startsAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{new Date(cycle.endsAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{cycle.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

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
    </div>
  );
}
