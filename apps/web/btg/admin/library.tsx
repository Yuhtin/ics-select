'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useAdminLibrary,
  useDeleteLibraryItem,
  type AdminLibraryItem,
} from '../../lib/queries/admin-library';
import { useTopics } from '../../lib/queries/admin-topics';
import { fuseFilter } from '../../lib/library/fuse-index';
import { PHASES, topicPhase, type PhaseKey } from '../../lib/topics/phase';
import { groupTopicsByCategory, type TopicCategory } from '../../lib/format/topic-category';
import { detectPlatform } from '../../lib/format/platform';
import { extractYoutubeVideoId, youtubeThumb } from '../../lib/format/youtube';
import { DIFFICULTY, Icon, Loading, Modal, platformOf } from '../ui';
import { FORMAT_LABEL, ItemFormModal, TopicsModal } from './library-forms';

const TRACK_LABEL: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consultoria tech',
  COMPETITIVE_PROGRAMMING: 'Programação competitiva',
  STARTUP: 'Startup',
  OTHER: 'Outra trilha',
};
const PHASE_LABEL: Record<PhaseKey, string> = {
  foundations: 'Fundamentos',
  algorithms: 'Algoritmos e estruturas de dados',
  engineering: 'Fundamentos de engenharia',
  'sd-blocks': 'System design · blocos',
  'sd-concepts': 'System design · conceitos',
  'sd-cases': 'System design · casos',
};
const CATEGORY_LABEL: Record<TopicCategory, string> = {
  'Data Structures & Algorithms': 'Algoritmos e estruturas de dados',
  'Infra & DevOps': 'Infra e DevOps',
  'System Components': 'Componentes de sistema',
  Principles: 'Princípios',
  Cases: 'Casos',
  Other: 'Outros',
};

const DIFFICULTY_RANK: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

// Same order as sortLibraryItems in app/(admin)/admin/library/page.tsx (keep in sync):
// primary Topic.order → LibraryItemTopic.order of the focused (or primary) topic, NULLS LAST
// → EASY/MEDIUM/HARD → title A-Z.
function sortLibraryItems(items: AdminLibraryItem[], order: Record<string, number>, focusedTopicId: string | null) {
  const topicRow = (item: AdminLibraryItem) =>
    focusedTopicId
      ? item.topics.find((t) => t.id === focusedTopicId) ?? item.topics.find((t) => t.isPrimary) ?? item.topics[0]
      : item.topics.find((t) => t.isPrimary) ?? item.topics[0];
  return [...items].sort((a, b) => {
    const aRow = topicRow(a);
    const bRow = topicRow(b);
    const aOrder = aRow ? order[aRow.slug] ?? 999 : 999;
    const bOrder = bRow ? order[bRow.slug] ?? 999 : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aManual = aRow?.order ?? null;
    const bManual = bRow?.order ?? null;
    if (aManual !== bManual) {
      if (aManual === null) return 1;
      if (bManual === null) return -1;
      return aManual - bManual;
    }
    const aDiff = DIFFICULTY_RANK[a.difficulty] ?? 9;
    const bDiff = DIFFICULTY_RANK[b.difficulty] ?? 9;
    if (aDiff !== bDiff) return aDiff - bDiff;
    return a.title.localeCompare(b.title);
  });
}

function groupByPhase(items: AdminLibraryItem[], order: Record<string, number>) {
  const byPhase = new Map<PhaseKey, AdminLibraryItem[]>();
  for (const item of items) {
    const primary = item.topics.find((t) => t.isPrimary) ?? item.topics[0];
    const topicOrder = primary ? order[primary.slug] : undefined;
    if (topicOrder === undefined) continue;
    const phase = topicPhase(topicOrder);
    byPhase.set(phase, [...(byPhase.get(phase) ?? []), item]);
  }
  return PHASES.map((p) => ({ key: p.key, label: PHASE_LABEL[p.key], items: byPhase.get(p.key) ?? [] })).filter(
    (p) => p.items.length > 0,
  );
}

const csv = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export function BtgLibrary() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: topics } = useTopics();
  const { data: items, isLoading } = useAdminLibrary();
  const remove = useDeleteLibraryItem();

  const query = params.get('q') ?? '';
  const topicId = params.get('topic');
  const formats = csv(params.get('format'));
  const difficulties = csv(params.get('difficulty'));
  const tracks = csv(params.get('track'));

  const [searchInput, setSearchInput] = useState(query);
  const [form, setForm] = useState<{ item: AdminLibraryItem | null } | null>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminLibraryItem | null>(null);

  function writeUrl(next: Record<string, string | string[] | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      const s = Array.isArray(v) ? v.join(',') : v;
      if (s) sp.set(k, s);
      else sp.delete(k);
    }
    sp.delete('page');
    router.replace(`?${sp.toString()}`);
  }

  useEffect(() => setSearchInput(query), [query]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== query) writeUrl({ q: searchInput });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // "/" focuses search; clicking outside closes the filter dropdowns.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        document.getElementById('btg-al-search')?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      document.querySelectorAll<HTMLDetailsElement>('.btg-al-menu[open]').forEach((d) => {
        if (!d.contains(e.target as Node)) d.open = false;
      });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  const all = useMemo(() => items ?? [], [items]);
  const topicOrder = useMemo(() => Object.fromEntries((topics ?? []).map((t) => [t.slug, t.order])), [topics]);
  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of all) for (const t of it.topics) m.set(t.id, (m.get(t.id) ?? 0) + 1);
    return m;
  }, [all]);

  const filtered = useMemo(() => {
    let list = all;
    if (topicId) list = list.filter((i) => i.topics.some((t) => t.id === topicId));
    if (formats.length) list = list.filter((i) => formats.includes(i.format));
    if (difficulties.length) list = list.filter((i) => difficulties.includes(i.difficulty));
    if (tracks.length) list = list.filter((i) => !i.tracks?.length || i.tracks.some((t) => tracks.includes(t)));
    // Search relevance wins over learning order.
    if (query.trim().length >= 2) return fuseFilter(list, query);
    return sortLibraryItems(list, topicOrder, topicId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, topicId, formats.join(','), difficulties.join(','), tracks.join(','), query, topicOrder]);

  const anyFilter = query.length > 0 || !!topicId || formats.length > 0 || difficulties.length > 0 || tracks.length > 0;
  const phases = useMemo(() => (anyFilter ? [] : groupByPhase(filtered, topicOrder)), [anyFilter, filtered, topicOrder]);
  const clearAll = () => {
    setSearchInput('');
    router.replace('?');
  };

  const cardProps = { onEdit: (item: AdminLibraryItem) => setForm({ item }), onDelete: setDeleteTarget };

  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          <span>Biblioteca de estudos</span>
          <span>Acervo</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={() => setTopicsOpen(true)}>
            <Icon name="category" />
            Gerenciar tópicos
          </button>
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => setForm({ item: null })}>
            <Icon name="add" />
            Novo material
          </button>
        </div>
      </header>

      <main className="btg-al-main">
        <section className="btg-card btg-al-filters">
          <div className="btg-al-search">
            <Icon name="search" />
            <input
              id="btg-al-search"
              className="btg-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por título, URL, tópico ou formato (atalho: /)"
              aria-label="Buscar no acervo"
            />
            {searchInput && (
              <button type="button" className="btg-icon-btn" aria-label="Limpar busca" onClick={() => setSearchInput('')}>
                <Icon name="close" />
              </button>
            )}
          </div>
          <div className="btg-al-filter-row">
            <select
              className="btg-select"
              aria-label="Tópico"
              value={topicId ?? ''}
              onChange={(e) => writeUrl({ topic: e.target.value || null })}
            >
              <option value="">Todos os tópicos ({all.length})</option>
              {groupTopicsByCategory(topics ?? []).map((g) => (
                <optgroup key={g.category} label={CATEGORY_LABEL[g.category]}>
                  {g.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({topicCounts.get(t.id) ?? 0})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <MultiFilter label="Formato" options={FORMAT_LABEL} value={formats} onChange={(v) => writeUrl({ format: v })} />
            <MultiFilter label="Dificuldade" options={DIFFICULTY} value={difficulties} onChange={(v) => writeUrl({ difficulty: v })} />
            <MultiFilter label="Trilha" options={TRACK_LABEL} value={tracks} onChange={(v) => writeUrl({ track: v })} />
            {anyFilter && (
              <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={clearAll}>
                <Icon name="filter_alt_off" />
                Limpar filtros
              </button>
            )}
            <span className="btg-mono btg-mute" style={{ fontSize: 13, marginLeft: 'auto' }}>
              {anyFilter
                ? `${filtered.length} de ${all.length}`
                : `${all.length} ${all.length === 1 ? 'material' : 'materiais'} · ${phases.length} ${phases.length === 1 ? 'fase' : 'fases'}`}
            </span>
          </div>
        </section>

        {isLoading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <div className="btg-al-empty">
            <Icon name="search_off" style={{ fontSize: 32 }} />
            Nenhum material corresponde aos filtros.
            {anyFilter && (
              <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={clearAll}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : anyFilter ? (
          <div className="btg-al-grid">
            {filtered.map((item) => (
              <LibraryCard key={item.id} item={item} {...cardProps} />
            ))}
          </div>
        ) : (
          phases.map((phase) => (
            <section key={phase.key} className="btg-stack" style={{ gap: 8 }}>
              <div className="btg-al-shelf-head">
                <h2>{phase.label}</h2>
                <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>{phase.items.length}</span>
              </div>
              <div className="btg-al-shelf">
                {phase.items.map((item) => (
                  <LibraryCard key={item.id} item={item} {...cardProps} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {form && <ItemFormModal initial={form.item} defaultTopicId={topicId} onClose={() => setForm(null)} />}
      {topicsOpen && <TopicsModal onClose={() => setTopicsOpen(false)} />}
      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!remove.isPending) setDeleteTarget(null);
        }}
        title="Excluir material?"
        width={480}
        footer={
          <>
            <button type="button" className="btg-btn btg-btn--ghost" onClick={() => setDeleteTarget(null)} disabled={remove.isPending}>
              Cancelar
            </button>
            <button
              type="button"
              className="btg-btn btg-btn--primary"
              style={{ background: 'var(--btg-stuck)' }}
              disabled={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              {remove.isPending ? 'Excluindo…' : 'Excluir'}
            </button>
          </>
        }
      >
        {remove.isError && (
          <div className="btg-notice btg-notice--bad" role="alert">
            <Icon name="error" />
            Não foi possível concluir: {remove.error instanceof Error ? remove.error.message : 'erro desconhecido'}.
          </div>
        )}
        <p style={{ fontSize: 15, lineHeight: '22px' }}>
          Você vai excluir <strong>{deleteTarget?.title}</strong>. Membros que já têm este material em planos ativos
          continuam podendo concluí-lo.
        </p>
      </Modal>
    </>
  );
}

function MultiFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Record<string, string>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <details className="btg-al-menu" data-active={value.length > 0}>
      <summary className="btg-btn btg-btn--outline btg-btn--sm">
        {label}
        {value.length > 0 && <span className="btg-mono">({value.length})</span>}
        <Icon name="expand_more" style={{ fontSize: 18 }} />
      </summary>
      <div className="btg-al-menu-pop">
        {Object.entries(options).map(([v, l]) => (
          <label key={v} className="btg-al-check">
            <input
              type="checkbox"
              checked={value.includes(v)}
              onChange={() => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])}
            />
            {l}
          </label>
        ))}
      </div>
    </details>
  );
}

const SOURCE_PREFIX_RE = /^(YouTube|Book|Medium|GitHub|Article|LeetCode|Substack|Blog)\s[—-]\s/i;

function LibraryCard({
  item,
  onEdit,
  onDelete,
}: {
  item: AdminLibraryItem;
  onEdit: (item: AdminLibraryItem) => void;
  onDelete: (item: AdminLibraryItem) => void;
}) {
  const platform = platformOf(item.url, item.format);
  const ytId = detectPlatform(item.url, item.format) === 'youtube' ? extractYoutubeVideoId(item.url) : null;
  const [thumbFailed, setThumbFailed] = useState(false);
  const primary = item.topics.find((t) => t.isPrimary) ?? item.topics[0];
  const covers = item.topics.filter((t) => t !== primary);
  const source = item.source?.trim().replace(SOURCE_PREFIX_RE, '') || null;

  return (
    <article className="btg-card btg-al-card">
      <button type="button" className="btg-al-card-main" onClick={() => onEdit(item)} aria-label={`Editar ${item.title}`}>
        <div className="btg-al-thumb" style={{ ['--btg-al-platform' as string]: platform.color }}>
          {ytId && !thumbFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={youtubeThumb(ytId, 'hq')} alt="" loading="lazy" onError={() => setThumbFailed(true)} />
          ) : (
            <Icon name={{ VIDEO: 'play_circle', ARTICLE: 'article', BOOK: 'menu_book', PROBLEM: 'code', OTHER: 'link' }[item.format]} />
          )}
          <span className="btg-al-badge" style={{ left: 10 }}>{platform.label}</span>
          <span className="btg-al-badge btg-mono" style={{ right: 10 }}>{item.estimatedMinutes} min</span>
        </div>
        <div className="btg-al-card-body">
          <span className="btg-eyebrow" style={{ fontSize: 11 }}>
            {primary?.label ?? 'Sem tópico'}
            {primary?.order != null && <span className="btg-mono"> · #{primary.order}</span>}
          </span>
          <span className="btg-al-card-title">{item.title}</span>
          <span className="btg-al-card-meta">
            <span className="btg-pill btg-pill--neutral">{DIFFICULTY[item.difficulty]}</span>
            {covers.length > 0 && <span title={covers.map((c) => c.label).join(', ')}>+{covers.length} {covers.length === 1 ? 'tópico' : 'tópicos'}</span>}
            {source && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{source}</span>}
          </span>
        </div>
      </button>
      <div className="btg-al-card-foot">
        <button type="button" className="btg-icon-btn" aria-label="Editar" title="Editar" onClick={() => onEdit(item)}>
          <Icon name="edit" />
        </button>
        <button type="button" className="btg-icon-btn btg-al-danger" aria-label="Excluir" title="Excluir" onClick={() => onDelete(item)}>
          <Icon name="delete" />
        </button>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="btg-icon-btn" aria-label="Abrir link" title="Abrir link" style={{ marginLeft: 'auto' }}>
            <Icon name="open_in_new" />
          </a>
        )}
      </div>
    </article>
  );
}
