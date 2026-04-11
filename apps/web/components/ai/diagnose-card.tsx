'use client';

import { Button, Card, CardBody, CardHeader } from '@heroui/react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../lib/api/client';

export function DiagnoseCard({ memberId }: { memberId: string }) {
  const [markdown, setMarkdown] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => apiFetch<{ markdown: string; cached: boolean }>(`/members/${memberId}/diagnose`),
    onSuccess: (data) => setMarkdown(data.markdown),
  });

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Diagnóstico (IA)</h2>
        <Button size="sm" variant="flat" isLoading={mutation.isPending} onPress={() => mutation.mutate()}>
          {markdown ? 'Atualizar' : 'Gerar'}
        </Button>
      </CardHeader>
      <CardBody>
        {markdown ? (
          <pre className="whitespace-pre-wrap text-sm text-foreground/80">{markdown}</pre>
        ) : (
          <p className="text-sm text-foreground/60">Clique em "Gerar" para analisar a trajetória do membro.</p>
        )}
      </CardBody>
    </Card>
  );
}
