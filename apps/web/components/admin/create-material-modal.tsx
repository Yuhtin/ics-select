'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea, Chip } from '@heroui/react';
import { BookOpen, Clock, ExternalLink, Hash, Link2, Pencil, Tag } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';

const FORMATS = [
  { key: 'VIDEO', label: 'Video', emoji: '🎬' },
  { key: 'ARTICLE', label: 'Artigo', emoji: '📝' },
  { key: 'PROBLEM', label: 'Problema', emoji: '🧩' },
  { key: 'BOOK', label: 'Livro', emoji: '📖' },
  { key: 'OTHER', label: 'Outro', emoji: '📎' },
];

const DIFFICULTIES = [
  { key: 'EASY', label: 'Facil', color: 'success' as const },
  { key: 'MEDIUM', label: 'Medio', color: 'warning' as const },
  { key: 'HARD', label: 'Dificil', color: 'danger' as const },
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
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (editItem) {
      setTitle(editItem.title);
      setUrl(editItem.url ?? '');
      setDescription(editItem.description ?? '');
      setFormat(editItem.format);
      setDifficulty(editItem.difficulty);
      setEstimatedMinutes(String(editItem.estimatedMinutes));
      setTags(editItem.tags);
      setTagInput('');
    } else {
      setTitle(''); setUrl(''); setDescription(''); setFormat('');
      setDifficulty(''); setEstimatedMinutes(''); setTags([]); setTagInput('');
    }
  }, [editItem, isOpen]);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        title, url: url || null, description: description || null,
        format, difficulty,
        estimatedMinutes: Number(estimatedMinutes),
        tags,
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

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,$/, '');
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const isEditing = !!editItem;
  const isValid = title.trim() && format && difficulty;
  const selectedFormat = FORMATS.find((f) => f.key === format);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" backdrop="blur" placement="center">
      <ModalContent>
        {(closeModal) => (
          <>
            <ModalHeader className="flex flex-col gap-1 pb-2">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isEditing ? 'bg-warning/10' : 'bg-primary/10'}`}>
                  {isEditing
                    ? <Pencil className="h-5 w-5 text-warning" />
                    : <BookOpen className="h-5 w-5 text-primary" />
                  }
                </div>
                <div>
                  <h2 className="text-lg font-bold">{isEditing ? 'Editar material' : 'Novo material'}</h2>
                  <p className="text-xs text-default-400 font-normal">
                    {isEditing ? 'Atualize as informacoes do material de estudo' : 'Adicione um novo material a biblioteca'}
                  </p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="gap-6 pb-2">
              {/* Core info section */}
              <div className="space-y-4">
                <Input
                  label="Titulo do material"
                  placeholder="Ex: Two Sum — LeetCode #1"
                  value={title}
                  onValueChange={setTitle}
                  variant="bordered"
                  size="lg"
                  classNames={{
                    label: 'text-default-600 font-medium',
                    inputWrapper: 'shadow-none',
                  }}
                />

                <Input
                  label="URL do material"
                  placeholder="https://leetcode.com/problems/two-sum"
                  value={url}
                  onValueChange={setUrl}
                  variant="bordered"
                  startContent={<Link2 className="h-4 w-4 text-default-400 flex-shrink-0" />}
                  endContent={
                    url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-600">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )
                  }
                  classNames={{
                    label: 'text-default-600 font-medium',
                    inputWrapper: 'shadow-none',
                  }}
                />

                <Textarea
                  label="Descricao"
                  placeholder="Breve descricao do conteudo e objetivos de aprendizado..."
                  value={description}
                  onValueChange={setDescription}
                  variant="bordered"
                  minRows={2}
                  maxRows={4}
                  classNames={{
                    label: 'text-default-600 font-medium',
                    inputWrapper: 'shadow-none',
                  }}
                />
              </div>

              {/* Classification section */}
              <div>
                <p className="text-sm font-semibold text-default-700 mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Classificacao
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Select
                    label="Formato"
                    selectedKeys={format ? [format] : []}
                    onSelectionChange={(keys) => setFormat([...keys][0] as string)}
                    variant="bordered"
                    classNames={{
                      label: 'text-default-600 font-medium',
                      trigger: 'shadow-none',
                    }}
                    renderValue={(items) => {
                      return items.map((item) => {
                        const f = FORMATS.find((fm) => fm.key === item.key);
                        return (
                          <div key={item.key} className="flex items-center gap-2">
                            <span>{f?.emoji}</span>
                            <span>{f?.label}</span>
                          </div>
                        );
                      });
                    }}
                  >
                    {FORMATS.map((f) => (
                      <SelectItem key={f.key} textValue={f.label}>
                        <div className="flex items-center gap-2">
                          <span>{f.emoji}</span>
                          <span>{f.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    label="Dificuldade"
                    selectedKeys={difficulty ? [difficulty] : []}
                    onSelectionChange={(keys) => setDifficulty([...keys][0] as string)}
                    variant="bordered"
                    classNames={{
                      label: 'text-default-600 font-medium',
                      trigger: 'shadow-none',
                    }}
                    renderValue={(items) => {
                      return items.map((item) => {
                        const d = DIFFICULTIES.find((df) => df.key === item.key);
                        return d ? (
                          <Chip key={item.key} size="sm" color={d.color} variant="flat">{d.label}</Chip>
                        ) : null;
                      });
                    }}
                  >
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d.key} textValue={d.label}>
                        <Chip size="sm" color={d.color} variant="flat">{d.label}</Chip>
                      </SelectItem>
                    ))}
                  </Select>

                  <Input
                    label="Tempo (min)"
                    type="number"
                    placeholder="45"
                    value={estimatedMinutes}
                    onValueChange={setEstimatedMinutes}
                    variant="bordered"
                    startContent={<Clock className="h-4 w-4 text-default-400 flex-shrink-0" />}
                    classNames={{
                      label: 'text-default-600 font-medium',
                      inputWrapper: 'shadow-none',
                    }}
                  />
                </div>
              </div>

              {/* Tags section */}
              <div>
                <p className="text-sm font-semibold text-default-700 mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </p>
                <Input
                  placeholder="Digite e pressione Enter para adicionar..."
                  value={tagInput}
                  onValueChange={setTagInput}
                  onKeyDown={handleTagKeyDown}
                  variant="bordered"
                  classNames={{
                    inputWrapper: 'shadow-none',
                  }}
                />
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((tag) => (
                      <Chip
                        key={tag}
                        size="sm"
                        variant="flat"
                        onClose={() => removeTag(tag)}
                      >
                        {tag}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview card when format is selected */}
              {selectedFormat && title && (
                <div className="bg-default-50 border border-default-200 rounded-xl p-4">
                  <p className="text-xs text-default-400 mb-2">Preview</p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{selectedFormat.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-default-800 truncate">{title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-default-500">{selectedFormat.label}</span>
                        {estimatedMinutes && <span className="text-xs text-default-400">· {estimatedMinutes}min</span>}
                        {difficulty && (
                          <Chip size="sm" color={DIFFICULTIES.find((d) => d.key === difficulty)?.color} variant="flat" className="text-[10px]">
                            {DIFFICULTIES.find((d) => d.key === difficulty)?.label}
                          </Chip>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="pt-2">
              <Button variant="flat" color="default" onPress={closeModal}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={() => mutation.mutate()}
                isLoading={mutation.isPending}
                isDisabled={!isValid}
              >
                {isEditing ? 'Salvar alteracoes' : 'Adicionar material'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
