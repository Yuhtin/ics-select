'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TRACKS } from '@ics-select/shared';
import { useUpdateProfile } from '../../../../lib/queries/me-settings';
import { useAuth } from '../../../../lib/auth/auth-context';
import { ApiErrorResponse } from '../../../../lib/api/client';
import { clsx } from 'clsx';

const TRACK_LABELS: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consulting Tech',
  COMPETITIVE_PROGRAMMING: 'Competitive Programming',
  STARTUP: 'Startup',
  OTHER: 'Other',
};

const TRACK_DESCRIPTIONS: Record<string, string> = {
  BIG_TECH:
    'Google, Meta, Amazon, Microsoft — algorithms, system design, behavioral STAR.',
  CONSULTING_TECH:
    'McKinsey Tech, BCG GAMMA — case-style technical interviews, data modeling.',
  COMPETITIVE_PROGRAMMING:
    'ACM ICPC, IOI, competitive patterns — CLRS, CP-Algorithms, Codeforces.',
  STARTUP:
    'High-agency product + engineering interviews — ship fast, reason from first principles.',
  OTHER: 'I’ll fill in specifics with the program director.',
};

const PHONE_REGEX = /^\+\d{8,15}$/;

export default function MemberOnboardingPage() {
  const router = useRouter();
  const { user, refetch } = useAuth();
  const update = useUpdateProfile();
  const [phone, setPhone] = useState('');
  const [track, setTrack] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const phoneOk = PHONE_REGEX.test(phone.trim());
  const trackOk = TRACKS.includes(track as (typeof TRACKS)[number]);
  const canSubmit = phoneOk && trackOk && !update.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      await update.mutateAsync({
        whatsappPhone: phone.trim(),
        targetTrack: track as (typeof TRACKS)[number],
      });
      await refetch();
      router.replace('/me');
    } catch (err) {
      if (err instanceof ApiErrorResponse && err.apiError?.message) {
        setSubmitError(err.apiError.message);
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Failed to save. Please try again.');
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl py-6 md:py-10">
      <header className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </p>
        <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight text-fg">
          Let&rsquo;s get you set up.
        </h1>
        <p className="font-sans text-sm text-fg-soft max-w-prose">
          Two quick things before you see your plan: where we can reach you, and
          which interview track you&rsquo;re preparing for. You can change both
          later from Settings.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-10 space-y-10">
        <section className="space-y-3">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
              Step 1 · WhatsApp phone
            </p>
            <h2 className="mt-1 font-sans text-lg font-semibold text-fg">
              How should we reach you?
            </h2>
            <p className="mt-1 font-sans text-sm text-fg-soft">
              Used for session reminders 10 minutes before each study block and
              to open the retro window every Friday. Include the country code.
            </p>
          </div>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+5511999999999"
            className={clsx(
              'w-full max-w-sm rounded-input border bg-surface px-3 py-2 font-sans text-sm text-fg transition-colors placeholder:text-fg-faint focus:outline-none focus:ring-2',
              phone.length === 0
                ? 'border-border-strong focus:border-primary focus:ring-primary/15'
                : phoneOk
                  ? 'border-success focus:border-success focus:ring-success/15'
                  : 'border-danger focus:border-danger focus:ring-danger/15',
            )}
          />
          {phone.length > 0 && !phoneOk && (
            <p className="font-mono text-[11px] text-danger">
              Use E.164 format: + country code + number. e.g. +5511999999999
            </p>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
              Step 2 · Career track
            </p>
            <h2 className="mt-1 font-sans text-lg font-semibold text-fg">
              What are you preparing for?
            </h2>
            <p className="mt-1 font-sans text-sm text-fg-soft">
              The program director uses this to shape your weekly plan. Pick
              whichever feels closest — you can switch between cycles.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TRACKS.map((t) => {
              const active = track === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrack(t)}
                  className={clsx(
                    'flex h-full flex-col items-start gap-1 rounded-tile border px-4 py-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary-soft'
                      : 'border-border-token bg-surface hover:bg-surface-hover',
                  )}
                >
                  <span
                    className={clsx(
                      'font-sans text-sm font-semibold',
                      active ? 'text-primary' : 'text-fg',
                    )}
                  >
                    {TRACK_LABELS[t] ?? t}
                  </span>
                  <span className="font-sans text-xs text-fg-soft">
                    {TRACK_DESCRIPTIONS[t]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {submitError && (
          <p className="font-mono text-[11px] text-danger">{submitError}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className={clsx(
              'inline-flex h-10 items-center justify-center rounded-input px-4 font-sans text-sm font-medium transition-colors',
              canSubmit
                ? 'bg-primary text-primary-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary/90'
                : 'cursor-not-allowed bg-bg-subtle text-fg-mute',
            )}
          >
            {update.isPending ? 'Saving…' : 'Save and continue'}
          </button>
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
            Both fields are required
          </p>
        </div>
      </form>
    </div>
  );
}
