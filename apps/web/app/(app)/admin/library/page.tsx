'use client';

import { useState } from 'react';
import { Button, Chip, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useDisclosure } from '@heroui/react';
import { Plus, Search, Trash2, Pencil } from 'lucide-react';
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
};

const FORMAT_COLORS: Record<string, 'secondary' | 'primary' | 'warning' | 'success' | 'default'> = {
  VIDEO: 'secondary',
  ARTICLE: 'primary',
  PROBLEM: 'warning',
  BOOK: 'success',
  OTHER: 'default',
};

const FORMAT_LABELS: Record<string, string> = {
  VIDEO: 'Video',
  ARTICLE: 'Artigo',
  PROBLEM: 'Problema',
  BOOK: 'Livro',
  OTHER: 'Outro',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Facil',
  MEDIUM: 'Medio',
  HARD: 'Dificil',
};

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [editItem, setEditItem] = useState<Item | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['library'],
    queryFn: () => apiFetch<Item[]>('/library'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/library/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library'] }),
  });

  if (isLoading) {
    return <p className="text-sm text-foreground-muted">Carregando biblioteca...</p>;
  }

  const items = (data ?? []).filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (formatFilter && item.format !== formatFilter) return false;
    if (difficultyFilter && item.difficulty !== difficultyFilter) return false;
    return true;
  });

  const handleEdit = (item: Item) => {
    setEditItem(item);
    onOpen();
  };

  const handleCreate = () => {
    setEditItem(null);
    onOpen();
  };

  const handleClose = () => {
    setEditItem(null);
    onClose();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Biblioteca</h1>
          <p className="text-sm text-foreground-muted mt-1">Materiais de estudo disponiveis</p>
        </div>
        <Button color="primary" startContent={<Plus className="h-4 w-4" />} onPress={handleCreate}>
          Novo material
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar..."
          value={search}
          onValueChange={setSearch}
          startContent={<Search className="h-4 w-4 text-foreground-muted" />}
          variant="bordered"
          className="max-w-xs"
        />
        <Select
          placeholder="Formato"
          selectedKeys={formatFilter ? [formatFilter] : []}
          onSelectionChange={(keys) => setFormatFilter([...keys][0] as string ?? '')}
          variant="bordered"
          className="max-w-[160px]"
        >
          {Object.entries(FORMAT_LABELS).map(([key, label]) => (
            <SelectItem key={key}>{label}</SelectItem>
          ))}
        </Select>
        <Select
          placeholder="Dificuldade"
          selectedKeys={difficultyFilter ? [difficultyFilter] : []}
          onSelectionChange={(keys) => setDifficultyFilter([...keys][0] as string ?? '')}
          variant="bordered"
          className="max-w-[160px]"
        >
          {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
            <SelectItem key={key}>{label}</SelectItem>
          ))}
        </Select>
      </div>

      <Table aria-label="Biblioteca de materiais" shadow="sm" isStriped>
        <TableHeader>
          <TableColumn>Titulo</TableColumn>
          <TableColumn>Formato</TableColumn>
          <TableColumn>Dificuldade</TableColumn>
          <TableColumn>Tempo</TableColumn>
          <TableColumn>Acoes</TableColumn>
        </TableHeader>
        <TableBody emptyContent="Nenhum material encontrado.">
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {item.tags.slice(0, 3).map((t) => (
                        <Chip key={t} size="sm" variant="flat" className="text-[10px]">{t}</Chip>
                      ))}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Chip size="sm" color={FORMAT_COLORS[item.format] ?? 'default'} variant="flat">
                  {FORMAT_LABELS[item.format] ?? item.format}
                </Chip>
              </TableCell>
              <TableCell>
                <span className="text-sm">{DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm">{item.estimatedMinutes}min</span>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="sm" variant="light" isIconOnly onPress={() => handleEdit(item)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="light" color="danger" isIconOnly onPress={() => deleteMutation.mutate(item.id)} aria-label="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateMaterialModal isOpen={isOpen} onClose={handleClose} editItem={editItem} />
    </div>
  );
}
