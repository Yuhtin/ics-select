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
      className="landing-container landing-section"
    >
      <div id="cohorts" className="landing-application">
        <Reveal>
          <p className="landing-eyebrow">Aplicação</p>
          <h2
            className="landing-heading mt-4 mb-6"
          >
            Doze lugares.<br /><span className="text-primary">Sempre ativos.</span>
          </h2>
          <p className="mb-8 max-w-[52ch] text-base leading-relaxed text-fg-soft">
            Formulário e entrevista com o diretor. A cada fim de ciclo tem check de performance. Quem
            não está ativo sai, quem está na lista entra. Ciclo 2026.3 abre em Julho.
          </p>
          <button type="button" onClick={onOpenWaitlist} className="landing-button">
            Entrar na seleção
            <ArrowUpRight aria-hidden className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </Reveal>

        {hasCohort && (
          <Reveal delay={80} className="border-t border-border-token pt-8 lg:pt-4">
            <p className="text-xs leading-relaxed text-fg-soft mb-7">
              {data!.cycle} ·{' '}
              {data!.members.length === 1
                ? '1 selecionado no ciclo atual'
                : `${data!.members.length} selecionados no ciclo atual`}
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-6">
              {data!.members.map((m, i) => (
                <li
                  key={`${m.name}-${i}`}
                  className="flex w-[72px] flex-col items-center gap-2 text-center md:w-[88px]"
                >
                  <CohortAvatar src={m.avatar} name={m.name} />
                  <span className="text-xs font-medium text-fg leading-tight break-words w-full">
                    {m.name}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

      </div>
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
        sizes="(max-width: 767px) 64px, 72px"
        className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full object-cover border border-border-token"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full bg-bg-subtle border border-border-token grid place-items-center text-lg font-medium text-fg-soft"
    >
      {initials || '–'}
    </span>
  );
}
