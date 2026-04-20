'use client';

import { Play, Code2, FileText, BookOpen, Github, Newspaper } from 'lucide-react';
import { clsx } from 'clsx';
import {
  detectPlatform,
  platformLabel,
} from '../../lib/format/platform';

type Size = 'sm' | 'md' | 'lg';

const ICON: Record<ReturnType<typeof detectPlatform>, typeof Play> = {
  youtube: Play,
  leetcode: Code2,
  medium: FileText,
  github: Github,
  article: Newspaper,
  book: BookOpen,
};

// Platform -> (bg, fg) tuple. Intensities match the DS platform stripe tokens.
const PLATFORM_BG: Record<string, string> = {
  youtube: 'bg-platform-youtube/10',
  leetcode: 'bg-platform-leetcode/15',
  medium: 'bg-platform-medium/10',
  github: 'bg-platform-github/15',
  article: 'bg-platform-article/15',
  book: 'bg-platform-book/15',
};

const PLATFORM_FG: Record<string, string> = {
  youtube: 'text-platform-youtube',
  leetcode: 'text-platform-leetcode',
  medium: 'text-platform-medium',
  github: 'text-platform-github',
  article: 'text-platform-article',
  book: 'text-platform-book',
};

interface Props {
  url: string | null | undefined;
  format: string | undefined;
  size?: Size;
  showLabel?: boolean;
  className?: string;
}

export function PlatformBadge({
  url,
  format,
  size = 'md',
  showLabel = false,
  className,
}: Props) {
  const p = detectPlatform(url, format);
  const Icon = ICON[p];
  const sizeClass =
    size === 'sm'
      ? 'h-6 w-6'
      : size === 'md'
      ? 'h-8 w-8'
      : 'h-12 w-12';
  const iconSize =
    size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      <span
        className={clsx(
          'inline-grid place-items-center rounded-[6px]',
          sizeClass,
          PLATFORM_BG[p],
          PLATFORM_FG[p],
        )}
      >
        <Icon className={iconSize} strokeWidth={1.8} />
      </span>
      {showLabel && (
        <span className="font-mono text-[11px] uppercase tracking-label text-fg-mute">
          {platformLabel(p)}
        </span>
      )}
    </div>
  );
}

export function platformPreviewClass(
  url: string | null | undefined,
  format: string | undefined,
): { bg: string; fg: string; platform: ReturnType<typeof detectPlatform> } {
  const p = detectPlatform(url, format);
  return { bg: PLATFORM_BG[p], fg: PLATFORM_FG[p], platform: p };
}
