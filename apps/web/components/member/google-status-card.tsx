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
            className="h-2 w-2 rounded-full bg-primary"
          />
          <p className="font-sans text-sm font-semibold text-fg">Connected</p>
        </div>
        {email && (
          <p className="break-all font-sans text-xs text-fg-mute">{email}</p>
        )}
        <p className="font-sans text-sm text-fg-soft">
          Study sessions are automatically added to your calendar when a plan is published.
        </p>
        <a
          href={`${API_URL}/auth/google`}
          className="inline-flex min-h-11 items-center rounded-input font-sans text-sm text-primary dark:text-primary-fg underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Reconnect
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-danger/40 bg-danger-soft p-6 space-y-3">
      <p className="font-sans text-sm font-semibold text-fg">Google Calendar not connected</p>
      <p className="font-sans text-sm text-fg-soft">
        Without Google Calendar access, the scheduler cannot create events. Connect now so your plans
        land directly in your calendar.
      </p>
      <a
        href={`${API_URL}/auth/google`}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-input bg-primary px-4 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Connect Google Calendar
      </a>
    </div>
  );
}
