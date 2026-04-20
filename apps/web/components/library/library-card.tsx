'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import {
  detectPlatform,
  platformLabel,
} from '../../lib/format/platform';
import {
  extractYoutubeVideoId,
  youtubeThumb,
} from '../../lib/format/youtube';
import { PlatformBadge, platformPreviewClass } from './platform-badge';
import type { AdminLibraryItem } from '../../lib/queries/admin-library';

export type Capability = 'view' | 'edit';

interface Props {
  item: AdminLibraryItem;
  capability: Capability;
  onEdit?: (item: AdminLibraryItem) => void;
  onDelete?: (item: AdminLibraryItem) => void;
  /** When true, card fills its container; otherwise fixed 260px (shelf mode). */
  fill?: boolean;
}

// Seed sources are formatted like "YouTube — mycodeschool", "Book — Grokking
// Algorithms", "Medium — Netflix TechBlog", etc. Strip the platform prefix so
// the card only surfaces the channel / book / publication name — the banner
// chip already communicates what platform it is.
const SOURCE_PREFIX_RE = /^(YouTube|Book|Medium|GitHub|Article|LeetCode|Substack|Blog)\s[—-]\s/i;

function cleanSource(source: string | null | undefined): string | null {
  if (!source) return null;
  const trimmed = source.trim();
  if (!trimmed) return null;
  return trimmed.replace(SOURCE_PREFIX_RE, '').trim();
}

export function LibraryCard({
  item,
  capability,
  onEdit,
  onDelete,
  fill = false,
}: Props) {
  const platform = detectPlatform(item.url ?? null, item.format);
  const { bg } = platformPreviewClass(item.url ?? null, item.format);
  const primaryTopic = item.topics.find((t) => t.isPrimary) ?? item.topics[0] ?? null;

  const ytVideoId =
    platform === 'youtube' ? extractYoutubeVideoId(item.url) : null;
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb = ytVideoId !== null && !thumbFailed;

  const source = cleanSource(item.source);

  const handleOpen = () => {
    if (capability === 'edit') onEdit?.(item);
    else if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className={clsx(
        'group relative flex h-[268px] cursor-pointer flex-col overflow-hidden rounded-card border border-border-token bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30',
        fill ? 'w-full' : 'w-[260px] shrink-0',
      )}
    >
      {/* Preview band */}
      <div
        className={clsx(
          'relative h-[130px] w-full shrink-0 overflow-hidden',
          showThumb ? 'bg-fg/5' : bg,
        )}
      >
        {showThumb ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={youtubeThumb(ytVideoId, 'hq')}
              alt=""
              loading="lazy"
              onError={() => setThumbFailed(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-fg/40 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <PlatformBadge url={item.url} format={item.format} size="lg" />
          </div>
        )}
        <div
          className={clsx(
            'absolute left-3 top-3 inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-label backdrop-blur',
            showThumb
              ? 'bg-fg/85 text-bg'
              : 'border border-border-token/60 bg-surface/85 text-fg-soft',
          )}
        >
          {platformLabel(platform)}
        </div>
        <div
          className={clsx(
            'absolute right-3 top-3 inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[10px] tabular-nums',
            showThumb
              ? 'bg-fg/85 text-bg'
              : 'bg-fg text-bg',
          )}
        >
          {item.estimatedMinutes}m
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        {primaryTopic && (
          <p className="mb-1.5 truncate font-mono text-[9px] font-semibold uppercase tracking-eyebrow text-fg-mute">
            {primaryTopic.label}
          </p>
        )}

        <h3 className="line-clamp-2 font-serif text-[16px] font-semibold leading-[1.2] tracking-tight text-fg">
          {item.title}
        </h3>

        <div className="mt-auto flex items-center gap-2 pt-3 font-mono text-[10px] uppercase tracking-label text-fg-mute">
          <DifficultyPip level={item.difficulty} />
          {source ? (
            <span className="truncate" title={source}>
              {source}
            </span>
          ) : (
            <span className="text-fg-faint">{item.format.toLowerCase()}</span>
          )}
        </div>
      </div>

      {capability === 'edit' && (
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(item);
            }}
            title="Edit"
            aria-label="Edit item"
            className="grid h-7 w-7 place-items-center rounded-input border border-border-token bg-surface text-fg-soft shadow-sm transition-colors hover:bg-bg-subtle hover:text-fg"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(item);
            }}
            title="Delete"
            aria-label="Delete item"
            className="grid h-7 w-7 place-items-center rounded-input border border-border-token bg-surface text-fg-soft shadow-sm transition-colors hover:bg-bg-subtle hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open"
              aria-label="Open external link"
              className="grid h-7 w-7 place-items-center rounded-input border border-border-token bg-surface text-fg-soft shadow-sm transition-colors hover:bg-bg-subtle hover:text-fg"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          )}
        </div>
      )}
    </article>
  );
}

function DifficultyPip({ level }: { level: string }) {
  const count = level === 'EASY' ? 1 : level === 'MEDIUM' ? 2 : 3;
  return (
    <span
      className="inline-flex items-center gap-[2px]"
      title={level.toLowerCase()}
      aria-label={`Difficulty: ${level.toLowerCase()}`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            i < count ? 'bg-fg-soft' : 'bg-border-token',
          )}
        />
      ))}
    </span>
  );
}
