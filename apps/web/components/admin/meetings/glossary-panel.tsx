'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Check, Copy, ListTree } from 'lucide-react';
import type { GlossaryGroup, Lesson } from './lesson-types';

/**
 * Formato do WhatsApp: negrito é *asterisco simples*, e o marcador de lista
 * precisa ser "•" e não "*", senão o app come o caractere achando que é o
 * começo de um negrito.
 */
export function glossaryToWhatsApp(lesson: Lesson): string {
  const groups = lesson.glossary ?? [];
  const head = `*Glossário · ${lesson.title}*`;
  const body = groups.map((g, i) => {
    const lines = g.terms.map((t) => `• *${t.term}*: ${t.definition}`);
    return [`*${i + 1}. ${g.title}*`, ...lines].join('\n');
  });
  return [head, ...body].join('\n\n');
}

export function GlossaryPanel({ lesson }: { lesson: Lesson }) {
  const groups = lesson.glossary ?? [];
  const [copied, setCopied] = useState(false);
  const count = groups.reduce((n, g) => n + g.terms.length, 0);

  async function copy() {
    await navigator.clipboard.writeText(glossaryToWhatsApp(lesson));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
            Glossário · {count} termos
          </p>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-snug text-fg-soft">
            Para mandar no grupo depois da aula. O botão copia já formatado para
            o WhatsApp, com negrito nos termos.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className={clsx(
            'inline-flex items-center gap-2 rounded-card border px-4 py-2.5 text-left transition-colors',
            copied
              ? 'border-fg bg-fg text-bg'
              : 'border-border-token bg-surface hover:border-border-strong hover:bg-surface-hover',
          )}
        >
          <span
            className={clsx(
              'inline-grid h-7 w-7 place-items-center rounded-full',
              copied ? 'bg-bg/15 text-bg' : 'bg-bg-subtle text-fg-soft',
            )}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
            )}
          </span>
          <span className="block">
            <span className="block font-sans text-sm font-semibold leading-none">
              {copied ? 'Copiado' : 'Copiar'}
            </span>
            <span
              className={clsx(
                'mt-1 block font-mono text-[10px] uppercase tracking-eyebrow',
                copied ? 'text-bg/70' : 'text-fg-faint',
              )}
            >
              para whatsapp
            </span>
          </span>
        </button>
      </div>

      <div className="grid gap-x-12 gap-y-9 md:grid-cols-2">
        {groups.map((g, i) => (
          <GlossaryGroupBlock key={g.title} group={g} index={i + 1} />
        ))}
      </div>
    </section>
  );
}

function GlossaryGroupBlock({
  group,
  index,
}: {
  group: GlossaryGroup;
  index: number;
}) {
  return (
    <div>
      <h3 className="flex items-baseline gap-2.5 font-serif text-lg font-semibold text-fg">
        <span className="font-mono text-[11px] font-normal text-fg-faint">
          {String(index).padStart(2, '0')}
        </span>
        {group.title}
      </h3>
      <ul className="mt-3 space-y-2.5 border-l border-border-token pl-4">
        {group.terms.map((t) => (
          <li key={t.term} className="font-sans text-sm leading-snug text-fg-soft">
            <span className="font-semibold text-fg">{t.term}</span>
            <span className="text-fg-faint"> · </span>
            {t.definition}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GlossaryTabButton({
  active,
  onClick,
  count,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 rounded-card border px-4 py-2.5 text-left transition-colors',
        active
          ? 'border-fg bg-fg text-bg'
          : 'border-border-token bg-surface hover:border-border-strong hover:bg-surface-hover',
      )}
      title="Glossário da aula, pronto pra mandar no WhatsApp"
    >
      <span
        className={clsx(
          'inline-grid h-7 w-7 place-items-center rounded-full',
          active ? 'bg-bg/15 text-bg' : 'bg-bg-subtle text-fg-soft',
        )}
      >
        <ListTree className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
      <span className="block">
        <span className="block font-sans text-sm font-semibold leading-none">
          Glossário
        </span>
        <span
          className={clsx(
            'mt-1 block font-mono text-[10px] uppercase tracking-eyebrow',
            active ? 'text-bg/70' : 'text-fg-faint',
          )}
        >
          {count} termos
        </span>
      </span>
    </button>
  );
}
