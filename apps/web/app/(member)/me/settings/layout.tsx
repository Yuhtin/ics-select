import type { ReactNode } from 'react';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { SettingsNav } from '../../../../components/member/settings-nav';
import { SettingsErrorProvider } from '../../../../components/member/settings-error-context';
import { GlobalSaveIndicator } from '../../../../components/member/global-save-indicator';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsErrorProvider>
      <div className="space-y-8">
        <div>
          <Eyebrow>Settings</Eyebrow>
          <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-fg">
            Your preferences.
          </h1>
        </div>

        <div className="flex flex-col gap-8 md:flex-row md:gap-10">
          <SettingsNav />
          <div className="min-w-0 flex-1 space-y-10">{children}</div>
        </div>

        <div className="flex justify-end border-t border-rule pt-4 md:pt-6">
          <GlobalSaveIndicator />
        </div>
      </div>
    </SettingsErrorProvider>
  );
}
