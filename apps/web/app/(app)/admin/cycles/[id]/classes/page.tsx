'use client';

import { Avatar, Button, Card, CardBody, CardHeader, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, useDisclosure } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { use, useState } from 'react';
import { apiFetch } from '../../../../../../lib/api/client';

type ClassSession = {
  id: string;
  title: string;
  topic: string | null;
  scheduledAt: string;
};

type Member = { id: string; name: string; email: string; pictureUrl: string | null; role: string };

type AttendanceRow = { id: string; userId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' };

export default function AdminCycleClassesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: cycleId } = use(params);
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState({ title: '', topic: '', scheduledAt: '', durationMin: 90 });
  const [openClassId, setOpenClassId] = useState<string | null>(null);

  const { data: classes } = useQuery({
    queryKey: ['classes', cycleId],
    queryFn: () => apiFetch<ClassSession[]>(`/cycles/${cycleId}/classes`),
  });

  const { data: members } = useQuery({
    queryKey: ['members'],
    queryFn: () => apiFetch<Member[]>('/members'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/cycles/${cycleId}/classes`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          topic: form.topic || null,
          scheduledAt: form.scheduledAt,
          durationMin: form.durationMin,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', cycleId] });
      onClose();
      setForm({ title: '', topic: '', scheduledAt: '', durationMin: 90 });
    },
  });

  const [attendance, setAttendance] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE'>>({});

  const { data: existingAttendance } = useQuery({
    queryKey: ['class-attendance', openClassId],
    queryFn: () => (openClassId ? apiFetch<AttendanceRow[]>(`/classes/${openClassId}/attendance`) : Promise.resolve([])),
    enabled: !!openClassId,
  });

  const attendanceMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/classes/${openClassId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({
          rows: Object.entries(attendance).map(([userId, status]) => ({ userId, status })),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-attendance', openClassId] });
    },
  });

  const memberMembers = (members ?? []).filter((m) => m.role === 'MEMBER');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Aulas do ciclo</h1>
        <Button color="primary" onPress={onOpen}>Nova aula</Button>
      </div>

      <div className="space-y-3">
        {(classes ?? []).map((cls) => {
          const isOpen2 = openClassId === cls.id;
          return (
            <Card key={cls.id}>
              <CardHeader>
                <div className="flex w-full items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">{cls.title}</h2>
                    <p className="text-xs text-foreground/60">
                      {new Date(cls.scheduledAt).toLocaleString('pt-BR')}
                      {cls.topic && ` · ${cls.topic}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setOpenClassId(isOpen2 ? null : cls.id);
                      if (!isOpen2) {
                        const init: Record<string, 'PRESENT' | 'ABSENT' | 'LATE'> = {};
                        memberMembers.forEach((m) => {
                          init[m.id] = 'PRESENT';
                        });
                        setAttendance(init);
                      }
                    }}
                  >
                    {isOpen2 ? 'Fechar' : 'Presença'}
                  </Button>
                </div>
              </CardHeader>
              {isOpen2 && (
                <CardBody className="space-y-2">
                  {memberMembers.map((m) => {
                    const current = existingAttendance?.find((a) => a.userId === m.id)?.status;
                    const value = attendance[m.id] ?? current ?? 'PRESENT';
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Avatar src={m.pictureUrl ?? undefined} name={m.name} size="sm" />
                          <span className="text-sm">{m.name}</span>
                        </div>
                        <Select
                          size="sm"
                          className="w-32"
                          selectedKeys={[value]}
                          onSelectionChange={(keys) => {
                            const v = Array.from(keys as Set<string>)[0] as 'PRESENT' | 'ABSENT' | 'LATE';
                            setAttendance((a) => ({ ...a, [m.id]: v }));
                          }}
                        >
                          <SelectItem key="PRESENT">Presente</SelectItem>
                          <SelectItem key="ABSENT">Ausente</SelectItem>
                          <SelectItem key="LATE">Atrasado</SelectItem>
                        </Select>
                      </div>
                    );
                  })}
                  <Button
                    color="primary"
                    isLoading={attendanceMutation.isPending}
                    onPress={() => attendanceMutation.mutate()}
                  >
                    Salvar presenças
                  </Button>
                </CardBody>
              )}
            </Card>
          );
        })}
      </div>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Nova aula</ModalHeader>
          <ModalBody className="space-y-3">
            <Input label="Título" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Input label="Tópico" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} />
            <Input type="datetime-local" label="Data/hora" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
            <Input type="number" label="Duração (min)" value={String(form.durationMin)} onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) }))} />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>Cancelar</Button>
            <Button color="primary" isLoading={createMutation.isPending} onPress={() => createMutation.mutate()}>Criar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
