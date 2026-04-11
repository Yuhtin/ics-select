'use client';

import { Card, CardBody, CardHeader, Chip, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../lib/api/client';

type UsageRow = {
  id: string;
  purpose: string;
  model: string;
  promptTokens: number;
  responseTokens: number;
  costUsd: string;
  createdAt: string;
};

export default function AiUsagePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => apiFetch<{ rows: UsageRow[]; totalCost: number }>('/ai/usage?sinceDays=7'),
  });

  if (isLoading || !data) return <p>Carregando...</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Uso de IA</h1>
          <Chip size="lg" variant="flat">
            Últimos 7 dias: ${data.totalCost.toFixed(4)}
          </Chip>
        </CardHeader>
        <CardBody>
          <Table>
            <TableHeader>
              <TableColumn>Data</TableColumn>
              <TableColumn>Propósito</TableColumn>
              <TableColumn>In</TableColumn>
              <TableColumn>Out</TableColumn>
              <TableColumn>Custo</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Sem uso registrado.">
              {data.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.createdAt).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{r.purpose}</TableCell>
                  <TableCell>{r.promptTokens}</TableCell>
                  <TableCell>{r.responseTokens}</TableCell>
                  <TableCell>${Number(r.costUsd).toFixed(4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
