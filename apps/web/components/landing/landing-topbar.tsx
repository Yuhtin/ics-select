'use client';

import { useEffect, useState } from 'react';
import { House, Menu, Users, ArrowUpRight } from 'lucide-react';
import { slowScrollTo } from './use-slow-scroll';

export function LandingTopbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="fixed top-0 left-0 right-0 z-50 grid items-center px-5 md:px-8 transition-[padding,background,border-color,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] py-5 md:py-[22px] data-[scrolled]:py-3 data-[scrolled]:md:py-3.5 border-b border-transparent data-[scrolled]:border-border-token"
      style={{
        gridTemplateColumns: '1fr auto 1fr',
        background: scrolled ? 'hsl(var(--surface) / 0.72)' : 'transparent',
        backdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'none',
        boxShadow: scrolled ? '0 1px 2px rgba(20,24,31,.04)' : 'none',
      }}
    >
      <a href="#top" className="flex items-center gap-2.5 font-semibold tracking-[-0.01em] text-base">
        <div className="relative w-[30px] h-[30px] rounded-[9px] bg-fg text-bg grid place-items-center font-bold text-[11px] overflow-hidden">
          <span className="relative z-10">ICS</span>
          <span
            className="absolute inset-[-10%] rounded-full"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.6), transparent 50%)',
              mixBlendMode: 'screen',
            }}
          />
        </div>
        <span>ICS Select</span>
      </a>

      <nav
        className="hidden md:flex gap-2 p-[5px] rounded-full border border-border-token transition-colors duration-300"
        style={{ background: scrolled ? 'hsl(var(--bg-subtle) / 0.6)' : 'hsl(var(--bg-subtle))' }}
      >
        <NavPill href="#top" label="Home" icon={<House className="w-3.5 h-3.5" strokeWidth={1.8} />} />
        <NavPill
          href="#program"
          label="Programa"
          icon={<Menu className="w-3.5 h-3.5" strokeWidth={1.8} />}
        />
        <NavPill
          href="#cohorts"
          label="Cohorts"
          icon={<Users className="w-3.5 h-3.5" strokeWidth={1.8} />}
        />
      </nav>

      <div className="flex justify-end items-center gap-2.5">
        <button
          type="button"
          onClick={() => slowScrollTo('#cohorts')}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-fg text-bg text-[13px] font-medium hover:bg-primary transition-all hover:-translate-y-px"
        >
          Quero conhecer
          <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}

function NavPill({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium text-fg-mute hover:text-fg transition-colors"
    >
      {label}
      {icon}
    </a>
  );
}
