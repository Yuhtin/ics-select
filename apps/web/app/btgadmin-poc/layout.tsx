import type { ReactNode } from 'react';
import '../../btg/theme/btg.css';
import '../../btg/theme/member-extra.css';
import '../../btg/theme/admin-cycles.css';
import '../../btg/theme/admin-members.css';
import '../../btg/theme/admin-library.css';
import '../../btg/theme/admin-meetings.css';
import { BtgIconFont, btgFontVariables } from '../../btg/theme/fonts';
import { BtgAdminShell } from '../../btg/admin/shell';

// Pitch POC: keep BTG-branded pages out of search engines until BTG approves the co-brand.
export const metadata = { title: 'ICS Select × BTG Pactual · Admin', robots: { index: false, follow: false } };

export default function BtgAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`btg ${btgFontVariables}`}>
      <BtgIconFont />
      <BtgAdminShell>{children}</BtgAdminShell>
    </div>
  );
}
