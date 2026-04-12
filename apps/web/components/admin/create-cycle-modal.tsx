'use client';

import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { Calendar, Sparkles } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';

interface CreateCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDatePreview(start: string, end: string): string | null {
  if (!start || !end) return null;
  try {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    const weeks = Math.ceil(diff / 7);
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
    return `${fmt.format(s)} a ${fmt.format(e)} (${weeks} semanas)`;
  } catch {
    return null;
  }
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

  const datePreview = formatDatePreview(startsAt, endsAt);
  const isValid = name.trim() && startsAt && endsAt;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" backdrop="blur" placement="center">
      <ModalContent>
        {(closeModal) => (
          <>
            <ModalHeader className="flex flex-col gap-1 pb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Novo ciclo</h2>
                  <p className="text-xs text-default-400 font-normal">Crie um novo periodo de estudos para a turma</p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="gap-5 pb-2">
              <Input
                label="Nome do ciclo"
                placeholder="Ex: Ciclo 2026.1 — Big Techs"
                value={name}
                onValueChange={setName}
                variant="bordered"
                size="lg"
                startContent={<Calendar className="h-4 w-4 text-default-400 flex-shrink-0" />}
                classNames={{
                  label: 'text-default-600 font-medium',
                  inputWrapper: 'shadow-none',
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Data de inicio"
                  type="date"
                  value={startsAt}
                  onValueChange={setStartsAt}
                  variant="bordered"
                  classNames={{
                    label: 'text-default-600 font-medium',
                    inputWrapper: 'shadow-none',
                  }}
                />
                <Input
                  label="Data de fim"
                  type="date"
                  value={endsAt}
                  onValueChange={setEndsAt}
                  variant="bordered"
                  classNames={{
                    label: 'text-default-600 font-medium',
                    inputWrapper: 'shadow-none',
                  }}
                />
              </div>

              {datePreview && (
                <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                  <p className="text-sm text-primary-700">{datePreview}</p>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="pt-2">
              <Button variant="flat" color="default" onPress={closeModal}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={() => mutation.mutate()}
                isLoading={mutation.isPending}
                isDisabled={!isValid}
              >
                Criar ciclo
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
