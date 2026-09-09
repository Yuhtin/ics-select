import { ArrowUpRight } from 'lucide-react';
import { BrandLockup } from '../shell/brand-lockup';

export function LandingFooter() {
  return (
    <footer
      className="landing-container grid gap-5 py-8 text-xs text-fg-mute grid-cols-1 md:grid-cols-2 items-center"
      style={{
        borderTop: '1px solid hsl(var(--border))',
      }}
    >
      <div>
        <BrandLockup size="sm" className="text-fg mb-3" />
        Inteli Academy · 2026
      </div>
      <div className="md:text-right leading-relaxed">
        Feito por{' '}
        <a
          href="https://www.linkedin.com/in/daviduarte/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 font-medium text-fg hover:text-primary transition-colors"
        >
          Davi Duarte
          <ArrowUpRight className="w-3 h-3" strokeWidth={1.8} />
        </a>
        {' '}para a Comunidade Inteli
      </div>
    </footer>
  );
}
