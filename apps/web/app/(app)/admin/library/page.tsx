'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button, Chip, Input, useDisclosure, Spinner } from '@heroui/react';
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Video,
  FileText,
  Puzzle,
  BookOpen,
  Paperclip,
  Clock,
  ExternalLink,
  Library,
  X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../lib/api/client';
import { CreateMaterialModal } from '../../../../components/admin/create-material-modal';

type Item = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: string;
  difficulty: string;
  estimatedMinutes: number;
  tags: string[];
  source: string | null;
  score?: number | null;
};

type SearchResponse = {
  data: Item[];
  total: number;
};

const FORMAT_META: Record<string, { label: string; icon: typeof Video; color: string; bg: string; border: string }> = {
  VIDEO: { label: 'Videos', icon: Video, color: 'text-platform-youtube', bg: 'bg-[hsl(var(--platform-youtube)/0.08)]', border: 'border-[hsl(var(--platform-youtube)/0.2)]' },
  ARTICLE: { label: 'Artigos', icon: FileText, color: 'text-platform-article', bg: 'bg-[hsl(var(--platform-article)/0.08)]', border: 'border-[hsl(var(--platform-article)/0.2)]' },
  PROBLEM: { label: 'Problemas', icon: Puzzle, color: 'text-platform-leetcode', bg: 'bg-[hsl(var(--platform-leetcode)/0.08)]', border: 'border-[hsl(var(--platform-leetcode)/0.2)]' },
  BOOK: { label: 'Livros', icon: BookOpen, color: 'text-platform-book', bg: 'bg-[hsl(var(--platform-book)/0.08)]', border: 'border-[hsl(var(--platform-book)/0.2)]' },
  OTHER: { label: 'Outros', icon: Paperclip, color: 'text-foreground-muted', bg: 'bg-surface-muted', border: 'border-border' },
};

const FORMAT_SINGULAR: Record<string, string> = {
  VIDEO: 'Video',
  ARTICLE: 'Artigo',
  PROBLEM: 'Problema',
  BOOK: 'Livro',
  OTHER: 'Outro',
};

const DIFFICULTY_META: Record<string, { label: string; text: string; bg: string }> = {
  EASY: { label: 'Facil', text: 'text-success', bg: 'bg-success-soft' },
  MEDIUM: { label: 'Medio', text: 'text-warning', bg: 'bg-warning-soft' },
  HARD: { label: 'Dificil', text: 'text-danger', bg: 'bg-danger-soft' },
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function LibraryPage() {
  const [searchInput, setSearchInput] = useState('');
  const [activeFormat, setActiveFormat] = useState<string | null>(null);
  const [activeDifficulty, setActiveDifficulty] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(searchInput, 350);

  const hasSearchQuery = debouncedQuery.trim().length > 0;
  const hasFilters = !!activeFormat || !!activeDifficulty;

  // Use hybrid search endpoint when there's a query or filters
  const useSearch = hasSearchQuery || hasFilters;

  const { data: allItems, isLoading: isLoadingAll } = useQuery({
    queryKey: ['library'],
    queryFn: () => apiFetch<Item[]>('/library'),
    enabled: !useSearch,
  });

  const { data: searchResult, isLoading: isLoadingSearch, isFetching: isFetchingSearch } = useQuery({
    queryKey: ['library-search', debouncedQuery, activeFormat, activeDifficulty],
    queryFn: () =>
      apiFetch<SearchResponse>('/library/search', {
        method: 'POST',
        body: JSON.stringify({
          query: debouncedQuery || undefined,
          format: activeFormat ? [activeFormat] : undefined,
          difficulty: activeDifficulty ? [activeDifficulty] : undefined,
          limit: 100,
        }),
      }),
    enabled: useSearch,
  });

  // Always fetch all items for counts (lightweight, cached)
  const { data: allItemsForCounts } = useQuery({
    queryKey: ['library'],
    queryFn: () => apiFetch<Item[]>('/library'),
  });

  const items: Item[] = useSearch ? (searchResult?.data ?? []) : (allItems ?? []);
  const isLoading = useSearch ? isLoadingSearch : isLoadingAll;

  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = { VIDEO: 0, ARTICLE: 0, PROBLEM: 0, BOOK: 0, OTHER: 0 };
    (allItemsForCounts ?? []).forEach((item) => {
      if (counts[item.format] !== undefined) counts[item.format]++;
    });
    return counts;
  }, [allItemsForCounts]);

  const totalItems = (allItemsForCounts ?? []).length;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/library/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library-search'] });
    },
  });

  const handleEdit = useCallback((item: Item) => {
    setEditItem(item);
    onOpen();
  }, [onOpen]);

  const handleCreate = useCallback(() => {
    setEditItem(null);
    onOpen();
  }, [onOpen]);

  const handleClose = useCallback(() => {
    setEditItem(null);
    onClose();
  }, [onClose]);

  const toggleFormat = useCallback((format: string) => {
    setActiveFormat((prev) => (prev === format ? null : format));
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFormat(null);
    setActiveDifficulty(null);
    setSearchInput('');
  }, []);

  if (isLoading && !allItemsForCounts) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-40 skeleton-pulse rounded-lg" />
            <div className="h-4 w-56 skeleton-pulse rounded-lg mt-2" />
          </div>
          <div className="h-10 w-36 skeleton-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 skeleton-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-10 w-full skeleton-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 skeleton-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-foreground">Biblioteca</h1>
          <p className="text-body-sm text-foreground-muted mt-1">
            {totalItems} {totalItems === 1 ? 'material' : 'materiais'} no acervo
          </p>
        </div>
        <Button
          color="primary"
          startContent={<Plus className="h-4 w-4" />}
          onPress={handleCreate}
          className="rounded-pill px-5 font-semibold"
        >
          Novo material
        </Button>
      </div>

      {/* Format pre-filter grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Object.entries(FORMAT_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const count = formatCounts[key] ?? 0;
          const isActive = activeFormat === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleFormat(key)}
              className={`
                group relative flex flex-col items-center gap-2 rounded-xl p-4
                transition-all duration-200 border
                ${
                  isActive
                    ? `${meta.bg} ${meta.border} shadow-sm ring-1 ring-offset-1 ring-offset-background`
                    : 'bg-surface border-border hover:border-border-strong hover:shadow-xs'
                }
                ${isActive ? `ring-[hsl(var(--brand)/0.3)]` : ''}
              `}
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${meta.bg}`}>
                <Icon className={`h-5 w-5 ${meta.color}`} />
              </div>
              <div className="text-center">
                <p className={`text-body-sm font-semibold ${isActive ? 'text-foreground' : 'text-foreground-muted'}`}>
                  {meta.label}
                </p>
                <p className="text-caption text-foreground-subtle">{count}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search bar + difficulty filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <Input
            ref={searchRef}
            placeholder="Buscar por titulo, descricao, tags... (busca semantica)"
            value={searchInput}
            onValueChange={setSearchInput}
            startContent={<Search className="h-4 w-4 text-foreground-subtle flex-shrink-0" />}
            endContent={
              isFetchingSearch ? (
                <Spinner size="sm" />
              ) : searchInput ? (
                <button onClick={() => setSearchInput('')} className="text-foreground-subtle hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              ) : null
            }
            variant="bordered"
            classNames={{
              inputWrapper: 'shadow-none bg-surface',
            }}
          />
        </div>

        <div className="flex gap-2">
          {Object.entries(DIFFICULTY_META).map(([key, meta]) => {
            const isActive = activeDifficulty === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveDifficulty((prev) => (prev === key ? null : key))}
                className={`
                  px-4 py-2 rounded-pill text-body-sm font-medium
                  transition-all duration-150 border
                  ${
                    isActive
                      ? `${meta.bg} ${meta.text} border-current shadow-sm`
                      : 'bg-surface text-foreground-muted border-border hover:border-border-strong'
                  }
                `}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        {(hasSearchQuery || hasFilters) && (
          <Button
            size="sm"
            variant="light"
            color="default"
            onPress={clearFilters}
            className="text-foreground-subtle"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Results info */}
      {(hasSearchQuery || hasFilters) && (
        <div className="flex items-center gap-2 text-body-sm text-foreground-muted">
          <span>
            {items.length} {items.length === 1 ? 'resultado' : 'resultados'}
          </span>
          {activeFormat && (
            <Chip
              size="sm"
              variant="flat"
              onClose={() => setActiveFormat(null)}
              classNames={{ base: 'bg-brand-soft text-brand-soft-foreground', closeButton: 'text-brand-soft-foreground/60' }}
            >
              {FORMAT_SINGULAR[activeFormat]}
            </Chip>
          )}
          {activeDifficulty && (
            <Chip
              size="sm"
              variant="flat"
              onClose={() => setActiveDifficulty(null)}
              classNames={{ base: `${DIFFICULTY_META[activeDifficulty].bg} ${DIFFICULTY_META[activeDifficulty].text}` }}
            >
              {DIFFICULTY_META[activeDifficulty].label}
            </Chip>
          )}
        </div>
      )}

      {/* Card grid */}
      {items.length === 0 ? (
        <div className="empty-state py-16">
          <div className="h-16 w-16 rounded-2xl bg-surface-muted flex items-center justify-center mb-4">
            <Library className="h-8 w-8 text-foreground-subtle" />
          </div>
          <p className="text-body font-semibold text-foreground mb-1">
            {hasSearchQuery || hasFilters ? 'Nenhum resultado encontrado' : 'Biblioteca vazia'}
          </p>
          <p className="text-body-sm text-foreground-muted max-w-sm">
            {hasSearchQuery || hasFilters
              ? 'Tente ajustar os filtros ou usar termos diferentes na busca.'
              : 'Adicione materiais de estudo para montar os planos semanais dos membros.'}
          </p>
          {!hasSearchQuery && !hasFilters && (
            <Button
              color="primary"
              variant="flat"
              startContent={<Plus className="h-4 w-4" />}
              onPress={handleCreate}
              className="mt-4 rounded-pill"
            >
              Adicionar primeiro material
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const fmt = FORMAT_META[item.format] ?? FORMAT_META.OTHER;
            const diff = DIFFICULTY_META[item.difficulty];
            const Icon = fmt.icon;

            return (
              <div
                key={item.id}
                className="glass rounded-xl p-4 card-hover group relative flex flex-col"
              >
                {/* Top row: icon + format + difficulty */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${fmt.bg}`}>
                      <Icon className={`h-5 w-5 ${fmt.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-sm font-bold text-foreground truncate leading-tight">
                        {item.title}
                      </p>
                      {item.source && (
                        <p className="text-caption text-foreground-subtle">{item.source}</p>
                      )}
                    </div>
                  </div>
                  {/* Actions (visible on hover) */}
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button
                      size="sm"
                      variant="light"
                      isIconOnly
                      onPress={() => handleEdit(item)}
                      aria-label="Editar"
                      className="h-7 w-7 min-w-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      isIconOnly
                      onPress={() => deleteMutation.mutate(item.id)}
                      aria-label="Excluir"
                      className="h-7 w-7 min-w-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Description */}
                {item.description && (
                  <p className="text-caption text-foreground-muted line-clamp-2 mb-3">
                    {item.description}
                  </p>
                )}

                {/* Bottom metadata */}
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    {diff && (
                      <span className={`text-caption font-semibold px-2 py-0.5 rounded-pill ${diff.bg} ${diff.text}`}>
                        {diff.label}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-caption text-foreground-subtle">
                      <Clock className="h-3 w-3" />
                      {item.estimatedMinutes}min
                    </span>
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-hover transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {item.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-pill bg-surface-muted text-foreground-subtle"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 4 && (
                      <span className="text-[10px] text-foreground-subtle">+{item.tags.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Score indicator for search results */}
                {item.score != null && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] font-mono text-foreground-subtle bg-surface-muted px-1.5 py-0.5 rounded">
                      {(Number(item.score) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateMaterialModal isOpen={isOpen} onClose={handleClose} editItem={editItem} />
    </div>
  );
}
