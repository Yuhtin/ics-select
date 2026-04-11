'use client';

import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Textarea } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { apiFetch } from '../../../../../lib/api/client';

type Item = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
};

export default function EditLibraryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Partial<Item & { tagsInput: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['library', id],
    queryFn: () => apiFetch<Item>(`/library/${id}`),
  });

  useEffect(() => {
    if (data) {
      setDraft({ ...data, tagsInput: data.tags.join(', ') });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch<Item>(`/library/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: draft.title,
          url: draft.url,
          description: draft.description,
          format: draft.format,
          difficulty: draft.difficulty,
          estimatedMinutes: draft.estimatedMinutes,
          source: draft.source,
          tags: (draft.tagsInput ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      router.push('/admin/library');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/library/${id}`, { method: 'DELETE' }),
    onSuccess: () => router.push('/admin/library'),
  });

  if (isLoading || !draft.id) return <p className="text-foreground-muted">Carregando...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">Editar item</h1>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input
            label="Título"
            value={draft.title ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <Input
            label="URL"
            value={draft.url ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
          />
          <Textarea
            label="Descrição"
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Formato"
              selectedKeys={draft.format ? [draft.format] : []}
              onSelectionChange={(keys) => {
                const val = Array.from(keys as Set<string>)[0] as Item['format'];
                setDraft((d) => ({ ...d, format: val }));
              }}
            >
              <SelectItem key="VIDEO">Vídeo</SelectItem>
              <SelectItem key="ARTICLE">Artigo</SelectItem>
              <SelectItem key="BOOK">Livro</SelectItem>
              <SelectItem key="PROBLEM">Problema</SelectItem>
              <SelectItem key="OTHER">Outro</SelectItem>
            </Select>
            <Select
              label="Dificuldade"
              selectedKeys={draft.difficulty ? [draft.difficulty] : []}
              onSelectionChange={(keys) => {
                const val = Array.from(keys as Set<string>)[0] as Item['difficulty'];
                setDraft((d) => ({ ...d, difficulty: val }));
              }}
            >
              <SelectItem key="EASY">Fácil</SelectItem>
              <SelectItem key="MEDIUM">Médio</SelectItem>
              <SelectItem key="HARD">Difícil</SelectItem>
            </Select>
          </div>
          <Input
            type="number"
            label="Estimativa (min)"
            value={String(draft.estimatedMinutes ?? 10)}
            onChange={(e) => setDraft((d) => ({ ...d, estimatedMinutes: Number(e.target.value) }))}
          />
          <Input
            label="Tags (separadas por vírgula)"
            value={draft.tagsInput ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, tagsInput: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button color="primary" isLoading={updateMutation.isPending} onPress={() => updateMutation.mutate()}>
              Salvar
            </Button>
            <Button color="danger" variant="flat" isLoading={deleteMutation.isPending} onPress={() => deleteMutation.mutate()}>
              Excluir
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
