'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { findFirstGlossaryMatch } from './glossary';

type Token = { kind: 'plain' | 'bold' | 'code'; text: string };

const MARKUP_REGEX = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  MARKUP_REGEX.lastIndex = 0;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKUP_REGEX.exec(text)) !== null) {
    if (m.index > lastIndex) {
      tokens.push({ kind: 'plain', text: text.slice(lastIndex, m.index) });
    }
    if (m[1] !== undefined) {
      tokens.push({ kind: 'bold', text: m[2] });
    } else if (m[3] !== undefined) {
      tokens.push({ kind: 'code', text: m[4] });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ kind: 'plain', text: text.slice(lastIndex) });
  }
  return tokens;
}

function glossarize(text: string, seen: Set<string>, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let idx = 0;
  while (remaining.length > 0) {
    const match = findFirstGlossaryMatch(remaining, seen);
    if (!match) {
      nodes.push(remaining);
      break;
    }
    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index));
    }
    const termText = remaining.slice(match.index, match.index + match.length);
    seen.add(match.canonical);
    nodes.push(
      <GlossaryChip
        key={`${keyPrefix}-${match.canonical}-${idx++}`}
        term={termText}
        definition={match.def}
      />,
    );
    remaining = remaining.slice(match.index + match.length);
  }
  return nodes;
}

function renderProse(text: string, seen: Set<string>, keyPrefix = 'g'): ReactNode {
  const tokens = tokenize(text);
  return tokens.map((token, i) => {
    if (token.kind === 'code') {
      return (
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded bg-bg-subtle px-1 py-0.5 font-mono text-[0.85em] text-fg"
        >
          {token.text}
        </code>
      );
    }
    const inner = glossarize(token.text, seen, `${keyPrefix}-t${i}`);
    if (token.kind === 'bold') {
      return (
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-fg">
          {inner}
        </strong>
      );
    }
    return <Fragment key={`${keyPrefix}-p${i}`}>{inner}</Fragment>;
  });
}

type GlossarizedProps = {
  text: string;
  seen: Set<string>;
  keyPrefix?: string;
  className?: string;
};

export function Glossarized({
  text,
  seen,
  keyPrefix,
  className,
}: GlossarizedProps): ReactNode {
  const content = renderProse(text, seen, keyPrefix);
  if (className) {
    return <span className={className}>{content}</span>;
  }
  return <>{content}</>;
}

function GlossaryChip({
  term,
  definition,
}: {
  term: string;
  definition: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'cursor-help underline decoration-dotted underline-offset-[3px] transition-colors',
          open
            ? 'decoration-primary text-fg'
            : 'decoration-fg-faint text-fg hover:decoration-fg-soft',
        )}
        aria-expanded={open}
      >
        {term}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1.5 block w-72 rounded-card border border-border-token bg-surface px-3.5 py-3 shadow-lg"
          // stop bubbling so clicking inside doesn't close via outside-click handler
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="font-mono text-[9px] uppercase tracking-eyebrow text-fg-mute font-semibold">
            Glossário · {term}
          </span>
          <span className="mt-1.5 block font-sans text-[13px] leading-relaxed text-fg-soft">
            {definition}
          </span>
        </span>
      )}
    </span>
  );
}
