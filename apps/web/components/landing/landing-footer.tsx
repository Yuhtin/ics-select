import Link from 'next/link';
import { BrandLockup } from '../shell/brand-lockup';

export function LandingFooter() {
  return (
    <footer className="py-12 px-6 lg:px-8 border-t border-border">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BrandLockup size="sm" />
          <span className="text-caption text-foreground-subtle">Feito por Davi Duarte</span>
        </div>
        <div className="flex items-center gap-6 text-caption text-foreground-muted">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Politica de Privacidade</Link>
          <span className="text-foreground-subtle">&copy; 2026</span>
        </div>
      </div>
    </footer>
  );
}
