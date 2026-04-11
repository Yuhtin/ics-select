import { Injectable, NotFoundException } from '@nestjs/common';
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

    if (!hasQuery) {
      // Fallback to filtered list
      const items = await this.prisma.libraryItem.findMany({
        where: {
          ...(input.format ? { format: { in: input.format } } : {}),
          ...(input.difficulty ? { difficulty: { in: input.difficulty } } : {}),
          ...(input.maxMinutes ? { estimatedMinutes: { lte: input.maxMinutes } } : {}),
          ...(input.tags && input.tags.length > 0 ? { tags: { hasSome: input.tags } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return items.map((i) => ({ ...i, score: null }));
    }

    const embedding = await this.openai.embed(input.query!);
    const vectorLiteral = `[${embedding.join(',')}]`;

    // Raw hybrid query. Prisma's $queryRawUnsafe lets us parametrize with positional $1/$2.
    const sql = `
      SELECT
        "id", "title", "url", "description", "format", "difficulty",
        "estimatedMinutes", "source", "tags", "createdAt", "updatedAt",
        (1 - (embedding <=> $1::vector)) * 0.6
          + COALESCE(ts_rank(search_vector, plainto_tsquery('portuguese', $2)), 0) * 0.4
          AS score
      FROM "LibraryItem"
      WHERE
        ($3::"ItemFormat"[] IS NULL OR "format" = ANY($3::"ItemFormat"[]))
        AND ($4::"ItemDifficulty"[] IS NULL OR "difficulty" = ANY($4::"ItemDifficulty"[]))
        AND ($5::int IS NULL OR "estimatedMinutes" <= $5)
        AND ($6::text[] IS NULL OR "tags" && $6::text[])
      ORDER BY score DESC
      LIMIT $7
    `;

    const results = (await this.prisma.$queryRawUnsafe(
      sql,
      vectorLiteral,
      input.query,
      input.format ?? null,
      input.difficulty ?? null,
      input.maxMinutes ?? null,
      input.tags ?? null,
      limit,
    )) as unknown[];
    return results;
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
