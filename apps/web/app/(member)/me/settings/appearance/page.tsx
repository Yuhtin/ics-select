'use client';

import { useThemeWithSync } from '../../../../../lib/theme/use-theme-sync';
import { ThemePicker } from '../../../../../components/member/theme-picker';

export default function AppearancePage() {
  const { resolvedTheme, setTheme, mounted } = useThemeWithSync();
  const currentTheme = mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : undefined;

  return (
    <div className="space-y-5">
      <ThemePicker value={currentTheme} onChange={setTheme} size="settings" />
      <p className="font-sans text-sm text-fg-soft">Your choice syncs across devices.</p>
    </div>
  );
}
