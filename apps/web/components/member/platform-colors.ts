type PlatformKey = 'youtube' | 'leetcode' | 'medium' | 'github' | 'article' | 'book' | 'default';

const URL_PATTERNS: Array<{ pattern: RegExp; key: PlatformKey }> = [
  { pattern: /youtube\.com|youtu\.be/i, key: 'youtube' },
  { pattern: /leetcode\.com/i, key: 'leetcode' },
  { pattern: /medium\.com/i, key: 'medium' },
  { pattern: /github\.com/i, key: 'github' },
];

const FORMAT_FALLBACKS: Record<string, PlatformKey> = {
  VIDEO: 'youtube',
  ARTICLE: 'article',
  BOOK: 'book',
  PROBLEM: 'leetcode',
};

export function getPlatformKey(url: string | null, format: string): PlatformKey {
  if (url) {
    for (const { pattern, key } of URL_PATTERNS) {
      if (pattern.test(url)) return key;
    }
  }
  return FORMAT_FALLBACKS[format] ?? 'default';
}

export const PLATFORM_BORDER_CLASS: Record<PlatformKey, string> = {
  youtube: 'border-platform-youtube',
  leetcode: 'border-platform-leetcode',
  medium: 'border-platform-medium',
  github: 'border-platform-github',
  article: 'border-platform-article',
  book: 'border-platform-book',
  default: 'border-border-strong',
};

export const PLATFORM_BG_CLASS: Record<PlatformKey, string> = {
  youtube: 'bg-platform-youtube/10',
  leetcode: 'bg-platform-leetcode/10',
  medium: 'bg-platform-medium/10',
  github: 'bg-platform-github/10',
  article: 'bg-platform-article/10',
  book: 'bg-platform-book/10',
  default: 'bg-surface-subtle',
};

export const PLATFORM_LABEL: Record<PlatformKey, string> = {
  youtube: 'YouTube',
  leetcode: 'LeetCode',
  medium: 'Medium',
  github: 'GitHub',
  article: 'Artigo',
  book: 'Livro',
  default: 'Material',
};
