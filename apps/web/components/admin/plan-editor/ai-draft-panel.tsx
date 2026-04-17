'use client';
import { Sparkles, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import type { AiDraft } from '../../../lib/queries/admin-plan-editor';
import type { LibraryItem } from '../../../lib/queries/library-search';
import { Eyebrow } from '../../ui/eyebrow';
import { SectionLabel } from '../../ui/section-label';

export interface AiDraftPanelProps {
  draft: AiDraft | null;
  libraryById: Map<string, LibraryItem>;
  topicNameById: Map<string, string>;
  carryOverLibraryItemIds: Set<string>;
  addedLibraryItemIds: Set<string>;
  loading: boolean;
  onGenerate: () => void;
  onOpenBrief: () => void;
  onAddItem: (libraryItemId: string) => void;
}

export function AiDraftPanel({
  draft,
  libraryById,
  topicNameById,
  carryOverLibraryItemIds,
  addedLibraryItemIds,
  loading,
  onGenerate,
  onOpenBrief,
  onAddItem,
}: AiDraftPanelProps) {
  if (!draft && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <Eyebrow>AI Draft · GPT-5.4-mini</Eyebrow>
        <div className="space-y-2">
          <h2 className="font-serif-tool text-2xl font-semibold text-ink">
            Let AI suggest a plan
          </h2>
          <p className="font-sans text-sm text-ink-soft max-w-sm">
            Uses last 4 weeks of outcomes, the retro, topic coverage, carry-overs, and the track.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          className="inline-flex items-center gap-2 bg-ink text-paper rounded-pill px-5 py-2.5 font-mono text-xs uppercase tracking-label hover:opacity-90"
        >
          <Zap className="h-4 w-4" strokeWidth={1.5} />
          Generate AI draft
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
          Generating… (may take 10-20s)
        </p>
      </div>
    );
  }

  const visibleItems = (draft!.items ?? [])
    .filter((i) => !addedLibraryItemIds.has(i.libraryItemId))
    .sort((a, b) => a.order - b.order);
  const visibleAlternates = (draft!.alternates ?? []).filter(
    (a) => !addedLibraryItemIds.has(a.libraryItemId),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Eyebrow>AI Draft · GPT-5.4-mini</Eyebrow>
          <Sparkles className="h-3 w-3 text-accent" strokeWidth={1.5} />
        </div>
        <p className="font-serif-tool text-lg italic text-ink leading-relaxed">
          {draft!.narrative}
        </p>
        <p className="font-mono text-[11px] text-ink-mute">
          {draft!.items.length} items · {draft!.totalMinutes} min
        </p>
        <button
          type="button"
          onClick={onOpenBrief}
          className="inline-flex items-center gap-2 rounded-pill bg-paper-warm px-3 py-1.5 font-mono text-[11px] uppercase tracking-label text-ink-soft hover:bg-rule"
        >
          ⟲ Regenerate with brief
        </button>
      </header>

      <section>
        <SectionLabel>Suggested items · {visibleItems.length}</SectionLabel>
        <div className="mt-3 space-y-3">
          {visibleItems.map((suggested, idx) => {
            const item = libraryById.get(suggested.libraryItemId);
            if (!item) return null;
            const isCarried = carryOverLibraryItemIds.has(suggested.libraryItemId);
            const topicName = item.topicId ? topicNameById.get(item.topicId) ?? null : null;
            return (
              <div
                key={suggested.libraryItemId}
                className={clsx(
                  'rounded-card border p-4',
                  isCarried
                    ? 'bg-paper-warm border-accent/40'
                    : 'bg-surface border-rule',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="font-serif-tool text-lg font-semibold text-ink-mute min-w-[1.5ch]">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCarried && (
                        <span className="inline-block font-mono text-[9px] uppercase tracking-label text-accent px-1.5 py-0.5 border border-accent/40 rounded-pill">
                          carried over
                        </span>
                      )}
                      <p className="font-serif-tool text-base font-semibold text-ink">
                        {item.title}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-mute">
                      <span>{item.format}</span>
                      {topicName && <><span>·</span><span>{topicName}</span></>}
                      <span>·</span>
                      <span>{item.estimatedMinutes}m</span>
                    </div>
                    <blockquote className="mt-3 border-l-2 border-accent pl-3 py-1 font-serif-tool text-sm italic text-ink-soft">
                      <span className="font-mono text-[9px] uppercase tracking-eyebrow text-accent not-italic mr-1">
                        why
                      </span>
                      {suggested.rationale}
                    </blockquote>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddItem(suggested.libraryItemId)}
                    className="font-mono text-[11px] text-focus hover:underline underline-offset-2 whitespace-nowrap"
                  >
                    Add to plan →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {visibleAlternates.length > 0 && (
        <section>
          <details className="group">
            <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold flex items-center gap-2 hover:text-ink">
              <span className="inline-block transition-transform group-open:rotate-90">▸</span>
              Or consider · {visibleAlternates.length}
            </summary>
            <div className="mt-3 space-y-2">
              {visibleAlternates.map((alt) => {
                const item = libraryById.get(alt.libraryItemId);
                if (!item) return null;
                return (
                  <div
                    key={alt.libraryItemId}
                    className="rounded-card border border-rule bg-paper px-3 py-2 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-serif-tool text-sm font-semibold text-ink">
                        {item.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-mute">{alt.rationale}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddItem(alt.libraryItemId)}
                      className="font-mono text-[11px] text-focus hover:underline underline-offset-2 whitespace-nowrap"
                    >
                      Add →
                    </button>
                  </div>
                );
              })}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
