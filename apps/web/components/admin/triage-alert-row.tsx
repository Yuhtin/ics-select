'use client';
import Link from 'next/link';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import type { TriageAlert } from '../../lib/queries/admin-triage';

function Initials({
  name,
  pictureUrl,
  size = 28,
}: {
  name: string;
  pictureUrl: string | null;
  size?: number;
}) {
  if (pictureUrl) {
    return (
      <img
        src={pictureUrl}
        alt=""
        className="rounded-full object-cover border border-rule"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-paper-warm border border-rule font-serif text-ink text-xs font-semibold"
      style={{ width: size, height: size }}
    >
      {initials || '—'}
    </span>
  );
}

function formatRelativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function waUrl(phone: string | null, text: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function composeWhatsappText(alert: TriageAlert): string {
  const firstName = alert.member.name.split(' ')[0] ?? '';
  switch (alert.type) {
    case 'DISAPPEARED':
      return `Oi ${firstName}, tudo bem? Notei que sumiu dos estudos esta semana — algo eu possa ajudar?`;
    case 'SKIPPED_RETROS':
      return `Oi ${firstName}, tô sentindo falta dos seus retrôs. Bora fechar essa semana juntos?`;
    case 'STUCK_RECENT':
    case 'STUCK_REPEATEDLY':
      return `Oi ${firstName}, vi que travou em algum item. Me conta o que tá pegando?`;
    default:
      return `Oi ${firstName},`;
  }
}

function actionsFor(alert: TriageAlert): Array<{ label: string; href: string; disabled?: boolean }> {
  const waLink = waUrl(alert.member.whatsappPhone, composeWhatsappText(alert));
  const whatsappAction = waLink
    ? { label: 'whatsapp ↗', href: waLink }
    : { label: 'whatsapp (no phone)', href: '#', disabled: true };

  switch (alert.type) {
    case 'STUCK_RECENT':
    case 'STUCK_REPEATEDLY':
      return [{ label: 'see member →', href: `/admin/member/${alert.member.id}` }];
    case 'DISAPPEARED':
    case 'SKIPPED_RETROS':
      return [
        whatsappAction,
        { label: 'see member →', href: `/admin/member/${alert.member.id}` },
      ];
    case 'FINISHED_EARLY':
      return [{ label: 'bump next plan →', href: `/admin/member/${alert.member.id}/plan/new` }];
    case 'PLAN_PENDING':
      return [{ label: 'start draft →', href: `/admin/member/${alert.member.id}/plan/new` }];
    case 'CALENDAR_BROKEN':
      return [{ label: 'see member →', href: `/admin/member/${alert.member.id}` }];
    default:
      return [];
  }
}

const BORDER_BY_SEVERITY = {
  urgent: 'border-outcome-stuck',
  attention: 'border-outcome-done-hard',
  scheduled: 'border-rule',
} as const;

export function TriageAlertRow({
  alert,
  onDismiss,
}: {
  alert: TriageAlert;
  onDismiss: () => void;
}) {
  const actions = actionsFor(alert);
  return (
    <div
      className={clsx(
        'flex items-start gap-4 border-l-[3px] border-b border-b-rule py-4 pl-4 transition-colors hover:bg-paper-warm/60',
        BORDER_BY_SEVERITY[alert.severity],
      )}
    >
      <Initials name={alert.member.name} pictureUrl={alert.member.pictureUrl} />
      <div className="flex-1 min-w-0">
        <p className="font-serif-tool text-[15px] font-semibold text-ink leading-tight">
          {alert.member.name}
          <span className="mx-1.5 text-ink-faint">·</span>
          <span className="font-sans text-sm font-normal text-ink-soft">{alert.summary}</span>
        </p>
        <p className="mt-1 font-mono text-[11px] text-ink-mute">
          {formatRelativeTime(alert.occurredAt)}
        </p>
      </div>
      <div className="flex items-center gap-4 font-mono text-[11px]">
        {actions.map((a) => {
          if (a.disabled) {
            return (
              <span
                key={a.label}
                className="text-ink-faint cursor-not-allowed"
                title="No WhatsApp phone on file"
              >
                {a.label}
              </span>
            );
          }
          if (a.href.startsWith('http')) {
            return (
              <a
                key={a.label}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline-offset-2 hover:underline hover:text-focus"
              >
                {a.label}
              </a>
            );
          }
          return (
            <Link
              key={a.label}
              href={a.href}
              className="text-ink underline-offset-2 hover:underline hover:text-focus"
            >
              {a.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="inline-flex items-center gap-1 text-ink-mute hover:text-ink"
        >
          <X className="h-3 w-3" strokeWidth={2} />
          dismiss
        </button>
      </div>
    </div>
  );
}
