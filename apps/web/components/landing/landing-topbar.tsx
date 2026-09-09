import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BrandLockup } from '../shell/brand-lockup';

export function LandingTopbar() {
  return (
    <header className="landing-topbar">
      <div className="landing-container flex h-full items-center justify-between gap-5">
        <a href="#top" className="touch-target inline-flex items-center shrink-0 whitespace-nowrap">
          <BrandLockup size="sm" />
        </a>
        <nav aria-label="Navegação principal" className="hidden items-center gap-7 text-[13px] font-medium text-fg-soft md:flex">
          <a href="#top" className="py-3 hover:text-primary">Home</a>
          <a href="#como-funciona" className="py-3 hover:text-primary">Programa</a>
          <a href="#cohorts" className="py-3 hover:text-primary">Ciclos</a>
        </nav>
        <Link href="/login" className="landing-button landing-button-compact">
          Sou fellow
          <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}
