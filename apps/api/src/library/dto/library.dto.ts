import { z } from 'zod';
import { TRACKS } from '@ics-select/shared';

export const ItemFormatSchema = z.enum(['VIDEO', 'ARTICLE', 'BOOK', 'PROBLEM', 'OTHER']);
export const ItemDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export const TrackSchema = z.enum(TRACKS);

export const CreateLibraryItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().nullable(),
  description: z.string().nullable(),
  format: ItemFormatSchema,
  difficulty: ItemDifficultySchema,
  estimatedMinutes: z.number().int().positive(),
  source: z.string().nullable().optional().default(null),
  tags: z.array(z.string()).default([]),
  // first slug is the primary topic; additional slugs mark secondary covers.
  topicSlugs: z.array(z.string()).optional(),
});

export const UpdateLibraryItemSchema = CreateLibraryItemSchema.partial();

export const SearchLibrarySchema = z.object({
  query: z.string().optional(),
  format: z.array(ItemFormatSchema).optional(),
  difficulty: z.array(ItemDifficultySchema).optional(),
  tags: z.array(z.string()).optional(),
  tracks: z.array(TrackSchema).optional(),
  topicId: z.string().optional(),
  maxMinutes: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export const ImportUrlSchema = z.object({
  url: z.string().url(),
});
