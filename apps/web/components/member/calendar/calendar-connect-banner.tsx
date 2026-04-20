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
    <div className="flex items-center justify-between gap-4 rounded-card border border-border-token bg-bg-subtle px-4 py-3">
      <p className="font-sans text-sm text-fg-soft">{copy}</p>
      <a
        href={`${API_URL}/auth/google`}
        className="rounded-input bg-fg px-3 py-1.5 font-sans text-sm font-medium text-bg transition-opacity hover:opacity-90"
      >
        {cta}
      </a>
    </div>
  );
}
