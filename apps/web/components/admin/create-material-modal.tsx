'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  Chip,
  Spinner,
} from '@heroui/react';
import {
  BookOpen,
  Clock,
  ExternalLink,
  Link2,
  Pencil,
  Tag,
  Video,
  FileText,
  Puzzle,
  Paperclip,
  Sparkles,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';

const FORMATS = [
  { key: 'VIDEO', label: 'Video', icon: Video, color: 'text-platform-youtube' },
  { key: 'ARTICLE', label: 'Artigo', icon: FileText, color: 'text-platform-article' },
  { key: 'PROBLEM', label: 'Problema', icon: Puzzle, color: 'text-platform-leetcode' },
  { key: 'BOOK', label: 'Livro', icon: BookOpen, color: 'text-platform-book' },
  { key: 'OTHER', label: 'Outro', icon: Paperclip, color: 'text-foreground-muted' },
] as const;

const DIFFICULTIES = [
  { key: 'EASY', label: 'Facil', bg: 'bg-success-soft', text: 'text-success', border: 'border-success/20' },
  { key: 'MEDIUM', label: 'Medio', bg: 'bg-warning-soft', text: 'text-warning', border: 'border-warning/20' },
  { key: 'HARD', label: 'Dificil', bg: 'bg-danger-soft', text: 'text-danger', border: 'border-danger/20' },
] as const;

type ImportedMetadata = {
  title: string;
  description: string | null;
  source: string | null;
  format: string;
  estimatedMinutes: number;
  url: string;
};

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
  const [step, setStep] = useState<'url' | 'form'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [importedSource, setImportedSource] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const isEditing = !!editItem;

  useEffect(() => {
    if (editItem) {
      setStep('form');
      setTitle(editItem.title);
      setUrl(editItem.url ?? '');
      setUrlInput(editItem.url ?? '');
      setDescription(editItem.description ?? '');
      setFormat(editItem.format);
      setDifficulty(editItem.difficulty);
      setEstimatedMinutes(String(editItem.estimatedMinutes));
      setTags(editItem.tags);
      setTagInput('');
      setImportedSource(null);
    } else {
      setStep('url');
      setTitle('');
      setUrl('');
      setUrlInput('');
      setDescription('');
      setFormat('');
      setDifficulty('');
      setEstimatedMinutes('');
      setTags([]);
      setTagInput('');
      setImportedSource(null);
    }
  }, [editItem, isOpen]);

  const importMutation = useMutation({
    mutationFn: (importUrl: string) =>
      apiFetch<ImportedMetadata>('/library/import', {
        method: 'POST',
        body: JSON.stringify({ url: importUrl }),
      }),
    onSuccess: (data) => {
      setTitle(data.title);
      setUrl(data.url);
      setDescription(data.description ?? '');
      setFormat(data.format);
      setEstimatedMinutes(String(data.estimatedMinutes));
      setImportedSource(data.source);
      setStep('form');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        title,
        url: url || null,
        description: description || null,
        format,
        difficulty,
        estimatedMinutes: Number(estimatedMinutes),
        source: importedSource,
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

  const handleImportUrl = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      return;
    }
    importMutation.mutate(trimmed);
  }, [urlInput, importMutation]);

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleImportUrl();
    }
  };

  const handleSkipToManual = () => {
    setStep('form');
  };

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

  const isValid = title.trim() && format && difficulty && Number(estimatedMinutes) > 0;
  const selectedFormat = FORMATS.find((f) => f.key === format);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      backdrop="blur"
      placement="center"
      classNames={{
        base: 'border border-border bg-surface',
        header: 'border-b border-border',
        footer: 'border-t border-border',
      }}
    >
      <ModalContent>
        {(closeModal) => (
          <>
            <ModalHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    isEditing ? 'bg-warning-soft' : 'bg-brand-soft'
                  }`}
                >
                  {isEditing ? (
                    <Pencil className="h-5 w-5 text-warning" />
                  ) : (
                    <BookOpen className="h-5 w-5 text-brand" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {isEditing ? 'Editar material' : 'Novo material'}
                  </h2>
                  <p className="text-body-sm text-foreground-muted font-normal">
                    {isEditing
                      ? 'Atualize as informacoes do material'
                      : step === 'url'
                        ? 'Cole o link e preenchemos tudo automaticamente'
                        : 'Confira e ajuste os detalhes'}
                  </p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="gap-0 py-5">
              {step === 'url' && !isEditing ? (
                /* ---- Step 1: URL input ---- */
                <div className="space-y-6">
                  <div className="relative">
                    <Input
                      autoFocus
                      label="Link do material"
                      placeholder="https://leetcode.com/problems/two-sum"
                      value={urlInput}
                      onValueChange={setUrlInput}
                      onKeyDown={handleUrlKeyDown}
                      variant="bordered"
                      size="lg"
                      startContent={<Link2 className="h-4 w-4 text-foreground-subtle flex-shrink-0" />}
                      endContent={
                        importMutation.isPending ? (
                          <Spinner size="sm" />
                        ) : urlInput.trim() ? (
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            isIconOnly
                            onPress={handleImportUrl}
                            className="rounded-lg"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        ) : null
                      }
                      classNames={{
                        label: 'text-foreground-muted font-medium',
                        inputWrapper: 'shadow-none bg-surface',
                      }}
                    />
                  </div>

                  {importMutation.isError && (
                    <div className="flex items-center gap-2 text-danger text-body-sm bg-danger-soft rounded-lg px-3 py-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>Nao foi possivel importar. Verifique o link ou preencha manualmente.</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-caption text-foreground-subtle uppercase tracking-wider">ou</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <Button
                    variant="flat"
                    color="default"
                    onPress={handleSkipToManual}
                    className="w-full"
                    startContent={<Pencil className="h-4 w-4" />}
                  >
                    Preencher manualmente
                  </Button>

                  <div className="bg-brand-soft rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-brand mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-body-sm font-semibold text-brand-soft-foreground">
                          Import automatico
                        </p>
                        <p className="text-caption text-foreground-muted mt-1">
                          Reconhecemos YouTube, LeetCode, Medium, NeetCode e mais.
                          Titulo, formato e tempo estimado sao preenchidos automaticamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ---- Step 2: Full form ---- */
                <div className="space-y-5">
                  {/* Imported source badge */}
                  {importedSource && (
                    <div className="flex items-center gap-2 bg-success-soft rounded-lg px-3 py-2">
                      <Check className="h-4 w-4 text-success flex-shrink-0" />
                      <span className="text-body-sm text-foreground">
                        Importado de <span className="font-semibold">{importedSource}</span>
                      </span>
                    </div>
                  )}

                  {/* Title */}
                  <Input
                    autoFocus={step === 'form' && !importedSource}
                    label="Titulo"
                    placeholder="Ex: Two Sum — LeetCode #1"
                    value={title}
                    onValueChange={setTitle}
                    variant="bordered"
                    size="lg"
                    classNames={{
                      label: 'text-foreground-muted font-medium',
                      inputWrapper: 'shadow-none bg-surface',
                    }}
                  />

                  {/* URL (editable, pre-filled if imported) */}
                  <Input
                    label="URL"
                    placeholder="https://..."
                    value={url}
                    onValueChange={setUrl}
                    variant="bordered"
                    startContent={<Link2 className="h-4 w-4 text-foreground-subtle flex-shrink-0" />}
                    endContent={
                      url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand hover:text-brand-hover transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )
                    }
                    classNames={{
                      label: 'text-foreground-muted font-medium',
                      inputWrapper: 'shadow-none bg-surface',
                    }}
                  />

                  {/* Description */}
                  <Textarea
                    label="Descricao"
                    placeholder="Breve descricao do conteudo e objetivos de aprendizado..."
                    value={description}
                    onValueChange={setDescription}
                    variant="bordered"
                    minRows={2}
                    maxRows={4}
                    classNames={{
                      label: 'text-foreground-muted font-medium',
                      inputWrapper: 'shadow-none bg-surface',
                    }}
                  />

                  {/* Format selector — pill buttons */}
                  <div>
                    <p className="text-body-sm font-semibold text-foreground mb-2.5">Formato</p>
                    <div className="flex flex-wrap gap-2">
                      {FORMATS.map((f) => {
                        const Icon = f.icon;
                        const isSelected = format === f.key;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setFormat(f.key)}
                            className={`
                              flex items-center gap-2 px-4 py-2 rounded-pill text-body-sm font-medium
                              transition-all duration-150
                              ${
                                isSelected
                                  ? 'bg-brand text-white shadow-glow-primary'
                                  : 'bg-surface-muted text-foreground-muted hover:bg-surface-subtle hover:text-foreground border border-border'
                              }
                            `}
                          >
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : f.color}`} />
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Difficulty + Time row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-body-sm font-semibold text-foreground mb-2.5">Dificuldade</p>
                      <div className="flex gap-2">
                        {DIFFICULTIES.map((d) => {
                          const isSelected = difficulty === d.key;
                          return (
                            <button
                              key={d.key}
                              type="button"
                              onClick={() => setDifficulty(d.key)}
                              className={`
                                flex-1 py-2 rounded-pill text-body-sm font-medium text-center
                                transition-all duration-150 border
                                ${
                                  isSelected
                                    ? `${d.bg} ${d.text} ${d.border} shadow-sm`
                                    : 'bg-surface-muted text-foreground-muted border-border hover:bg-surface-subtle'
                                }
                              `}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-body-sm font-semibold text-foreground mb-2.5">Tempo estimado</p>
                      <Input
                        type="number"
                        placeholder="45"
                        value={estimatedMinutes}
                        onValueChange={setEstimatedMinutes}
                        variant="bordered"
                        startContent={<Clock className="h-4 w-4 text-foreground-subtle flex-shrink-0" />}
                        endContent={
                          <span className="text-caption text-foreground-subtle">min</span>
                        }
                        classNames={{
                          inputWrapper: 'shadow-none bg-surface',
                        }}
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <p className="text-body-sm font-semibold text-foreground mb-2.5 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-foreground-muted" />
                      Tags
                    </p>
                    <Input
                      placeholder="Digite e pressione Enter..."
                      value={tagInput}
                      onValueChange={setTagInput}
                      onKeyDown={handleTagKeyDown}
                      variant="bordered"
                      classNames={{
                        inputWrapper: 'shadow-none bg-surface',
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
                            classNames={{
                              base: 'bg-brand-soft text-brand-soft-foreground',
                              closeButton: 'text-brand-soft-foreground/60 hover:text-brand-soft-foreground',
                            }}
                          >
                            {tag}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Preview card */}
                  {selectedFormat && title && (
                    <div className="bg-surface-muted border border-border rounded-xl p-4 mt-1">
                      <p className="text-caption text-foreground-subtle mb-2.5 uppercase tracking-wider">
                        Preview
                      </p>
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            format === 'VIDEO'
                              ? 'bg-[hsl(var(--platform-youtube)/0.1)]'
                              : format === 'PROBLEM'
                                ? 'bg-[hsl(var(--platform-leetcode)/0.1)]'
                                : format === 'BOOK'
                                  ? 'bg-[hsl(var(--platform-book)/0.1)]'
                                  : format === 'ARTICLE'
                                    ? 'bg-[hsl(var(--platform-article)/0.1)]'
                                    : 'bg-surface-subtle'
                          }`}
                        >
                          <selectedFormat.icon className={`h-5 w-5 ${selectedFormat.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-body-sm font-semibold text-foreground truncate">{title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-caption text-foreground-muted">{selectedFormat.label}</span>
                            {estimatedMinutes && (
                              <span className="text-caption text-foreground-subtle">
                                {estimatedMinutes} min
                              </span>
                            )}
                            {difficulty && (
                              <span
                                className={`text-caption font-medium ${
                                  DIFFICULTIES.find((d) => d.key === difficulty)?.text
                                }`}
                              >
                                {DIFFICULTIES.find((d) => d.key === difficulty)?.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ModalBody>

            <ModalFooter className="pt-3">
              {step === 'form' && !isEditing && (
                <Button
                  variant="light"
                  color="default"
                  onPress={() => setStep('url')}
                  className="mr-auto text-foreground-muted"
                >
                  Voltar
                </Button>
              )}
              <Button variant="flat" color="default" onPress={closeModal}>
                Cancelar
              </Button>
              {step === 'form' && (
                <Button
                  color="primary"
                  onPress={() => saveMutation.mutate()}
                  isLoading={saveMutation.isPending}
                  isDisabled={!isValid}
                  className="rounded-pill px-6 font-semibold"
                >
                  {isEditing ? 'Salvar alteracoes' : 'Adicionar material'}
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
