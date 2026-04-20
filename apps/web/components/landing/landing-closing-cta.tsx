'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from './reveal';

type PublicMember = { name: string; avatar: string | null };
type CohortResponse = { cycle: string | null; members: PublicMember[] };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function LandingClosingCta({
  onOpenWaitlist,
}: {
  onOpenWaitlist: () => void;
}) {
  const [data, setData] = useState<CohortResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/public/cohort`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json: CohortResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const hasCohort = !!data && data.members.length > 0;

  return (
    <section
      id="apply"
      className="text-center px-5 md:px-8 pt-8 md:pt-10 pb-16"
    >
      <span id="cohorts" className="block -mt-24 pt-24" aria-hidden />
      <Reveal>
        <div className="inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[0.1em] uppercase text-fg-mute font-medium">
          <span className="w-7 h-px bg-border-strong" />§ 04 · Aplicação
        </div>
        <h2
          className="font-serif font-normal mx-auto mt-3.5 mb-6"
          style={{
            fontSize: 'clamp(44px, 6vw, 88px)',
            letterSpacing: '-0.03em',
            lineHeight: 1.02,
            maxWidth: '14ch',
          }}
        >
          Doze lugares.<br /><em className="italic text-primary">Sempre ativos.</em>
        </h2>
      </Reveal>

      {hasCohort && (
        <Reveal delay={80}>
          <p className="font-mono text-[12px] text-fg-mute tracking-[0.04em] mt-2 mb-6">
            {data!.cycle} ·{' '}
            {data!.members.length === 1
              ? '1 selecionado no ciclo atual'
              : `${data!.members.length} selecionados no ciclo atual`}
          </p>
          <ul
            className="mx-auto mb-10 grid gap-x-5 gap-y-6 justify-center"
            style={{
              gridTemplateColumns: `repeat(${Math.min(data!.members.length, 6)}, minmax(88px, 112px))`,
            }}
          >
            {data!.members.map((m, i) => (
              <li
                key={`${m.name}-${i}`}
                className="flex flex-col items-center text-center gap-2.5"
              >
                <CohortAvatar src={m.avatar} name={m.name} />
                <span className="text-[13px] font-medium text-fg leading-tight">
                  {m.name}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      <Reveal delay={hasCohort ? 160 : 80}>
        <p className="text-fg-mute max-w-[52ch] mx-auto mb-8 text-base">
          Formulário e entrevista com o diretor. A cada fim de ciclo tem check de performance. Quem
          não está ativo sai, quem está na lista entra. Ciclo 2026.3 abre em Julho.
        </p>
        <button
          type="button"
          onClick={onOpenWaitlist}
          className="inline-flex items-center gap-2 px-8 py-[18px] rounded-full bg-fg text-bg text-base font-medium hover:bg-primary transition-all hover:-translate-y-0.5"
          style={{ boxShadow: '0 1px 2px rgba(20,24,31,.06)' }}
        >
          Entrar na lista de espera
          <ArrowUpRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </Reveal>
    </section>
  );
}

function CohortAvatar({ src, name }: { src: string | null; name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={144}
        height={144}
        className="w-[72px] h-[72px] rounded-full object-cover border border-border-token"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="w-[72px] h-[72px] rounded-full bg-bg-subtle border border-border-token grid place-items-center font-serif text-lg text-fg-soft"
    >
      {initials || '–'}
    </span>
  );
}
