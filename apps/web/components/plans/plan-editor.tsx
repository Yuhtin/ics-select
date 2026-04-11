'use client';

import { Button, Card, CardBody, Chip, Input, Select, SelectItem } from '@heroui/react';
import { ArrowDown, ArrowUp, Search, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../lib/api/client';

type LibraryItem = {
  id: string;
  title: string;
  format: string;
  difficulty: string;
  estimatedMinutes: number;
};

type PlanItemRef = { libraryItemId: string; order: number; libraryItem: LibraryItem };

type PlanDraft = {
  cycleId: string;
  weekStart: string;
  weekEnd: string;
  items: PlanItemRef[];
};

export function PlanEditor({ memberId, cycleId }: { memberId: string; cycleId: string }) {
  const queryClient = useQueryClient();
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const [draft, setDraft] = useState<PlanDraft>({
    cycleId,
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
    items: [],
  });

  const [query, setQuery] = useState('');
  const { data: searchResults } = useQuery({
    queryKey: ['library-search', query],
    queryFn: async () => {
      if (!query) return apiFetch<LibraryItem[]>('/library');
      const res = await apiFetch<{ data: LibraryItem[] }>('/library/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      return res.data;
    },
  });

  const addItem = (li: LibraryItem) => {
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        { libraryItemId: li.id, order: d.items.length, libraryItem: li },
      ],
    }));
  };

  const removeItem = (idx: number) => {
    setDraft((d) => ({
      ...d,
      items: d.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order: i })),
    }));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= draft.items.length) return;
    const next = [...draft.items];
    const [item] = next.splice(idx, 1);
    if (!item) return;
    next.splice(newIdx, 0, item);
    setDraft((d) => ({ ...d, items: next.map((it, i) => ({ ...it, order: i })) }));
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/members/${memberId}/plans`, {
        method: 'POST',
        body: JSON.stringify({
          cycleId: draft.cycleId,
          weekStart: draft.weekStart,
          weekEnd: draft.weekEnd,
          items: draft.items.map((i) => ({ libraryItemId: i.libraryItemId, order: i.order })),
        }),
      }),
  });

  const draftMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ draft: { items: Array<{ libraryItemId: string; order: number; rationale: string }>; narrative: string; totalMinutes: number } }>(`/ai/draft-plan`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      }),
    onSuccess: async (result) => {
      // Resolve each libraryItemId into the full item so we can display it
      const items: PlanItemRef[] = [];
      for (const i of result.draft.items) {
        const li = (searchResults ?? []).find((x) => x.id === i.libraryItemId);
        if (li) items.push({ libraryItemId: li.id, order: i.order, libraryItem: li });
      }
      // If the search cache doesn't have the items, fetch them individually
      if (items.length < result.draft.items.length) {
        for (const i of result.draft.items) {
          if (items.find((it) => it.libraryItemId === i.libraryItemId)) continue;
          try {
            const li = await apiFetch<LibraryItem>(`/library/${i.libraryItemId}`);
            items.push({ libraryItemId: li.id, order: i.order, libraryItem: li });
          } catch {
            // ignore
          }
        }
      }
      items.sort((a, b) => a.order - b.order);
      setDraft((d) => ({ ...d, items }));
      alert(`Rascunho gerado. Narrativa: ${result.draft.narrative}`);
    },
  });

  const [briefText, setBriefText] = useState('');
  const briefMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ draft: { items: Array<{ libraryItemId: string; order: number; rationale: string }>; narrative: string; totalMinutes: number } }>(`/ai/brief-plan`, {
        method: 'POST',
        body: JSON.stringify({ memberId, briefText }),
      }),
    onSuccess: async (result) => {
      const items: PlanItemRef[] = [];
      for (const i of result.draft.items) {
        try {
          const li = await apiFetch<LibraryItem>(`/library/${i.libraryItemId}`);
          items.push({ libraryItemId: li.id, order: i.order, libraryItem: li });
        } catch {
          // ignore
        }
      }
      items.sort((a, b) => a.order - b.order);
      setDraft((d) => ({ ...d, items }));
      setBriefText('');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (planId: string) =>
      apiFetch(`/plans/${planId}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', memberId] }),
  });

  const totalMinutes = draft.items.reduce((sum, i) => sum + i.libraryItem.estimatedMinutes, 0);

  const handleCreateAndPublish = async () => {
    const created = await createMutation.mutateAsync();
    try {
      await publishMutation.mutateAsync(created.id);
      alert('Plano publicado. Eventos criados no Calendar.');
    } catch (e) {
      alert(`Falha ao publicar: ${(e as Error).message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-lg font-semibold">Acervo</h2>
          <Input
            placeholder="Buscar itens"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            startContent={<Search className="h-4 w-4 text-foreground/50" />}
          />
          <div className="max-h-[500px] space-y-2 overflow-y-auto">
            {(searchResults ?? []).map((li) => (
              <div
                key={li.id}
                className="flex items-center justify-between rounded-md border border-foreground/10 p-2"
              >
                <div>
                  <p className="text-sm font-medium">{li.title}</p>
                  <p className="text-xs text-foreground/60">
                    {li.format} · {li.difficulty} · {li.estimatedMinutes}min
                  </p>
                </div>
                <Button size="sm" variant="flat" onPress={() => addItem(li)}>
                  +
                </Button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-lg font-semibold">Plano da semana</h2>
          <div className="space-y-2 rounded-md border border-foreground/10 p-3">
            <p className="text-xs font-medium text-foreground/70">Gerar com IA</p>
            <div className="flex gap-2">
              <Button size="sm" variant="flat" color="secondary" isLoading={draftMutation.isPending} onPress={() => draftMutation.mutate()}>
                Rascunho do histórico
              </Button>
            </div>
            <Input
              size="sm"
              placeholder="Brief: ex. foco em grafos, 1 vídeo + 4 exercícios"
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
            />
            <Button size="sm" variant="flat" color="secondary" isDisabled={!briefText} isLoading={briefMutation.isPending} onPress={() => briefMutation.mutate()}>
              Montar por brief
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              label="Início"
              value={draft.weekStart}
              onChange={(e) => setDraft((d) => ({ ...d, weekStart: e.target.value }))}
            />
            <Input
              type="date"
              label="Fim"
              value={draft.weekEnd}
              onChange={(e) => setDraft((d) => ({ ...d, weekEnd: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            {draft.items.length === 0 && (
              <p className="text-sm text-foreground/60">Adicione itens do acervo ao lado.</p>
            )}
            {draft.items.map((it, idx) => (
              <div
                key={`${it.libraryItemId}-${idx}`}
                className="flex items-center justify-between rounded-md border border-foreground/10 p-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {idx + 1}. {it.libraryItem.title}
                  </p>
                  <p className="text-xs text-foreground/60">
                    {it.libraryItem.estimatedMinutes}min
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button isIconOnly size="sm" variant="light" onPress={() => moveItem(idx, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" onPress={() => moveItem(idx, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Chip size="sm" variant="flat">{totalMinutes} min total</Chip>
            <Button
              color="primary"
              isDisabled={draft.items.length === 0}
              isLoading={createMutation.isPending || publishMutation.isPending}
              onPress={handleCreateAndPublish}
            >
              Criar e publicar
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
