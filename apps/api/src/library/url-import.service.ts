import { Injectable, Optional } from '@nestjs/common';
import * as cheerio from 'cheerio';

export type ImportedMetadata = {
  title: string;
  description: string | null;
  source: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  estimatedMinutes: number;
  url: string;
};

@Injectable()
export class UrlImportService {
  private readonly fetcher: typeof fetch;

  constructor(@Optional() fetcher?: typeof fetch) {
    this.fetcher = fetcher ?? fetch;
  }

  async extract(url: string): Promise<ImportedMetadata> {
    const host = safeHost(url);
    const format = detectFormat(host, url);
    const source = detectSource(host);

    let html = '';
    try {
      const res = await this.fetcher(url);
      if (res.ok) html = await res.text();
    } catch {
      // ignore; fall through
    }

    if (!html) {
      // No content fetched: only trust format heuristics for hosts we can
      // explicitly recognize; fall back to OTHER otherwise.
      const fallbackFormat = isKnownHost(host) ? format : 'OTHER';
      return {
        title: url.replace(/^https?:\/\//, ''),
        description: null,
        source,
        format: fallbackFormat,
        estimatedMinutes: defaultMinutesFor(fallbackFormat),
        url,
      };
    }

    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    const docTitle = $('title').first().text();

    return {
      title: (ogTitle || docTitle || url).trim(),
      description: ogDescription?.trim() ?? null,
      source: source ?? ogSiteName?.trim() ?? null,
      format,
      estimatedMinutes: defaultMinutesFor(format),
      url,
    };
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function detectFormat(host: string, url: string): ImportedMetadata['format'] {
  if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('vimeo.com')) {
    return 'VIDEO';
  }
  if (host.includes('leetcode.com') || url.match(/\/problems?\//)) {
    return 'PROBLEM';
  }
  if (host.includes('medium.com') || host.includes('dev.to') || host.endsWith('.blog')) {
    return 'ARTICLE';
  }
  if (host.includes('amazon.com') || host.includes('oreilly.com')) {
    return 'BOOK';
  }
  if (host) return 'ARTICLE';
  return 'OTHER';
}

function isKnownHost(host: string): boolean {
  return (
    host.includes('youtube.com') ||
    host.includes('youtu.be') ||
    host.includes('vimeo.com') ||
    host.includes('leetcode.com') ||
    host.includes('medium.com') ||
    host.includes('dev.to') ||
    host.endsWith('.blog') ||
    host.includes('amazon.com') ||
    host.includes('oreilly.com') ||
    host.includes('neetcode.io')
  );
}

function detectSource(host: string): string | null {
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
  if (host.includes('leetcode.com')) return 'LeetCode';
  if (host.includes('medium.com')) return 'Medium';
  if (host.includes('dev.to')) return 'DEV';
  if (host.includes('neetcode.io')) return 'NeetCode';
  return null;
}

function defaultMinutesFor(format: ImportedMetadata['format']): number {
  switch (format) {
    case 'VIDEO':
      return 15;
    case 'ARTICLE':
      return 10;
    case 'PROBLEM':
      return 30;
    case 'BOOK':
      return 240;
    case 'OTHER':
      return 20;
  }
}
