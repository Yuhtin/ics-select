import { z } from 'zod';
export declare const THEME_PREFERENCES: readonly ["LIGHT", "DARK"];
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export declare const updateThemePreferenceSchema: z.ZodObject<{
    themePreference: z.ZodEnum<["LIGHT", "DARK"]>;
}, "strip", z.ZodTypeAny, {
    themePreference: "LIGHT" | "DARK";
}, {
    themePreference: "LIGHT" | "DARK";
}>;
export type UpdateThemePreferenceInput = z.infer<typeof updateThemePreferenceSchema>;
