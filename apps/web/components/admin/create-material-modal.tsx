'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea } from '@heroui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';

const FORMATS = [
  { key: 'VIDEO', label: 'Video' },
  { key: 'ARTICLE', label: 'Artigo' },
  { key: 'PROBLEM', label: 'Problema' },
  { key: 'BOOK', label: 'Livro' },
  { key: 'OTHER', label: 'Outro' },
];

const DIFFICULTIES = [
  { key: 'EASY', label: 'Facil' },
  { key: 'MEDIUM', label: 'Medio' },
  { key: 'HARD', label: 'Dificil' },
];

type Item = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: string;
  difficulty: string;
  estimatedMinutes: number;
  tags: string[];
};

interface CreateMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: Item | null;
}

export function CreateMaterialModal({ isOpen, onClose, editItem }: CreateMaterialModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [tags, setTags] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (editItem) {
      setTitle(editItem.title);
      setUrl(editItem.url ?? '');
      setDescription(editItem.description ?? '');
      setFormat(editItem.format);
      setDifficulty(editItem.difficulty);
      setEstimatedMinutes(String(editItem.estimatedMinutes));
      setTags(editItem.tags.join(', '));
    } else {
      setTitle(''); setUrl(''); setDescription(''); setFormat('');
      setDifficulty(''); setEstimatedMinutes(''); setTags('');
    }
  }, [editItem, isOpen]);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        title, url: url || null, description: description || null,
        format, difficulty,
        estimatedMinutes: Number(estimatedMinutes),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (editItem) {
        return apiFetch(`/library/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      }
      return apiFetch('/library', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{editItem ? 'Editar material' : 'Novo material'}</ModalHeader>
        <ModalBody className="space-y-4">
          <Input label="Titulo" value={title} onValueChange={setTitle} variant="bordered" />
          <Input label="URL" value={url} onValueChange={setUrl} variant="bordered" placeholder="https://..." />
          <Textarea label="Descricao" value={description} onValueChange={setDescription} variant="bordered" />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Formato"
              selectedKeys={format ? [format] : []}
              onSelectionChange={(keys) => setFormat([...keys][0] as string)}
              variant="bordered"
            >
              {FORMATS.map((f) => <SelectItem key={f.key}>{f.label}</SelectItem>)}
            </Select>
            <Select
              label="Dificuldade"
              selectedKeys={difficulty ? [difficulty] : []}
              onSelectionChange={(keys) => setDifficulty([...keys][0] as string)}
              variant="bordered"
            >
              {DIFFICULTIES.map((d) => <SelectItem key={d.key}>{d.label}</SelectItem>)}
            </Select>
          </div>
          <Input label="Tempo estimado (min)" type="number" value={estimatedMinutes} onValueChange={setEstimatedMinutes} variant="bordered" />
          <Input label="Tags (separadas por virgula)" value={tags} onValueChange={setTags} variant="bordered" />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Cancelar</Button>
          <Button
            color="primary"
            onPress={() => mutation.mutate()}
            isLoading={mutation.isPending}
            isDisabled={!title || !format || !difficulty}
          >
            {editItem ? 'Salvar' : 'Criar'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
