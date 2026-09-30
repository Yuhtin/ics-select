import type { ReactNode } from 'react';
import { BtgSettingsLayout } from '../../../btg/member/settings';

export default function Layout({ children }: { children: ReactNode }) {
  return <BtgSettingsLayout>{children}</BtgSettingsLayout>;
}
