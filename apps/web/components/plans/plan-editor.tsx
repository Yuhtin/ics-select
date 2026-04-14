'use client';

import { Button, Chip, Input } from '@heroui/react';
import { ArrowDown, ArrowUp, BookOpen, Calendar, Clock, GripVertical, Plus, Search, Sparkles, Trash2, Zap } from 'lucide-react';
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

const FORMAT_ICONS: Record<string, string> = {
  VIDEO: '🎬',
  ARTICLE: '📝',
  PROBLEM: '🧩',
  BOOK: '📖',
  OTHER: '📎',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'text-success',
  MEDIUM: 'text-warning',
  HARD: 'text-danger',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Facil',
  MEDIUM: 'Medio',
  HARD: 'Dificil',
};

export function PlanEditor({
  memberId,
  cycleId,
  cycleStartsAt,
  cycleEndsAt,
}: {
  memberId: string;
  cycleId: string;
  cycleStartsAt: string;
  cycleEndsAt: string;
}) {
  const queryClient = useQueryClient();
  const cycleStart = new Date(cycleStartsAt);
  const cycleEnd = new Date(cycleEndsAt);
  const minDate = cycleStartsAt.slice(0, 10);
  const maxDate = cycleEndsAt.slice(0, 10);

  // Default to current week clamped inside the cycle. If today is outside the cycle, default to the cycle's first week.
  const today = new Date();
  const anchor = today < cycleStart ? cycleStart : today > cycleEnd ? cycleEnd : today;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  if (monday < cycleStart) monday.setTime(cycleStart.getTime());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  if (sunday > cycleEnd) sunday.setTime(cycleEnd.getTime());

  const [draft, setDraft] = useState<PlanDraft>({
    cycleId,
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
    items: [],
  });
  const weekOutsideCycle =
    draft.weekStart < minDate || draft.weekEnd > maxDate || draft.weekStart > draft.weekEnd;

  const [query, setQuery] = useState('');
  const { data: searchResults, isLoading: searchLoading } = useQuery({
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
    if (draft.items.some((i) => i.libraryItemId === li.id)) return;
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
      const items: PlanItemRef[] = [];
      for (const i of result.draft.items) {
        const li = (searchResults ?? []).find((x) => x.id === i.libraryItemId);
        if (li) items.push({ libraryItemId: li.id, order: i.order, libraryItem: li });
      }
      if (items.length < result.draft.items.length) {
        for (const i of result.draft.items) {
          if (items.find((it) => it.libraryItemId === i.libraryItemId)) continue;
          try {
            const li = await apiFetch<LibraryItem>(`/library/${i.libraryItemId}`);
            items.push({ libraryItemId: li.id, order: i.order, libraryItem: li });
          } catch { /* ignore */ }
        }
      }
      items.sort((a, b) => a.order - b.order);
      setDraft((d) => ({ ...d, items }));
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
        } catch { /* ignore */ }
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
  const alreadyAdded = new Set(draft.items.map((i) => i.libraryItemId));

  const [publishError, setPublishError] = useState<string | null>(null);

  const handleCreateAndPublish = async () => {
    setPublishError(null);
    const created = await createMutation.mutateAsync();
    try {
      await publishMutation.mutateAsync(created.id);
    } catch (e: unknown) {
      const msg =
        (e as { error?: { message?: string } })?.error?.message
        ?? (e as { message?: string })?.message
        ?? 'Falha ao publicar o plano. O plano foi salvo como rascunho.';
      setPublishError(msg);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Acervo - Left panel (2/5) */}
      <div className="lg:col-span-2 space-y-4">
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-brand-soft flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-brand" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Acervo</h2>
            </div>
            <Input
              placeholder="Buscar materiais..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              startContent={<Search className="h-4 w-4 text-foreground-muted" />}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: 'bg-surface/50' }}
            />
          </div>

          <div className="max-h-[calc(100vh-340px)] overflow-y-auto p-2">
            {searchLoading ? (
              <div className="space-y-2 p-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 skeleton-pulse rounded-lg" />
                ))}
              </div>
            ) : (searchResults ?? []).length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="h-10 w-10 rounded-xl bg-surface-subtle flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-5 w-5 text-foreground-subtle" />
                </div>
                <p className="text-sm text-foreground-muted">Nenhum material encontrado.</p>
                <p className="text-xs text-foreground-subtle mt-1">Adicione materiais na Biblioteca primeiro.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {(searchResults ?? []).map((li) => {
                  const added = alreadyAdded.has(li.id);
                  return (
                    <div
                      key={li.id}
                      className={`group flex items-center gap-3 p-3 rounded-lg transition-all duration-150 ${
                        added
                          ? 'bg-brand-soft/50 opacity-60'
                          : 'hover:bg-surface-subtle/60 cursor-pointer'
                      }`}
                      onClick={() => !added && addItem(li)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && !added && addItem(li)}
                    >
                      <span className="text-lg flex-shrink-0">{FORMAT_ICONS[li.format] ?? '📎'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{li.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-medium ${DIFFICULTY_COLORS[li.difficulty] ?? 'text-foreground-muted'}`}>
                            {DIFFICULTY_LABELS[li.difficulty] ?? li.difficulty}
                          </span>
                          <span className="text-xs text-foreground-subtle flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {li.estimatedMinutes}min
                          </span>
                        </div>
                      </div>
                      {!added && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="h-4 w-4 text-brand" />
                        </div>
                      )}
                      {added && (
                        <Chip size="sm" variant="flat" color="primary" className="text-[10px]">Adicionado</Chip>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plano - Right panel (3/5) */}
      <div className="lg:col-span-3 space-y-4">
        {/* AI Section */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-100 to-brand-soft flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-brand" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Gerar com IA</p>
              <p className="text-xs text-foreground-muted">Crie um plano automaticamente</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="flat"
              color="secondary"
              startContent={<Zap className="h-3.5 w-3.5" />}
              isLoading={draftMutation.isPending}
              onPress={() => draftMutation.mutate()}
            >
              Rascunho do historico
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              size="sm"
              placeholder="Brief: ex. foco em grafos, 1 video + 4 exercicios"
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              variant="bordered"
              classNames={{ inputWrapper: 'bg-surface/50' }}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="flat"
              color="secondary"
              isDisabled={!briefText}
              isLoading={briefMutation.isPending}
              onPress={() => briefMutation.mutate()}
            >
              Montar
            </Button>
          </div>
        </div>

        {/* Date range */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-foreground-muted" />
            <p className="text-sm font-medium text-foreground">Periodo da semana</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label="Inicio"
              value={draft.weekStart}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDraft((d) => ({ ...d, weekStart: e.target.value }))}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: 'bg-surface/50' }}
            />
            <Input
              type="date"
              label="Fim"
              value={draft.weekEnd}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDraft((d) => ({ ...d, weekEnd: e.target.value }))}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: 'bg-surface/50' }}
            />
          </div>
          <p className="text-xs text-foreground-muted mt-2">
            Dentro do ciclo: {minDate} — {maxDate}
          </p>
          {weekOutsideCycle && (
            <p className="text-xs text-danger mt-1">
              A semana precisa estar dentro do período do ciclo.
            </p>
          )}
        </div>

        {/* Plan items */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/20">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Plano da semana</h2>
              <div className="flex items-center gap-2">
                <Chip size="sm" variant="flat" color={totalMinutes > 0 ? 'primary' : 'default'}>
                  <Clock className="h-3 w-3 mr-1 inline" />
                  {totalMinutes} min
                </Chip>
                <Chip size="sm" variant="flat">
                  {draft.items.length} {draft.items.length === 1 ? 'item' : 'itens'}
                </Chip>
              </div>
            </div>
          </div>

          <div className="p-3 min-h-[200px]">
            {draft.items.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-xl bg-surface-subtle flex items-center justify-center mx-auto mb-3">
                  <Plus className="h-5 w-5 text-foreground-subtle" />
                </div>
                <p className="text-sm text-foreground-muted font-medium">Nenhum item no plano</p>
                <p className="text-xs text-foreground-subtle mt-1">Clique nos materiais do acervo ou use a IA para gerar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {draft.items.map((it, idx) => (
                  <div
                    key={`${it.libraryItemId}-${idx}`}
                    className="group flex items-center gap-3 p-3 rounded-lg bg-surface/40 border border-border/20 hover:border-border/40 transition-all duration-150"
                  >
                    <div className="flex items-center gap-1 text-foreground-subtle">
                      <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-60 transition-opacity" />
                      <span className="text-xs font-mono font-bold text-brand w-5 text-center">{idx + 1}</span>
                    </div>
                    <span className="text-base flex-shrink-0">{FORMAT_ICONS[it.libraryItem.format] ?? '📎'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{it.libraryItem.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium ${DIFFICULTY_COLORS[it.libraryItem.difficulty] ?? 'text-foreground-muted'}`}>
                          {DIFFICULTY_LABELS[it.libraryItem.difficulty] ?? it.libraryItem.difficulty}
                        </span>
                        <span className="text-xs text-foreground-subtle">
                          {it.libraryItem.estimatedMinutes}min
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button isIconOnly size="sm" variant="light" onPress={() => moveItem(idx, -1)} isDisabled={idx === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" onPress={() => moveItem(idx, 1)} isDisabled={idx === draft.items.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => removeItem(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with action */}
          <div className="p-4 border-t border-border/20 bg-surface/30 space-y-2">
            {publishError && (
              <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-sm text-danger">
                {publishError}
              </div>
            )}
            {createMutation.isSuccess && !publishMutation.isSuccess && !publishMutation.isPending && !publishError && (
              <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-sm text-warning-600">
                Plano criado como rascunho.
              </div>
            )}
            <Button
              color="primary"
              isDisabled={draft.items.length === 0 || weekOutsideCycle}
              isLoading={createMutation.isPending || publishMutation.isPending}
              onPress={handleCreateAndPublish}
              className="w-full"
              size="lg"
            >
              Criar e publicar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
