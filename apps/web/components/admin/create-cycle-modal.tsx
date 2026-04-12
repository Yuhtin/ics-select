'use client';

import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';

interface CreateCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateCycleModal({ isOpen, onClose }: CreateCycleModalProps) {
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch('/cycles', {
        method: 'POST',
        body: JSON.stringify({ name, startsAt, endsAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      setName('');
      setStartsAt('');
      setEndsAt('');
      onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" backdrop="opaque">
      <ModalContent>
        <ModalHeader>Novo ciclo</ModalHeader>
        <ModalBody className="space-y-4">
          <Input
            label="Nome"
            placeholder="Ex: Ciclo 2026.1"
            value={name}
            onValueChange={setName}
            variant="bordered"
          />
          <Input
            label="Inicio"
            type="date"
            value={startsAt}
            onValueChange={setStartsAt}
            variant="bordered"
          />
          <Input
            label="Fim"
            type="date"
            value={endsAt}
            onValueChange={setEndsAt}
            variant="bordered"
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Cancelar</Button>
          <Button
            color="primary"
            onPress={() => mutation.mutate()}
            isLoading={mutation.isPending}
            isDisabled={!name || !startsAt || !endsAt}
          >
            Criar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
