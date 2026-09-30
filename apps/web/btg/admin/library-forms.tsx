'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateLibraryItem,
  useCreateTopic,
  useDeleteTopic,
  useImportUrl,
  useUpdateLibraryItem,
  useUpdateTopic,
  type AdminLibraryItem,
} from '../../lib/queries/admin-library';
import { useTopics, type Topic } from '../../lib/queries/admin-topics';
import { DIFFICULTY, Icon, Modal } from '../ui';

export const FORMAT_LABEL: Record<AdminLibraryItem['format'], string> = {
  VIDEO: 'Vídeo',
  ARTICLE: 'Artigo',
  BOOK: 'Livro',
  PROBLEM: 'Problema',
  OTHER: 'Outro',
};

type Form = {
  title: string;
  url: string;
  description: string;
  format: AdminLibraryItem['format'];
  difficulty: AdminLibraryItem['difficulty'];
  estimatedMinutes: number;
  tags: string;
  primary: string; // topic slug, '' = none
  covers: string[]; // topic slugs
};

// Kind vocabulary from .claude/skills/ics-library-curate (tags are free-form; these are just shortcuts).
const KINDS = ['concept', 'tradeoffs', 'practice', 'case-study', 'career'];
const splitTags = (s: string) => [...new Set(s.split(',').map((t) => t.trim()).filter(Boolean))];

function makeForm(init: AdminLibraryItem | null, defaultSlug: string): Form {
  const primary = init ? init.topics.find((t) => t.isPrimary) ?? init.topics[0] : undefined;
  return {
    title: init?.title ?? '',
    url: init?.url ?? '',
    description: init?.description ?? '',
    format: init?.format ?? 'ARTICLE',
    difficulty: init?.difficulty ?? 'MEDIUM',
    estimatedMinutes: init?.estimatedMinutes ?? 30,
    tags: (init?.tags ?? []).join(', '),
    primary: init ? primary?.slug ?? '' : defaultSlug,
    covers: init ? init.topics.filter((t) => t !== primary).map((t) => t.slug) : [],
  };
}

export function ItemFormModal({
  initial,
  defaultTopicId,
  onClose,
}: {
  initial: AdminLibraryItem | null;
  defaultTopicId: string | null;
  onClose: () => void;
}) {
  const { data: topics } = useTopics();
  const create = useCreateLibraryItem();
  const update = useUpdateLibraryItem();
  const importer = useImportUrl();
  const isEdit = initial !== null;
  const [tab, setTab] = useState<'manual' | 'import'>('manual');
  const [importUrl, setImportUrl] = useState('');
  const [form, setForm] = useState<Form>(() =>
    makeForm(initial, topics?.find((t) => t.id === defaultTopicId)?.slug ?? ''),
  );
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const sortedTopics = [...(topics ?? [])].sort((a, b) => a.order - b.order);

  async function handleImport() {
    const url = importUrl.trim();
    if (!url) return;
    const meta = await importer.mutateAsync(url).catch(() => null);
    if (!meta) return;
    setForm((prev) => ({
      ...prev,
      title: meta.title ?? prev.title,
      url: meta.url ?? url,
      description: meta.description ?? prev.description,
      format: meta.format ?? prev.format,
      estimatedMinutes: meta.estimatedMinutes ?? prev.estimatedMinutes,
    }));
    setTab('manual');
  }

  async function handleSave() {
    // topicSlugs: first is the primary topic, the rest are covers (API contract, see LibraryItemTopic).
    const payload = {
      title: form.title,
      url: form.url || null,
      description: form.description || null,
      format: form.format,
      difficulty: form.difficulty,
      estimatedMinutes: form.estimatedMinutes,
      tags: splitTags(form.tags),
      ...(form.primary ? { topicSlugs: [form.primary, ...form.covers.filter((s) => s !== form.primary)] } : {}),
    };
    if (isEdit) await update.mutateAsync({ id: initial.id, data: payload });
    else await create.mutateAsync(payload);
    onClose();
  }

  const saving = isEdit ? update.isPending : create.isPending;
  const saveError = (isEdit ? update.error : create.error) as Error | null;
  const tagList = splitTags(form.tags);
  const toggleKind = (k: string) =>
    set({ tags: (tagList.includes(k) ? tagList.filter((t) => t !== k) : [k, ...tagList]).join(', ') });

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Editar material' : 'Novo material'}
      width={640}
      footer={
        <>
          <button type="button" className="btg-btn btg-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btg-btn btg-btn--primary"
            onClick={() => void handleSave().catch(() => undefined)}
            disabled={form.title.trim().length === 0 || !(form.estimatedMinutes > 0) || saving}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      {!isEdit && (
        <div className="btg-tabs" role="tablist">
          {(['manual', 'import'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              <Icon name={t === 'manual' ? 'edit_note' : 'link'} />
              {t === 'manual' ? 'Manual' : 'Importar URL'}
            </button>
          ))}
        </div>
      )}

      {!isEdit && tab === 'import' ? (
        <>
          <label className="btg-field">
            URL
            <input className="btg-input" type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://…" />
          </label>
          <div>
            <button
              type="button"
              className="btg-btn btg-btn--outline btg-btn--sm"
              onClick={() => void handleImport()}
              disabled={importer.isPending || importUrl.trim().length === 0}
            >
              <Icon name="download" />
              {importer.isPending ? 'Buscando…' : 'Buscar metadados'}
            </button>
          </div>
          {importer.error && (
            <div className="btg-notice btg-notice--bad">
              <Icon name="error" />
              {(importer.error as Error).message}
            </div>
          )}
          <p className="btg-mute" style={{ fontSize: 13 }}>
            Depois de buscar, revise os campos preenchidos na aba Manual e salve.
          </p>
        </>
      ) : (
        <>
          <label className="btg-field">
            Título
            <input className="btg-input" value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="btg-field">
            URL
            <input className="btg-input" type="url" value={form.url} onChange={(e) => set({ url: e.target.value })} />
          </label>
          <label className="btg-field">
            Descrição
            <textarea className="btg-textarea" rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </label>
          <div className="btg-al-form-grid">
            <label className="btg-field">
              Formato
              <select className="btg-select" value={form.format} onChange={(e) => set({ format: e.target.value as Form['format'] })}>
                {Object.entries(FORMAT_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="btg-field">
              Dificuldade
              <select className="btg-select" value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value as Form['difficulty'] })}>
                {Object.entries(DIFFICULTY).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="btg-field">
              Minutos
              <input
                className="btg-input btg-mono"
                type="number"
                min={1}
                value={form.estimatedMinutes}
                onChange={(e) => set({ estimatedMinutes: Number(e.target.value) })}
              />
            </label>
          </div>

          <label className="btg-field">
            Tópico principal
            <select className="btg-select" value={form.primary} onChange={(e) => set({ primary: e.target.value })}>
              {(!isEdit || initial.topics.length === 0) && <option value="">Sem tópico</option>}
              {sortedTopics.map((t) => (
                <option key={t.id} value={t.slug}>{t.label}</option>
              ))}
            </select>
          </label>
          <div className="btg-field">
            Também cobre
            <div className="btg-al-chips">
              {sortedTopics.map((t) => {
                const on = form.covers.includes(t.slug) && t.slug !== form.primary;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="btg-al-chip"
                    aria-pressed={on}
                    disabled={!form.primary || t.slug === form.primary}
                    onClick={() => set({ covers: on ? form.covers.filter((s) => s !== t.slug) : [...form.covers, t.slug] })}
                  >
                    {on && <Icon name="check" style={{ fontSize: 16 }} />}
                    {t.label}
                  </button>
                );
              })}
            </div>
            <span className="btg-mute" style={{ fontSize: 12 }}>
              O material conta no progresso de todos os tópicos que cobre.
            </span>
          </div>

          <label className="btg-field">
            Tags
            <input className="btg-input" value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="concept, redis, intro" />
          </label>
          <div className="btg-al-chips" aria-label="Tipo do material">
            {KINDS.map((k) => (
              <button key={k} type="button" className="btg-al-chip btg-mono" aria-pressed={tagList.includes(k)} onClick={() => toggleKind(k)}>
                {k}
              </button>
            ))}
          </div>

          {saveError && (
            <div className="btg-notice btg-notice--bad">
              <Icon name="error" />
              {saveError.message}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

const cleanSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '');

export function TopicsModal({ onClose: close }: { onClose: () => void }) {
  const qc = useQueryClient();
  // Topic renames/deletes change the labels embedded in library items.
  const onClose = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'library'] });
    close();
  };
  const { data: topics } = useTopics();
  const createT = useCreateTopic();
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');

  async function add() {
    if (!slug.trim() || !label.trim()) return;
    const created = await createT.mutateAsync({ slug: slug.trim(), label: label.trim() }).catch(() => null);
    if (!created) return; // error shows below the form
    setSlug('');
    setLabel('');
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Gerenciar tópicos"
      width={640}
      footer={
        <button type="button" className="btg-btn btg-btn--primary" onClick={onClose}>
          Concluir
        </button>
      }
    >
      <div className="btg-stack" style={{ gap: 8 }}>
        {(topics ?? []).length === 0 && <div className="btg-al-empty" style={{ padding: 24 }}>Nenhum tópico ainda.</div>}
        {[...(topics ?? [])].sort((a, b) => a.order - b.order).map((t) => (
          <TopicRow key={`${t.id}-${t.slug}-${t.label}`} topic={t} />
        ))}
      </div>
      <div className="btg-stack" style={{ gap: 8, paddingTop: 16, borderTop: '1px solid var(--btg-border)' }}>
        <span className="btg-eyebrow">Novo tópico</span>
        <div className="btg-al-topic-row" style={{ gridTemplateColumns: '140px minmax(0, 1fr) auto' }}>
          <input className="btg-input btg-mono" placeholder="slug (ex.: dp)" value={slug} onChange={(e) => setSlug(cleanSlug(e.target.value))} aria-label="Slug" />
          <input className="btg-input" placeholder="Rótulo" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Rótulo" />
          <button
            type="button"
            className="btg-btn btg-btn--outline btg-btn--sm"
            onClick={() => void add()}
            disabled={createT.isPending || !slug.trim() || !label.trim()}
          >
            <Icon name="add" />
            Adicionar
          </button>
        </div>
        {createT.error && (
          <div className="btg-notice btg-notice--bad">
            <Icon name="error" />
            {(createT.error as Error).message}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TopicRow({ topic }: { topic: Topic }) {
  const updateT = useUpdateTopic();
  const removeT = useDeleteTopic();
  const [slug, setSlug] = useState(topic.slug);
  const [label, setLabel] = useState(topic.label);
  const [confirm, setConfirm] = useState(false);
  const dirty = slug !== topic.slug || label !== topic.label;

  return (
    <div className="btg-al-topic-row">
      <input className="btg-input btg-mono" value={slug} onChange={(e) => setSlug(cleanSlug(e.target.value))} aria-label="Slug" />
      <input className="btg-input" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Rótulo" />
      <button
        type="button"
        className="btg-btn btg-btn--ghost btg-btn--sm"
        style={{ visibility: dirty ? 'visible' : 'hidden' }}
        disabled={updateT.isPending || !slug || !label.trim()}
        onClick={() => updateT.mutate({ id: topic.id, data: { slug, label } })}
      >
        Salvar
      </button>
      <button type="button" className="btg-icon-btn btg-al-danger" aria-label={`Excluir ${topic.label}`} onClick={() => setConfirm(true)}>
        <Icon name="delete" />
      </button>
      {updateT.error && <span className="btg-mute" style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--btg-stuck)' }}>{(updateT.error as Error).message}</span>}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Excluir tópico?"
        width={440}
        footer={
          <>
            <button type="button" className="btg-btn btg-btn--ghost" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btg-btn btg-btn--primary"
              style={{ background: 'var(--btg-stuck)' }}
              onClick={() => {
                setConfirm(false);
                removeT.mutate(topic.id);
              }}
            >
              Excluir
            </button>
          </>
        }
      >
        <p style={{ fontSize: 15, lineHeight: '22px' }}>
          Você vai excluir o tópico <strong>{topic.label}</strong>. Os materiais marcados com ele perdem a marcação.
        </p>
      </Modal>
    </div>
  );
}
