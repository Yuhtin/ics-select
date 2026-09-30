'use client';

import { useEffect, useRef } from 'react';
import type { ItemOutcome } from '@ics-select/shared';
import { detectPlatform, type PlatformKey } from '../lib/format/platform';
import logoNavy from './assets/btg-logo.svg';
import logoWhite from './assets/btg-logo-white.svg';

// Every BTG image asset is imported here and nowhere else.
export const BTG_LOGO_NAVY: string = logoNavy.src;
export const BTG_LOGO_WHITE: string = logoWhite.src;

export function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return (
    <span className="btg-icon" aria-hidden="true" style={style}>
      {name}
    </span>
  );
}

export function HeroMark() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={BTG_LOGO_WHITE} alt="" aria-hidden="true" className="btg-hero-mark" />;
}

export function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '—'
  );
}

export function Avatar({
  name,
  pictureUrl,
  size,
}: {
  name: string;
  pictureUrl?: string | null;
  size?: 'sm';
}) {
  return (
    <span className={size === 'sm' ? 'btg-avatar btg-avatar--sm' : 'btg-avatar'}>
      {pictureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pictureUrl} alt="" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

export const OUTCOMES: Record<ItemOutcome, { label: string; color: string }> = {
  DONE_EASY: { label: 'Mandei bem', color: 'var(--btg-done-easy)' },
  DONE_HARD: { label: 'Consegui, com esforço', color: 'var(--btg-done-hard)' },
  DOUBTS: { label: 'Fiquei com dúvidas', color: 'var(--btg-doubts)' },
  STUCK: { label: 'Travei', color: 'var(--btg-stuck)' },
  SKIPPED: { label: 'Pulei, já sabia', color: 'var(--btg-skipped)' },
  PENDING: { label: 'Ainda não', color: 'var(--btg-pending)' },
};

const PLATFORM: Record<PlatformKey, { label: string; color: string }> = {
  youtube: { label: 'YouTube', color: 'var(--btg-youtube)' },
  leetcode: { label: 'LeetCode', color: 'var(--btg-leetcode)' },
  medium: { label: 'Medium', color: 'var(--btg-medium)' },
  github: { label: 'GitHub', color: 'var(--btg-github)' },
  article: { label: 'Artigo', color: 'var(--btg-article)' },
  book: { label: 'Livro', color: 'var(--btg-book)' },
};

export function platformOf(url: string | null | undefined, format: string | undefined) {
  return PLATFORM[detectPlatform(url, format)];
}

export const DIFFICULTY: Record<string, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Médio',
  HARD: 'Difícil',
};

const hhmm = (d: Date) =>
  d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

export function timeRange(iso: string | null, minutes: number | null): string {
  if (!iso) return 'Sem horário';
  const start = new Date(iso);
  if (!minutes) return hhmm(start);
  return `${hhmm(start)}–${hhmm(new Date(start.getTime() + minutes * 60_000))}`;
}

export function minutesLabel(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h${String(r).padStart(2, '0')}`;
}

export function relativeFromNow(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `há ${diff} min`;
  const h = Math.round(diff / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p className="btg-eyebrow" style={{ padding: 64, textAlign: 'center' }}>
      {label}
    </p>
  );
}

// Native <dialog>: focus trap, Esc and backdrop come from the browser, and it
// renders in the top layer inside `.btg`, so the skin tokens apply (unlike portals).
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="btg-modal"
      style={{ width }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="btg-modal-head">
        <span className="btg-card-title">{title}</span>
        <button type="button" className="btg-icon-btn" aria-label="Fechar" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="btg-modal-body">{children}</div>
      {footer && <div className="btg-modal-foot">{footer}</div>}
    </dialog>
  );
}
