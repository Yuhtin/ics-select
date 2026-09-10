import type { ReactNode } from 'react';
import { StudioPageHeader } from '../../../../components/member/studio-page-header';
import { SettingsNav } from '../../../../components/member/settings-nav';
import { SettingsErrorProvider } from '../../../../components/member/settings-error-context';
import { GlobalSaveIndicator } from '../../../../components/member/global-save-indicator';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsErrorProvider>
      <div className="max-w-[1120px] space-y-9">
        <StudioPageHeader eyebrow="Settings" title="Your preferences." />

        <div className="grid gap-8 md:grid-cols-[180px_minmax(0,720px)] md:gap-10">
          <SettingsNav />
          <div className="min-w-0 space-y-10">{children}</div>
        </div>

        <div className="flex justify-end border-t border-border-token pt-4 md:pt-6">
          <GlobalSaveIndicator />
        </div>
      </div>
    </SettingsErrorProvider>
  );
}
