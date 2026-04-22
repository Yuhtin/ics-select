export type PlatformKey =
  | 'leetcode'
  | 'youtube'
  | 'medium'
  | 'github'
  | 'article'
  | 'book';

type Platform = PlatformKey;

export function detectPlatform(url: string | null | undefined, format: string | undefined): Platform {
  if (url) {
    if (url.includes('leetcode.com')) return 'leetcode';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('medium.com')) return 'medium';
    if (url.includes('github.com')) return 'github';
  }
  if (format === 'VIDEO') return 'youtube';
  if (format === 'BOOK') return 'book';
  return 'article';
}

export function platformLabel(p: Platform): string {
  return {
    leetcode: 'LeetCode',
    youtube: 'Video',
    medium: 'Medium',
    github: 'GitHub',
    article: 'Article',
    book: 'Book',
  }[p];
}
