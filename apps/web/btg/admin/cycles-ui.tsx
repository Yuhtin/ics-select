'use client';

import type { ReactNode } from 'react';
import { Icon, Modal } from '../ui';

// Small pieces shared by the cycles, plans and plan-editor screens.

export const TRACKS: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consultoria tech',
  COMPETITIVE_PROGRAMMING: 'Programação competitiva',
  STARTUP: 'Startup',
  OTHER: 'Outra trilha',
};

export const PLAN_STATUS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendado',
  PUBLISHED: 'Publicado',
  COMPLETED: 'Concluído',
  ARCHIVED: 'Arquivado',
};

/** "28 set" for a date-only or ISO string. Date-only strings are read as local dates. */
export function shortDate(iso: string, withYear = false): string {
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return d
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
    .replace('.', '');
}

/** YYYY-MM-DD in local time. */
export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="btg-ac-toggle"
      onClick={() => onChange(!checked)}
    />
  );
}

export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      width={460}
      footer={
        <>
          <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="btg-btn btg-btn--primary btg-btn--sm"
            style={danger ? { background: 'var(--btg-stuck)' } : undefined}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="btg-soft" style={{ fontSize: 15, lineHeight: '22px' }}>{children}</p>
    </Modal>
  );
}

export function Notice({ kind, children }: { kind: 'ok' | 'bad' | 'warn'; children: ReactNode }) {
  const cls = kind === 'warn' ? 'btg-notice btg-ac-notice--warn' : `btg-notice btg-notice--${kind}`;
  return (
    <div className={cls} role={kind === 'bad' ? 'alert' : 'status'}>
      <Icon name={kind === 'ok' ? 'check_circle' : kind === 'bad' ? 'error' : 'warning'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    </div>
  );
}
