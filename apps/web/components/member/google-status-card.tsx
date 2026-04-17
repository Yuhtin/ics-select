'use client';

interface GoogleStatusCardProps {
  connected: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export function GoogleStatusCard({ connected }: GoogleStatusCardProps) {
  if (connected) {
    return (
      <div className="rounded-card border border-rule bg-surface p-6 space-y-2">
        <p className="font-sans text-sm font-semibold text-ink">Google Calendar</p>
        <p className="font-sans text-sm text-ink-soft">
          Connected. Study sessions are automatically added to your calendar when a plan is published.
        </p>
        <a
          href={`${API_URL}/auth/google`}
          className="inline-flex items-center font-sans text-xs text-ink-mute underline underline-offset-2 hover:text-ink"
        >
          Reconnect
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-card border-l-4 border-outcome-stuck bg-surface p-6 space-y-3 shadow-lift">
      <p className="font-sans text-sm font-semibold text-ink">Google Calendar not connected</p>
      <p className="font-sans text-sm text-ink-soft">
        Without Google Calendar access, the scheduler cannot create events. Connect now so your plans
        land directly in your calendar.
      </p>
      <a
        href={`${API_URL}/auth/google`}
        className="inline-flex h-8 items-center justify-center gap-2 rounded-pill bg-ink px-3 text-xs font-semibold text-paper transition-colors hover:bg-ink-soft"
      >
        Connect Google Calendar
      </a>
    </div>
  );
}
