interface CalendarConnectBannerProps {
  variant: 'not_connected' | 'token_expired';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export function CalendarConnectBanner({ variant }: CalendarConnectBannerProps) {
  const copy =
    variant === 'not_connected'
      ? 'Connect your Google Calendar to see your week here.'
      : 'Your Google Calendar session expired. Reconnect to continue.';
  const cta = variant === 'not_connected' ? 'Connect Google Calendar' : 'Reconnect';
  return (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center border-b border-border-token pb-5">
      <p className="font-sans text-sm text-fg-soft">{copy}</p>
      <a
        href={`${API_URL}/auth/google`}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-input bg-primary px-4 font-sans text-sm font-semibold text-primary-fg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {cta}
      </a>
    </div>
  );
}
