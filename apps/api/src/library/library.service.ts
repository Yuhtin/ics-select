import { Injectable, NotFoundException } from '@nestjs/common';
import type { Track } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { OpenAiService } from '../common/openai/openai.service.js';

export type CreateLibraryItemInput = {
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
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

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
  ) {}

  async create(input: CreateLibraryItemInput) {
    const item = await this.prisma.libraryItem.create({
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
    await this.writeEmbedding(item.id, input.title, input.description, input.tags);
    return item;
  }

  async update(id: string, input: UpdateLibraryItemInput) {
    const existing = await this.prisma.libraryItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('library item not found');
    const merged = { ...existing, ...input };
    const updated = await this.prisma.libraryItem.update({
      where: { id },
      data: input,
    });
    const contentChanged = CONTENT_AFFECTING_FIELDS.some((f) => f in input);
    if (contentChanged) {
      await this.writeEmbedding(id, merged.title, merged.description, merged.tags);
    }
    return updated;
  }

  list() {
    return this.prisma.libraryItem.findMany({ orderBy: { createdAt: 'desc' } });
  }

  getById(id: string) {
    return this.prisma.libraryItem.findUnique({ where: { id } });
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
          ...(input.topicId ? { topicId: input.topicId } : {}),
          // tracks filter handled in-memory below so `tracks = []` items pass through.
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
      });
      const mapped = items.map((i) => ({ ...i, score: null })) as Array<
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

    // Full-text search. Uses the 'simple' tsvector config (no stemming) so
    // English + Portuguese content both match. ILIKE across title, description
    // and URL is layered on top for partial / domain-style matches.
    const sql = `
      SELECT
        "id", "title", "url", "description", "format", "difficulty",
        "estimatedMinutes", "source", "tags", "tracks", "topicId",
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
    if (input.topicId) {
      const wantedTopic = input.topicId;
      filtered = filtered.filter((i) => i.topicId === wantedTopic);
    }

    // Supplement with the filtered listing when the query returned too few hits.
    // This keeps a half-decent answer when the query doesn't match anything —
    // useful for the LLM tool caller and for sparse libraries.
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
