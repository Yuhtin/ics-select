import { z } from 'zod';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ITEM_OUTCOMES, type ItemOutcome } from '@ics-select/shared';

export const CreatePlanSchema = z.object({
  cycleId: z.string().min(1),
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  adminNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        libraryItemId: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const UpdatePlanSchema = z.object({
  adminNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        libraryItemId: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
});

export class SetItemOutcomeDto {
  @IsIn(ITEM_OUTCOMES as unknown as string[])
  outcome!: ItemOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reflection?: string;
}
