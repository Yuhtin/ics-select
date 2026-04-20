import { ArrowUpRight } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer
      className="grid gap-4 p-5 md:p-8 text-xs text-fg-mute grid-cols-1 sm:grid-cols-2 items-center"
      style={{
        borderTop: '1px solid hsl(var(--border))',
      }}
    >
      <div>
        <div className="font-semibold text-fg mb-1">ICS Select</div>
        Inteli Consulting Society · 2026
      </div>
      <div className="sm:text-right">
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
