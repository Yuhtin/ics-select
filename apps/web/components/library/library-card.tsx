'use client';

import { clsx } from 'clsx';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import {
  detectPlatform,
  platformLabel,
} from '../../lib/format/platform';
import { PlatformBadge, platformPreviewClass } from './platform-badge';
import type { AdminLibraryItem } from '../../lib/queries/admin-library';

export type Capability = 'view' | 'edit';

interface Props {
  item: AdminLibraryItem;
  capability: Capability;
  onEdit?: (item: AdminLibraryItem) => void;
  onDelete?: (item: AdminLibraryItem) => void;
  /** When true, the card fills its container; otherwise fixed 260px (shelf mode). */
  fill?: boolean;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

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
  const secondaryTopics = item.topics.filter((t) => t !== primaryTopic);

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
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-card border border-border-token bg-surface transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30',
        fill ? 'w-full' : 'w-[260px] shrink-0',
      )}
    >
      <div
        className={clsx(
          'relative h-[100px] w-full overflow-hidden',
          bg,
        )}
      >
        <div className="absolute inset-0 grid place-items-center">
          <PlatformBadge
            url={item.url}
            format={item.format}
            size="lg"
          />
        </div>
        <div className="absolute left-3 top-3 inline-flex items-center rounded-pill border border-border-token/60 bg-surface/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-label text-fg-soft backdrop-blur">
          {platformLabel(platform)}
        </div>
        <div className="absolute right-3 top-3 inline-flex items-center rounded-pill bg-fg/85 px-2 py-0.5 font-mono text-[10px] tabular-nums text-bg">
          {item.estimatedMinutes}m
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-2 font-serif text-[15px] font-semibold leading-tight tracking-tight text-fg">
          {item.title}
        </h3>

        {primaryTopic && (
          <div className="flex flex-wrap gap-1">
            <span className="inline-flex items-center rounded-pill bg-bg-subtle px-2 py-0.5 font-mono text-[9px] uppercase tracking-label text-fg-soft">
              {primaryTopic.label}
            </span>
            {secondaryTopics.slice(0, 1).map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center rounded-pill border border-border-token px-2 py-0.5 font-mono text-[9px] uppercase tracking-label text-fg-mute"
              >
                {t.label}
              </span>
            ))}
            {secondaryTopics.length > 1 && (
              <span className="inline-flex items-center font-mono text-[9px] uppercase tracking-label text-fg-faint">
                +{secondaryTopics.length - 1}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-fg-mute">
          <DifficultyPip level={item.difficulty} />
          <span>{DIFFICULTY_LABEL[item.difficulty] ?? item.difficulty}</span>
          {item.source && (
            <>
              <span className="text-fg-faint">·</span>
              <span className="truncate">{item.source}</span>
            </>
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
            className="grid h-7 w-7 place-items-center rounded-input border border-border-token bg-surface text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg"
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
            className="grid h-7 w-7 place-items-center rounded-input border border-border-token bg-surface text-fg-soft transition-colors hover:bg-bg-subtle hover:text-danger"
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
              className="grid h-7 w-7 place-items-center rounded-input border border-border-token bg-surface text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg"
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
    <span className="inline-flex items-center gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={clsx(
            'h-1 w-1 rounded-full',
            i < count ? 'bg-fg-soft' : 'bg-border-token',
          )}
        />
      ))}
    </span>
  );
}
