"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateThemePreferenceSchema = exports.THEME_PREFERENCES = void 0;
const zod_1 = require("zod");
exports.THEME_PREFERENCES = ['LIGHT', 'DARK'];
exports.updateThemePreferenceSchema = zod_1.z.object({
    themePreference: zod_1.z.enum(exports.THEME_PREFERENCES),
});
