'use client';
import { useState } from 'react';
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from '@heroui/react';
import { Sparkles, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { Eyebrow } from '../../ui/eyebrow';
import { SectionLabel } from '../../ui/section-label';
import type { AiDraft } from '../../../lib/queries/admin-plan-editor';
import type { LibraryItem } from '../../../lib/queries/library-search';

export type AiSuggestDrawerProps = {
  open: boolean;
  onClose: () => void;
  draft: AiDraft | null;
  libraryById: Map<string, LibraryItem>;
  topicNameById: Map<string, string>;
  carryOverLibraryItemIds: Set<string>;
  addedLibraryItemIds: Set<string>;
  loading: boolean;
  onGenerate: (brief?: string) => void;
  onAddItem: (libraryItemId: string) => void;
};

export function AiSuggestDrawer(props: AiSuggestDrawerProps) {
  const [brief, setBrief] = useState('');
  const [briefOpen, setBriefOpen] = useState(false);

  const visibleItems = (props.draft?.items ?? [])
    .filter((i) => !props.addedLibraryItemIds.has(i.libraryItemId))
    .sort((a, b) => a.order - b.order);
  const visibleAlternates = (props.draft?.alternates ?? []).filter(
    (a) => !props.addedLibraryItemIds.has(a.libraryItemId),
  );

  return (
    <Drawer isOpen={props.open} onClose={props.onClose} placement="right" size="md" classNames={{ base: 'border-l border-border-token bg-surface text-fg shadow-modal', closeButton: 'text-fg-mute hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-primary' }}>
      <DrawerContent>
        <DrawerHeader className="flex items-center gap-2 border-b border-border-token">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <Eyebrow>AI Draft · GPT-5.4-mini</Eyebrow>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          {props.loading ? (
            <p className="py-12 text-center font-sans text-xs text-fg-mute">
              Gerando… (10-20s)
            </p>
          ) : !props.draft ? (
            <EmptyForm
              brief={brief}
              setBrief={setBrief}
              onGenerate={() => props.onGenerate(brief.trim() || undefined)}
            />
          ) : (
            <>
              <p className="font-sans text-base italic leading-relaxed text-fg">
                {props.draft.narrative}
              </p>
              <p className="font-sans text-xs text-fg-mute">
                {props.draft.items.length} items · {props.draft.totalMinutes} min
              </p>
              <details
                open={briefOpen}
                onToggle={(e) =>
                  setBriefOpen((e.target as HTMLDetailsElement).open)
                }
              >
                <summary className="cursor-pointer font-sans text-xs text-fg-soft hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                  ⟲ Regenerar com nova direção
                </summary>
                <div className="mt-3 space-y-2">
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value.slice(0, 200))}
                    rows={3}
                    placeholder="Ex: quero todos os vídeos de foundations."
                    className="w-full resize-none rounded-input border border-border-token bg-bg p-3 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => props.onGenerate(brief.trim() || undefined)}
                    className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-1.5 font-sans text-xs text-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <Zap className="h-3 w-3" strokeWidth={1.5} />
                    Regenerar
                  </button>
                </div>
              </details>

              <section>
                <SectionLabel>Suggested · {visibleItems.length}</SectionLabel>
                <div className="mt-3 space-y-3">
                  {visibleItems.map((suggested, idx) => {
                    const item = props.libraryById.get(suggested.libraryItemId);
                    if (!item) return null;
                    const isCarried = props.carryOverLibraryItemIds.has(
                      suggested.libraryItemId,
                    );
                    const topicName = item.topicId
                      ? (props.topicNameById.get(item.topicId) ?? null)
                      : null;
                    return (
                      <div
                        key={suggested.libraryItemId}
                        className={clsx(
                          'rounded-card border p-3',
                          isCarried
                            ? 'border-accent/40 bg-bg-subtle'
                            : 'border-border-token bg-surface',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="min-w-[1.5ch] font-sans text-base font-semibold text-fg-mute">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            {isCarried && (
                              <span className="mb-1 inline-block rounded-pill border border-accent/40 px-1.5 py-0.5 font-sans text-xs text-accent">
                                carried over
                              </span>
                            )}
                            <p className="font-sans text-sm font-semibold text-fg">
                              {item.title}
                            </p>
                            <p className="mt-0.5 font-sans text-xs text-fg-mute">
                              {item.format}
                              {topicName ? ` · ${topicName}` : ''} · {item.estimatedMinutes}m
                            </p>
                            <blockquote className="mt-2 border-l-2 border-border-strong py-0.5 pl-2 font-sans text-xs italic text-fg-soft">
                              <span className="mr-1 font-sans text-xs not-italic font-medium text-fg-mute">
                                why
                              </span>
                              {suggested.rationale}
                            </blockquote>
                          </div>
                          <button
                            type="button"
                            onClick={() => props.onAddItem(suggested.libraryItemId)}
                            className="whitespace-nowrap rounded-pill bg-primary px-3 py-1 font-sans text-xs text-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                          >
                            Add →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {visibleAlternates.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-sans text-xs font-semibold text-fg-mute hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                    Or consider · {visibleAlternates.length}
                  </summary>
                  <div className="mt-3 space-y-2">
                    {visibleAlternates.map((alt) => {
                      const item = props.libraryById.get(alt.libraryItemId);
                      if (!item) return null;
                      return (
                        <div
                          key={alt.libraryItemId}
                          className="flex items-start gap-3 rounded-card border border-border-token bg-bg px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-sans text-sm font-semibold text-fg">
                              {item.title}
                            </p>
                            <p className="mt-0.5 font-sans text-xs text-fg-mute">
                              {alt.rationale}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => props.onAddItem(alt.libraryItemId)}
                            className="whitespace-nowrap rounded-pill bg-primary px-3 py-1 font-sans text-xs text-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                          >
                            Add →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function EmptyForm(props: {
  brief: string;
  setBrief: (v: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="font-sans text-xl font-semibold text-fg">
          Sugerir um plano
        </h2>
        <p className="font-sans text-sm text-fg-soft">
          Usa últimas 4 semanas, retro, topic coverage, carry-overs e a track do
          membro.
        </p>
      </div>
      <div className="space-y-1">
        <label className="font-sans text-xs text-fg-mute">
          Direção (opcional)
        </label>
        <textarea
          value={props.brief}
          onChange={(e) => props.setBrief(e.target.value.slice(0, 200))}
          rows={3}
          placeholder="Ex: quero todos os vídeos de foundations."
          className="w-full resize-none rounded-input border border-border-token bg-bg p-3 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <p className="text-right font-sans text-xs text-fg-mute">
          {props.brief.length} / 200
        </p>
      </div>
      <button
        type="button"
        onClick={props.onGenerate}
        className="inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 font-sans text-xs text-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <Zap className="h-4 w-4" strokeWidth={1.5} />
        Gerar
      </button>
    </div>
  );
}
