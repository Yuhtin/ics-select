'use client';

import { MessageSquareText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMeRetroCurrent } from '../../lib/queries/me-retro';

export function MemberMobileRetroAction() {
  const pathname = usePathname();
  const { data } = useMeRetroCurrent();

  if (data?.open !== true || pathname === '/me/retro') return null;

  return (
    <Link
      href="/me/retro"
      className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+12px)] right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-input bg-[hsl(var(--member-rail-bg))] px-4 font-sans text-xs font-semibold text-primary-fg shadow-lg md:hidden"
    >
      <MessageSquareText aria-hidden className="h-4 w-4" strokeWidth={1.5} />
      {data.retro ? 'Update retro' : 'Retro open'}
    </Link>
  );
}
