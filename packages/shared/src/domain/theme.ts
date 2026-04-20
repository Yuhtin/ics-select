import { z } from 'zod';

export const THEME_PREFERENCES = ['LIGHT', 'DARK'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const updateThemePreferenceSchema = z.object({
  themePreference: z.enum(THEME_PREFERENCES),
});

export type UpdateThemePreferenceInput = z.infer<typeof updateThemePreferenceSchema>;
