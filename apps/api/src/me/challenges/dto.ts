import { z } from 'zod';

const CHALLENGE_LANGUAGES = ['PYTHON', 'CPP'] as const;
const CHALLENGE_RATINGS = ['EASY', 'MEDIUM', 'HARD'] as const;

export const StartChallengeSchema = z
  .object({
    libraryItemId: z.string().min(1),
    language: z.enum(CHALLENGE_LANGUAGES),
  })
  .strict();
export type StartChallengeInput = z.infer<typeof StartChallengeSchema>;

export const RunChallengeSchema = z
  .object({
    language: z.enum(CHALLENGE_LANGUAGES),
    code: z.string().min(1).max(32_768),
    stdin: z.string().max(8_192).default(''),
  })
  .strict();
export type RunChallengeInput = z.infer<typeof RunChallengeSchema>;

export const SubmitChallengeSchema = z
  .object({
    language: z.enum(CHALLENGE_LANGUAGES),
    code: z.string().min(1).max(32_768),
    // min(20) forces the member to articulate the approach in text instead
    // of just typing "ok" to clear the gate. Mirror this constant in the
    // frontend submit guard so the error surfaces before the network call.
    approachText: z.string().min(20).max(8_000),
    selfRating: z.enum(CHALLENGE_RATINGS),
    notes: z.string().max(2_000).optional(),
  })
  .strict();
export type SubmitChallengeInput = z.infer<typeof SubmitChallengeSchema>;

export const AutoSaveCodeSchema = z
  .object({
    language: z.enum(CHALLENGE_LANGUAGES),
    code: z.string().max(32_768),
  })
  .strict();
export type AutoSaveCodeInput = z.infer<typeof AutoSaveCodeSchema>;
