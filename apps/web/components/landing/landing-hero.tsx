'use client';

import { useEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { slowScrollTo } from './use-slow-scroll';

// Split a string into per-character <span>s with a stagger delay.
// Whitespace is preserved as a non-breaking space so a single .line
// element can use `white-space: nowrap` to prevent mid-word wraps.
function SplitLine({
  text,
  startDelay,
  step = 30,
}: {
  text: string;
  startDelay: number;
  step?: number;
}) {
  const chars = Array.from(text);
  let i = 0;
  return (
    <span className="block whitespace-nowrap split-text">
      {chars.map((ch, idx) => {
        const delay = startDelay + i * step;
        i += 1;
        return (
          <span key={idx} style={{ animationDelay: `${delay}ms` }}>
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        );
      })}
    </span>
  );
}

export function LandingHero() {
  const rootRef = useRef<HTMLElement | null>(null);

  // Kick off the split-text animation on next paint — matches the design.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      rootRef.current
        ?.querySelectorAll<HTMLElement>('.split-text')
        .forEach((el) => el.classList.add('split-go'));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section ref={rootRef} className="relative px-5 md:px-8 pt-[96px] md:pt-[110px]">
      <div className="pt-8 grid gap-6">
        <h1
          className="m-0 font-serif font-normal tracking-[-0.03em] text-fg"
          style={{
            fontSize: 'clamp(40px, 5.4vw, 82px)',
            lineHeight: 1.02,
          }}
        >
          <SplitLine text="O caminho" startDelay={0} />
          <SplitLine text="disciplinado pra" startDelay={280} />
          <span className="block">
            <span className="chip-word">tech de elite</span>
          </span>
        </h1>
        <p
          className="m-0 pb-3.5 text-fg-soft max-w-[40ch]"
          style={{ fontSize: 17, lineHeight: 1.55 }}
        >
          Seis meses. <strong className="text-fg font-semibold">Sempre 12 ativos.</strong>{' '}
          Plano semanal no seu Calendar, cohort que te cobra, e aulas de arquitetura pra pensar em sistemas de verdade.
        </p>
      </div>

      {/* CTA row */}
      <div className="relative z-[2] mt-14 flex flex-wrap items-center gap-3.5">
        <button
          type="button"
          onClick={() => slowScrollTo('#cohorts')}
          className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-fg text-bg text-sm font-medium transition-all hover:-translate-y-0.5 hover:bg-primary"
          style={{ boxShadow: '0 1px 2px rgba(20,24,31,.06)' }}
        >
          Quero conhecer
          <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
        <span
          className="inline-flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full text-[13px] font-medium text-fg border"
          style={{
            background: 'hsl(var(--success-soft))',
            borderColor: 'hsl(var(--success) / 0.2)',
          }}
        >
          <span className="dot-live-success" />
          Ciclo 2026.3 · <strong className="font-semibold">abre em Julho</strong>
        </span>
      </div>

    </section>
  );
}
