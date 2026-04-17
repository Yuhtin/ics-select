import type { ReactNode } from 'react';
import { MemberShell } from '../../components/member-shell/member-shell';

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <MemberShell>{children}</MemberShell>;
}
