'use client';

import { Button, Card, CardBody, Input, Select, SelectItem } from '@heroui/react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../../lib/api/client';
import { LibraryItemCard, type LibraryItemCardProps } from '../../../../components/library/library-item-card';

const FORMAT_OPTIONS = [
  { key: 'VIDEO', label: 'Vídeo' },
  { key: 'ARTICLE', label: 'Artigo' },
  { key: 'BOOK', label: 'Livro' },
  { key: 'PROBLEM', label: 'Problema' },
  { key: 'OTHER', label: 'Outro' },
];

const DIFFICULTY_OPTIONS = [
  { key: 'EASY', label: 'Fácil' },
  { key: 'MEDIUM', label: 'Médio' },
  { key: 'HARD', label: 'Difícil' },
];

type Item = LibraryItemCardProps & { description: string | null };

export default function AdminLibraryPage() {
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['library', query, format, difficulty],
    queryFn: async () => {
      if (!query && format.length === 0 && difficulty.length === 0) {
        return apiFetch<Item[]>('/library');
      }
      const body = {
        query: query || undefined,
        format: format.length > 0 ? format : undefined,
        difficulty: difficulty.length > 0 ? difficulty : undefined,
      };
      const res = await apiFetch<{ data: Item[] }>('/library/search', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Acervo</h1>
        <Button as={Link} href="/admin/library/new" color="primary" startContent={<Plus className="h-4 w-4" />}>
          Novo item
        </Button>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <Input
            placeholder="Buscar (semântica + full-text)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            startContent={<Search className="h-4 w-4 text-foreground/50" />}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              selectionMode="multiple"
              label="Formato"
              selectedKeys={format}
              onSelectionChange={(keys) => setFormat(Array.from(keys as Set<string>))}
            >
              {FORMAT_OPTIONS.map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>
            <Select
              selectionMode="multiple"
              label="Dificuldade"
              selectedKeys={difficulty}
              onSelectionChange={(keys) => setDifficulty(Array.from(keys as Set<string>))}
            >
              {DIFFICULTY_OPTIONS.map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <p className="text-foreground/60">Carregando...</p>
      ) : (data ?? []).length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-foreground/60">Nenhum item. Clique em "Novo item" para começar.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(data ?? []).map((item) => (
            <LibraryItemCard key={item.id} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
