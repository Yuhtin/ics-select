export declare const colors: {
    readonly background: "#fbfbfe";
    readonly surface: "#ffffff";
    readonly surfaceMuted: "#f5f6f8";
    readonly surfaceSubtle: "#f0f1f4";
    readonly border: "#e5e7eb";
    readonly borderStrong: "#d1d5db";
    readonly foreground: "#0f172a";
    readonly foregroundMuted: "#475569";
    readonly foregroundSubtle: "#94a3b8";
    readonly brand: "#18a0fb";
    readonly brandHover: "#0c8ce9";
    readonly brandSoft: "#e0f2fe";
    readonly brandSoftForeground: "#0c4a6e";
    readonly success: "#10b981";
    readonly successSoft: "#d1fae5";
    readonly warning: "#f59e0b";
    readonly warningSoft: "#fef3c7";
    readonly danger: "#ef4444";
    readonly dangerSoft: "#fee2e2";
    readonly info: "#3b82f6";
    readonly infoSoft: "#dbeafe";
};
export declare const typography: {
    readonly fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif";
    readonly fontSize: {
        readonly xs: "0.6875rem";
        readonly sm: "0.8125rem";
        readonly base: "0.9375rem";
        readonly lg: "1.0625rem";
        readonly xl: "1.25rem";
        readonly '2xl': "1.5rem";
        readonly '3xl': "1.875rem";
        readonly '4xl': "2.25rem";
    };
};
export declare const radius: {
    readonly sm: "0.375rem";
    readonly md: "0.5rem";
    readonly lg: "0.75rem";
    readonly full: "9999px";
};
export declare const shadows: {
    readonly xs: "0 1px 2px 0 rgb(15 23 42 / 0.04)";
    readonly sm: "0 2px 4px -1px rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)";
    readonly md: "0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)";
    readonly brand: "0 8px 24px -4px rgb(24 160 251 / 0.25), 0 4px 8px -2px rgb(24 160 251 / 0.15)";
};
export type Colors = typeof colors;
export type Typography = typeof typography;
