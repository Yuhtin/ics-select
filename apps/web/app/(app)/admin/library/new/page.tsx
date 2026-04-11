'use client';

import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Textarea } from '@heroui/react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '../../../../../lib/api/client';

type ImportedMetadata = {
  title: string;
  description: string | null;
  source: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  estimatedMinutes: number;
  url: string;
};

export default function NewLibraryItemPage() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState('');
  const [draft, setDraft] = useState<Partial<ImportedMetadata & { difficulty: string; tags: string }>>({
    difficulty: 'MEDIUM',
    tags: '',
  });

  const importMutation = useMutation({
    mutationFn: (url: string) =>
      apiFetch<ImportedMetadata>('/library/import', { method: 'POST', body: JSON.stringify({ url }) }),
    onSuccess: (data) => setDraft((d) => ({ ...d, ...data })),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/library', {
        method: 'POST',
        body: JSON.stringify({
          title: draft.title ?? '',
          url: draft.url ?? null,
          description: draft.description ?? null,
          format: draft.format ?? 'ARTICLE',
          difficulty: draft.difficulty ?? 'MEDIUM',
          estimatedMinutes: draft.estimatedMinutes ?? 10,
          source: draft.source ?? null,
          tags: (draft.tags ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => router.push('/admin/library'),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Novo item do acervo</h1>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Importar por URL</h2>
        </CardHeader>
        <CardBody className="space-y-2">
          <Input
            placeholder="https://..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <Button
            color="primary"
            variant="flat"
            isLoading={importMutation.isPending}
            onPress={() => importMutation.mutate(urlInput)}
          >
            Extrair metadados
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Dados do item</h2>
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
                const val = Array.from(keys as Set<string>)[0] as ImportedMetadata['format'];
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
                const val = Array.from(keys as Set<string>)[0] as string;
                setDraft((d) => ({ ...d, difficulty: val }));
              }}
            >
              <SelectItem key="EASY">Fácil</SelectItem>
              <SelectItem key="MEDIUM">Médio</SelectItem>
              <SelectItem key="HARD">Difícil</SelectItem>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="number"
              label="Estimativa (min)"
              value={String(draft.estimatedMinutes ?? 10)}
              onChange={(e) => setDraft((d) => ({ ...d, estimatedMinutes: Number(e.target.value) }))}
            />
            <Input
              label="Fonte"
              value={draft.source ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
            />
          </div>
          <Input
            label="Tags (separadas por vírgula)"
            value={draft.tags ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
          />
          <Button
            color="primary"
            isLoading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
          >
            Criar
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
