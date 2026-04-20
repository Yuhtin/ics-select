'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { ExternalLink, Pencil, Play, Trash2 } from 'lucide-react';
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
  /** When true, card fills its container; otherwise fixed 300px (shelf mode). */
  fill?: boolean;
}

// Seed sources are formatted like "YouTube — mycodeschool" — strip that
// platform prefix so the card only surfaces the channel / publication name.
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
  const primaryTopic =
    item.topics.find((t) => t.isPrimary) ?? item.topics[0] ?? null;

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
        'group relative flex aspect-[16/10] cursor-pointer flex-col overflow-hidden rounded-card border border-transparent bg-fg/5 outline-none transition-all duration-200 ease-out',
        'hover:z-10 hover:scale-[1.04] hover:border-fg/20 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.45)]',
        'focus-visible:scale-[1.04] focus-visible:border-primary focus-visible:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.45)]',
        fill ? 'w-full' : 'w-[300px] shrink-0',
      )}
    >
      {/* Background — thumbnail or platform fill */}
      {showThumb ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={youtubeThumb(ytVideoId, 'hq')}
            alt=""
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
          />
        </>
      ) : (
        <div className={clsx('absolute inset-0', bg)}>
          <div className="absolute inset-0 grid place-items-center opacity-80">
            <PlatformBadge url={item.url} format={item.format} size="lg" />
          </div>
        </div>
      )}

      {/* Darkening gradient (always, stronger on hover) */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-300 group-hover:from-black/95 group-hover:via-black/50"
        aria-hidden
      />

      {/* Top-left: platform chip */}
      <div
        className={clsx(
          'absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-label backdrop-blur',
          'bg-black/50 text-white/90',
        )}
      >
        {platformLabel(platform)}
      </div>

      {/* Top-right: duration */}
      <div className="absolute right-3 top-3 inline-flex items-center rounded-pill bg-black/55 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white backdrop-blur">
        {item.estimatedMinutes}m
      </div>

      {/* Center hover: play affordance (viewers only). Skipped for admin — they
          get the edit/delete cluster instead. */}
      {capability === 'view' && showThumb && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-black shadow-xl">
            <Play
              className="h-5 w-5 translate-x-[1px] fill-current"
              strokeWidth={0}
            />
          </span>
        </div>
      )}

      {/* Bottom caption — always visible, sits over gradient */}
      <div className="relative z-[1] mt-auto flex flex-col gap-1.5 px-4 pb-3.5 pt-16">
        {primaryTopic && (
          <p className="truncate font-mono text-[9px] font-semibold uppercase tracking-eyebrow text-white/65">
            {primaryTopic.label}
          </p>
        )}
        <h3 className="line-clamp-2 font-serif text-[17px] font-semibold leading-[1.15] tracking-tight text-white drop-shadow-sm">
          {item.title}
        </h3>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-white/70">
          <DifficultyPip level={item.difficulty} />
          {source && (
            <span className="truncate" title={source}>
              {source}
            </span>
          )}
        </div>
      </div>

      {/* Admin hover actions — top-right cluster, replaces duration visually
          when hovered. Fades in smoothly. */}
      {capability === 'edit' && (
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
          <ActionButton
            icon={<Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />}
            label="Edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(item);
            }}
          />
          <ActionButton
            icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />}
            label="Delete"
            tone="danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(item);
            }}
          />
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open"
              aria-label="Open external link"
              className="grid h-7 w-7 place-items-center rounded-input bg-white/90 text-black shadow-sm backdrop-blur transition-colors hover:bg-white"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
            </a>
          )}
        </div>
      )}
    </article>
  );
}

function ActionButton({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'danger';
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={clsx(
        'grid h-7 w-7 place-items-center rounded-input bg-white/90 shadow-sm backdrop-blur transition-colors hover:bg-white',
        tone === 'danger' ? 'text-red-600 hover:text-red-700' : 'text-black',
      )}
    >
      {icon}
    </button>
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
            i < count ? 'bg-white/85' : 'bg-white/25',
          )}
        />
      ))}
    </span>
  );
}
