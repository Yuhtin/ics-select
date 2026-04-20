'use client';

interface GoogleStatusCardProps {
  connected: boolean;
  email?: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export function GoogleStatusCard({ connected, email }: GoogleStatusCardProps) {
  if (connected) {
    return (
      <div className="rounded-card border border-border-token bg-surface p-6 space-y-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-outcome-done-easy"
          />
          <p className="font-sans text-sm font-semibold text-fg">Connected</p>
        </div>
        {email && (
          <p className="font-mono text-xs text-fg-mute">{email}</p>
        )}
        <p className="font-sans text-sm text-fg-soft">
          Study sessions are automatically added to your calendar when a plan is published.
        </p>
        <a
          href={`${API_URL}/auth/google`}
          className="inline-flex items-center font-sans text-xs text-fg-mute underline underline-offset-2 hover:text-fg"
        >
          Reconnect
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-card border-l-4 border-danger bg-surface p-6 space-y-3">
      <p className="font-sans text-sm font-semibold text-fg">Google Calendar not connected</p>
      <p className="font-sans text-sm text-fg-soft">
        Without Google Calendar access, the scheduler cannot create events. Connect now so your plans
        land directly in your calendar.
      </p>
      <a
        href={`${API_URL}/auth/google`}
        className="inline-flex h-8 items-center justify-center gap-2 rounded-pill bg-fg px-3 text-xs font-semibold text-primary-fg transition-colors hover:bg-fg-soft"
      >
        Connect Google Calendar
      </a>
    </div>
  );
}
