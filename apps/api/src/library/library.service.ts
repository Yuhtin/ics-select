import { Injectable, NotFoundException } from '@nestjs/common';
import type { Track } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { OpenAiService } from '../common/openai/openai.service.js';

export type TopicRef = {
  id: string;
  slug: string;
  label: string;
  isPrimary: boolean;
};

export type CreateLibraryItemInput = {
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
  topicSlugs?: string[]; // first slug is primary; rest are secondary covers
  createdById: string;
};

export type UpdateLibraryItemInput = Partial<CreateLibraryItemInput>;

export type SearchInput = {
  query?: string;
  format?: ('VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER')[];
  difficulty?: ('EASY' | 'MEDIUM' | 'HARD')[];
  tags?: string[];
  tracks?: Track[];
  topicId?: string;
  maxMinutes?: number;
  limit?: number;
};

const CONTENT_AFFECTING_FIELDS: Array<keyof CreateLibraryItemInput> = [
  'title',
  'description',
  'tags',
];

// Shape of the Prisma include we use for item reads. Keep it narrow.
const TOPIC_INCLUDE = {
  topics: {
    include: {
      topic: { select: { id: true, slug: true, label: true } },
    },
  },
} as const;

type TopicRow = {
  topicId: string;
  isPrimary: boolean;
  topic: { id: string; slug: string; label: string };
};

type RawItemWithTopics = { topics?: TopicRow[] } & Record<string, unknown>;

/**
 * Flatten Prisma's `{ topics: [{ topic, isPrimary }, ...] }` shape into the
 * API-facing shape: a flat `topics: TopicRef[]` plus `topicId` (the primary
 * topic id, or null) and `topic` (the primary topic summary) for backward
 * compatibility with callers that expect a single primary topic.
 */
function shapeItem<T extends RawItemWithTopics>(raw: T) {
  const rawTopics = raw.topics ?? [];
  const topics: TopicRef[] = rawTopics.map((tr) => ({
    id: tr.topic.id,
    slug: tr.topic.slug,
    label: tr.topic.label,
    isPrimary: tr.isPrimary,
  }));
  const primary = topics.find((t) => t.isPrimary) ?? null;
  const { topics: _drop, ...rest } = raw;
  return {
    ...rest,
    topics,
    topicId: primary?.id ?? null,
    topic: primary ? { id: primary.id, slug: primary.slug, label: primary.label } : null,
  };
}

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
  ) {}

  async create(input: CreateLibraryItemInput) {
    const created = await this.prisma.libraryItem.create({
      data: {
        title: input.title,
        url: input.url,
        description: input.description,
        format: input.format,
        difficulty: input.difficulty,
        estimatedMinutes: input.estimatedMinutes,
        source: input.source,
        tags: input.tags,
        createdById: input.createdById,
      },
    });
    if (input.topicSlugs && input.topicSlugs.length > 0) {
      await this.replaceTopics(created.id, input.topicSlugs);
    }
    await this.writeEmbedding(created.id, input.title, input.description, input.tags);
    const out = await this.getById(created.id);
    if (!out) throw new Error('library item disappeared after create');
    return out;
  }

  async update(id: string, input: UpdateLibraryItemInput) {
    const existing = await this.prisma.libraryItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('library item not found');
    const merged = { ...existing, ...input };
    const { topicSlugs, createdById: _ignored, ...fields } = input;
    await this.prisma.libraryItem.update({
      where: { id },
      data: fields,
    });
    if (topicSlugs !== undefined) {
      await this.replaceTopics(id, topicSlugs);
    }
    const contentChanged = CONTENT_AFFECTING_FIELDS.some((f) => f in input);
    if (contentChanged) {
      await this.writeEmbedding(id, merged.title, merged.description, merged.tags);
    }
    const out = await this.getById(id);
    if (!out) throw new Error('library item disappeared after update');
    return out;
  }

  async list() {
    const rows = await this.prisma.libraryItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: TOPIC_INCLUDE,
    });
    return rows.map(shapeItem);
  }

  async getById(id: string) {
    const row = await this.prisma.libraryItem.findUnique({
      where: { id },
      include: TOPIC_INCLUDE,
    });
    return row ? shapeItem(row) : null;
  }

  async delete(id: string) {
    return this.prisma.libraryItem.delete({ where: { id } });
  }

  async search(input: SearchInput) {
    const limit = input.limit ?? 20;
    const hasQuery = !!input.query && input.query.trim().length > 0;

    const filteredListing = async (): Promise<Array<Record<string, unknown>>> => {
      // Fetch generously, then apply the "tracks = []" wildcard rule in memory.
      const items = await this.prisma.libraryItem.findMany({
        where: {
          ...(input.format ? { format: { in: input.format } } : {}),
          ...(input.difficulty ? { difficulty: { in: input.difficulty } } : {}),
          ...(input.maxMinutes ? { estimatedMinutes: { lte: input.maxMinutes } } : {}),
          ...(input.tags && input.tags.length > 0 ? { tags: { hasSome: input.tags } } : {}),
          ...(input.topicId
            ? { topics: { some: { topicId: input.topicId } } }
            : {}),
          // tracks filter handled in-memory below so `tracks = []` items pass through.
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
        include: TOPIC_INCLUDE,
      });
      const mapped = items.map((i) => ({ ...shapeItem(i), score: null })) as Array<
        Record<string, unknown>
      >;
      if (input.tracks && input.tracks.length > 0) {
        const wanted = input.tracks;
        return mapped
          .filter((i) => {
            const tracks = i.tracks;
            if (!Array.isArray(tracks) || tracks.length === 0) return true;
            return tracks.some((t: unknown) => wanted.includes(t as Track));
          })
          .slice(0, limit);
      }
      return mapped.slice(0, limit);
    };

    if (!hasQuery) {
      return filteredListing();
    }

    // Full-text search via raw SQL (keeps tsvector ranking). Topic data is
    // fetched in a follow-up Prisma query and merged below, since the
    // LibraryItem row no longer carries `topicId` directly.
    const sql = `
      SELECT
        "id", "title", "url", "description", "format", "difficulty",
        "estimatedMinutes", "source", "tags", "tracks",
        "createdAt", "updatedAt",
        CASE
          WHEN search_vector @@ plainto_tsquery('simple', lower($1))
            THEN ts_rank(search_vector, plainto_tsquery('simple', lower($1))) * 4
          WHEN "title" ILIKE '%' || $1 || '%' THEN 2
          WHEN "description" ILIKE '%' || $1 || '%' THEN 1
          WHEN "url" ILIKE '%' || $1 || '%' THEN 0.5
          ELSE 0.01
        END AS score
      FROM "LibraryItem"
      WHERE
        (
          search_vector @@ plainto_tsquery('simple', lower($1))
          OR "title" ILIKE '%' || $1 || '%'
          OR "description" ILIKE '%' || $1 || '%'
          OR "url" ILIKE '%' || $1 || '%'
        )
        AND ($2::"ItemFormat"[] IS NULL OR "format" = ANY($2::"ItemFormat"[]))
        AND ($3::"ItemDifficulty"[] IS NULL OR "difficulty" = ANY($3::"ItemDifficulty"[]))
        AND ($4::int IS NULL OR "estimatedMinutes" <= $4)
        AND ($5::text[] IS NULL OR "tags" && $5::text[])
      ORDER BY score DESC, "createdAt" DESC
      LIMIT $6
    `;

    const results = (await this.prisma.$queryRawUnsafe(
      sql,
      input.query,
      input.format ?? null,
      input.difficulty ?? null,
      input.maxMinutes ?? null,
      input.tags ?? null,
      limit,
    )) as unknown[];

    let filtered = results as Array<Record<string, unknown>>;
    if (input.tracks && input.tracks.length > 0) {
      const wanted = input.tracks;
      filtered = filtered.filter((i) => {
        const tracks = i.tracks;
        // Treat `tracks = []` as "applies to all tracks" per the schema intent.
        if (!Array.isArray(tracks) || tracks.length === 0) return true;
        return tracks.some((t: unknown) => wanted.includes(t as Track));
      });
    }

    // Attach topics via one follow-up query so the admin UI / AI receive the
    // full shape (`topics[]`, derived `topicId`, `topic`).
    await this.attachTopics(filtered);

    if (input.topicId) {
      const wantedTopic = input.topicId;
      filtered = filtered.filter((i) => {
        const topics = (i.topics ?? []) as TopicRef[];
        return topics.some((t) => t.id === wantedTopic);
      });
    }

    // Supplement with the filtered listing when the query returned too few hits.
    if (filtered.length < Math.min(5, limit)) {
      const fallback = await filteredListing();
      const seen = new Set(filtered.map((i) => i.id as string));
      for (const item of fallback) {
        if (seen.has(item.id as string)) continue;
        filtered.push(item);
        if (filtered.length >= limit) break;
      }
    }

    return filtered;
  }

  private async attachTopics(items: Array<Record<string, unknown>>): Promise<void> {
    if (items.length === 0) return;
    const ids = items.map((i) => i.id as string);
    const rows = await this.prisma.libraryItemTopic.findMany({
      where: { itemId: { in: ids } },
      include: { topic: { select: { id: true, slug: true, label: true } } },
    });
    const byItem = new Map<string, TopicRef[]>();
    for (const r of rows) {
      const arr = byItem.get(r.itemId) ?? [];
      arr.push({
        id: r.topic.id,
        slug: r.topic.slug,
        label: r.topic.label,
        isPrimary: r.isPrimary,
      });
      byItem.set(r.itemId, arr);
    }
    for (const item of items) {
      const topics = byItem.get(item.id as string) ?? [];
      const primary = topics.find((t) => t.isPrimary) ?? null;
      item.topics = topics;
      item.topicId = primary?.id ?? null;
      item.topic = primary
        ? { id: primary.id, slug: primary.slug, label: primary.label }
        : null;
    }
  }

  /**
   * Replace the full topic set on an item in one transaction. `topicSlugs[0]`
   * is the primary topic; the rest are secondary covers. An empty array
   * clears all topics.
   */
  private async replaceTopics(itemId: string, topicSlugs: string[]): Promise<void> {
    const uniqueSlugs = [...new Set(topicSlugs)].filter((s) => s.length > 0);
    const topics =
      uniqueSlugs.length > 0
        ? await this.prisma.topic.findMany({
            where: { slug: { in: uniqueSlugs } },
            select: { id: true, slug: true },
          })
        : [];
    const idBySlug = new Map(topics.map((t) => [t.slug, t.id]));
    const missing = uniqueSlugs.filter((s) => !idBySlug.has(s));
    if (missing.length > 0) {
      throw new NotFoundException(`unknown topic slug(s): ${missing.join(', ')}`);
    }
    await this.prisma.$transaction([
      this.prisma.libraryItemTopic.deleteMany({ where: { itemId } }),
      ...uniqueSlugs.map((slug, idx) =>
        this.prisma.libraryItemTopic.create({
          data: {
            itemId,
            topicId: idBySlug.get(slug)!,
            isPrimary: idx === 0,
          },
        }),
      ),
    ]);
  }

  private async writeEmbedding(
    id: string,
    title: string,
    description: string | null,
    tags: string[],
  ): Promise<void> {
    const text = [title, description ?? '', tags.join(' ')].join('\n').trim();
    const vector = await this.openai.embed(text);
    const vectorLiteral = `[${vector.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "LibraryItem" SET "embedding" = $2::vector WHERE "id" = $1`,
      id,
      vectorLiteral,
    );
  }
}
