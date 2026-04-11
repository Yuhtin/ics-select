'use client';

import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Slider } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/api/client';

type Availability = {
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  preferredSessionMinutes: number;
  timezone: string;
};

const DAYS: Array<{ key: keyof Availability; label: string }> = [
  { key: 'mondayMinutes', label: 'Segunda' },
  { key: 'tuesdayMinutes', label: 'Terça' },
  { key: 'wednesdayMinutes', label: 'Quarta' },
  { key: 'thursdayMinutes', label: 'Quinta' },
  { key: 'fridayMinutes', label: 'Sexta' },
  { key: 'saturdayMinutes', label: 'Sábado' },
  { key: 'sundayMinutes', label: 'Domingo' },
];

const DEFAULT: Availability = {
  mondayMinutes: 0,
  tuesdayMinutes: 0,
  wednesdayMinutes: 0,
  thursdayMinutes: 0,
  fridayMinutes: 0,
  saturdayMinutes: 0,
  sundayMinutes: 0,
  preferredSessionMinutes: 60,
  timezone: 'America/Sao_Paulo',
};

export default function AvailabilityPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['availability'],
    queryFn: () => apiFetch<Availability | null>('/me/availability'),
  });
  const [state, setState] = useState<Availability>(DEFAULT);

  useEffect(() => {
    if (data) setState(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<Availability>('/me/availability', {
        method: 'PATCH',
        body: JSON.stringify(state),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['availability'] }),
  });

  if (isLoading) return <p className="text-foreground-muted">Carregando...</p>;

  const totalMinutes = DAYS.reduce((sum, d) => sum + (state[d.key] as number), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <div>
            <h1 className="text-2xl font-semibold">Disponibilidade semanal</h1>
            <p className="text-sm text-foreground-muted">
              Defina quantos minutos por dia você consegue dedicar ao estudo. O scheduler
              vai usar esses valores junto com o seu Google Calendar pra montar as sessões.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {DAYS.map((d) => (
            <div key={d.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{d.label}</span>
                <span className="text-foreground-muted">{state[d.key] as number} min</span>
              </div>
              <Slider
                aria-label={d.label}
                minValue={0}
                maxValue={240}
                step={15}
                value={state[d.key] as number}
                onChange={(v) =>
                  setState((s) => ({ ...s, [d.key]: Array.isArray(v) ? v[0] : v }))
                }
              />
            </div>
          ))}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Duração preferida da sessão"
              selectedKeys={[String(state.preferredSessionMinutes)]}
              onSelectionChange={(keys) => {
                const v = Number(Array.from(keys as Set<string>)[0]);
                setState((s) => ({ ...s, preferredSessionMinutes: v }));
              }}
            >
              <SelectItem key="25">25 min</SelectItem>
              <SelectItem key="45">45 min</SelectItem>
              <SelectItem key="60">60 min</SelectItem>
              <SelectItem key="90">90 min</SelectItem>
            </Select>
            <Input
              label="Timezone"
              value={state.timezone}
              onChange={(e) => setState((s) => ({ ...s, timezone: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground-muted">Total: {totalMinutes} min / semana</p>
            <Button
              color="primary"
              isLoading={saveMutation.isPending}
              onPress={() => saveMutation.mutate()}
            >
              Salvar
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
