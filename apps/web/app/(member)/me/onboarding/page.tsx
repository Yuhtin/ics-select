'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { TRACKS } from '@ics-select/shared';
import {
  useUpdateAvailability,
  useUpdateProfile,
} from '../../../../lib/queries/me-settings';
import { useAuth } from '../../../../lib/auth/auth-context';
import { ApiErrorResponse } from '../../../../lib/api/client';
import { PhoneInput } from '../../../../components/member/phone-input';

const TRACK_LABELS: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consulting Tech',
  COMPETITIVE_PROGRAMMING: 'Competitive Programming',
  STARTUP: 'Startup',
  OTHER: 'Other',
};

const TRACK_DESCRIPTIONS: Record<string, string> = {
  BIG_TECH: 'Google, Meta, Amazon, Microsoft. Algorithms and system design.',
  CONSULTING_TECH: 'McKinsey Tech, BCG GAMMA. Case-style technical interviews.',
  COMPETITIVE_PROGRAMMING: 'ACM ICPC, IOI. Competitive patterns, tight problem sets.',
  STARTUP: 'High-agency engineering. Ship fast, reason from first principles.',
  OTHER: "I'll sort the specifics with the director.",
};

const PHONE_REGEX = /^\+\d{8,15}$/;

const DAYS: Array<{ key: DayKey; label: string; short: string }> = [
  { key: 'mondayMinutes', label: 'Monday', short: 'Mon' },
  { key: 'tuesdayMinutes', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesdayMinutes', label: 'Wednesday', short: 'Wed' },
  { key: 'thursdayMinutes', label: 'Thursday', short: 'Thu' },
  { key: 'fridayMinutes', label: 'Friday', short: 'Fri' },
  { key: 'saturdayMinutes', label: 'Saturday', short: 'Sat' },
  { key: 'sundayMinutes', label: 'Sunday', short: 'Sun' },
];

type DayKey =
  | 'mondayMinutes'
  | 'tuesdayMinutes'
  | 'wednesdayMinutes'
  | 'thursdayMinutes'
  | 'fridayMinutes'
  | 'saturdayMinutes'
  | 'sundayMinutes';

type Availability = Record<DayKey, number>;

const DEFAULT_AVAILABILITY: Availability = {
  mondayMinutes: 60,
  tuesdayMinutes: 60,
  wednesdayMinutes: 60,
  thursdayMinutes: 60,
  fridayMinutes: 30,
  saturdayMinutes: 90,
  sundayMinutes: 0,
};

const MINUTE_PRESETS = [0, 30, 60, 90, 120, 180];
const SESSION_PRESETS = [15, 30, 45, 60, 90];

type StepId = 0 | 1 | 2;

const EASE = [0.16, 1, 0.3, 1] as const;

export default function MemberOnboardingPage() {
  const router = useRouter();
  const { user, refetch } = useAuth();
  const updateProfile = useUpdateProfile();
  const updateAvailability = useUpdateAvailability();

  const [step, setStep] = useState<StepId>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [phone, setPhone] = useState('');
  const [track, setTrack] = useState<string>('');
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAILABILITY);
  const [sessionMin, setSessionMin] = useState(30);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const phoneOk = PHONE_REGEX.test(phone);
  const trackOk = TRACKS.includes(track as (typeof TRACKS)[number]);
  const availabilityOk = useMemo(
    () => DAYS.reduce((sum, d) => sum + availability[d.key], 0) > 0,
    [availability],
  );

  const canAdvance = step === 0 ? phoneOk : step === 1 ? trackOk : availabilityOk;
  const submitting = updateProfile.isPending || updateAvailability.isPending;

  function goTo(next: StepId) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  async function handleFinish() {
    if (submitting) return;
    setSubmitError(null);
    try {
      // Profile first — this creates the CycleMembership if missing so the
      // OnboardingGate sees targetTrack on the next /me fetch. Then
      // availability upserts into its own table (independent write).
      await updateProfile.mutateAsync({
        whatsappPhone: phone,
        targetTrack: track as (typeof TRACKS)[number],
      });
      await updateAvailability.mutateAsync({
        ...availability,
        preferredSessionMinutes: sessionMin,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Sao_Paulo',
      });
      await refetch();
      router.replace('/me');
    } catch (err) {
      if (err instanceof ApiErrorResponse && err.apiError?.message) {
        setSubmitError(err.apiError.message);
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Couldn't save. Try again.");
      }
    }
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:py-16">
      <header className="mb-10 space-y-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
          Welcome{user?.name ? `, ${firstName}` : ''}
        </p>
        <h1 className="font-serif text-[44px] font-medium leading-[1.05] tracking-tight text-fg md:text-[52px]">
          Three small things.
        </h1>
        <p className="max-w-prose font-sans text-[15px] leading-relaxed text-fg-soft">
          Then we drop you into your week. Nothing here is permanent — tweak it
          all later in Settings.
        </p>
      </header>

      <Progress step={step} />

      <div className="relative mt-8 min-h-[360px]">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE }}
          >
            {step === 0 && (
              <StepCard
                eyebrow="Step 1 / 3 · WhatsApp"
                title="Where should we reach you?"
                subtitle="Reminders land ten minutes before each study block. Retros open every Friday. WhatsApp only, no email spam."
              >
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  autoFocus
                  error={phone.length > 0 && !phoneOk}
                />
                {phone.length > 0 && !phoneOk && (
                  <p className="mt-2 font-mono text-[11px] text-danger">
                    E.164 format: + country code + number. Example: +5511999999999
                  </p>
                )}
              </StepCard>
            )}

            {step === 1 && (
              <StepCard
                eyebrow="Step 2 / 3 · Track"
                title="Which one are you shooting for?"
                subtitle="Shapes the kind of practice the director picks each week. You can switch between cycles."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {TRACKS.map((t) => {
                    const active = track === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTrack(t)}
                        className={clsx(
                          'group relative flex h-full flex-col items-start gap-1.5 rounded-tile border px-4 py-3.5 text-left transition-all',
                          active
                            ? 'border-primary bg-primary-soft ring-2 ring-primary/30'
                            : 'border-border-token bg-surface hover:-translate-y-[1px] hover:border-border-strong',
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
                        <span className="font-sans text-[13px] leading-relaxed text-fg-soft">
                          {TRACK_DESCRIPTIONS[t]}
                        </span>
                        {active && (
                          <span
                            className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-fg"
                            aria-hidden
                          >
                            <Check className="h-3 w-3" strokeWidth={2.5} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </StepCard>
            )}

            {step === 2 && (
              <StepCard
                eyebrow="Step 3 / 3 · Availability"
                title="How much time per day?"
                subtitle="Rough minutes you can protect for study. The scheduler packs blocks into this budget; you can resize it anytime."
              >
                <div className="space-y-2.5">
                  {DAYS.map((d) => (
                    <div
                      key={d.key}
                      className="flex items-center gap-3 rounded-input border border-border-token bg-surface px-3 py-2"
                    >
                      <span className="w-14 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
                        {d.short}
                      </span>
                      <div className="flex flex-1 flex-wrap gap-1.5">
                        {MINUTE_PRESETS.map((mins) => {
                          const active = availability[d.key] === mins;
                          return (
                            <button
                              key={mins}
                              type="button"
                              onClick={() =>
                                setAvailability((prev) => ({ ...prev, [d.key]: mins }))
                              }
                              className={clsx(
                                'rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors',
                                active
                                  ? 'border-primary bg-primary text-primary-fg'
                                  : 'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
                              )}
                            >
                              {mins === 0 ? 'off' : `${mins}m`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
                    Preferred session length
                  </p>
                  <p className="mt-1 font-sans text-[13px] text-fg-soft">
                    The chunk size we split longer items into.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SESSION_PRESETS.map((mins) => {
                      const active = sessionMin === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setSessionMin(mins)}
                          className={clsx(
                            'rounded-pill border px-3 py-1.5 font-mono text-[12px] font-semibold transition-colors',
                            active
                              ? 'border-primary bg-primary text-primary-fg'
                              : 'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
                          )}
                        >
                          {mins} min
                        </button>
                      );
                    })}
                  </div>
                </div>
              </StepCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {submitError && (
        <p className="mt-4 font-mono text-[11px] text-danger">{submitError}</p>
      )}

      <nav className="mt-10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goTo(Math.max(0, step - 1) as StepId)}
          disabled={step === 0}
          className={clsx(
            'inline-flex h-10 items-center gap-2 rounded-input px-3 font-sans text-sm font-medium transition-colors',
            step === 0
              ? 'invisible'
              : 'text-fg-soft hover:bg-bg-subtle hover:text-fg',
          )}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Back
        </button>

        {step < 2 ? (
          <button
            type="button"
            onClick={() => canAdvance && goTo((step + 1) as StepId)}
            disabled={!canAdvance}
            className={clsx(
              'inline-flex h-10 items-center gap-2 rounded-input px-4 font-sans text-sm font-semibold transition-all',
              canAdvance
                ? 'bg-fg text-bg hover:bg-fg-soft'
                : 'cursor-not-allowed bg-bg-subtle text-fg-mute',
            )}
          >
            Next
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : (
          <motion.button
            type="button"
            onClick={handleFinish}
            disabled={!canAdvance || submitting}
            whileHover={canAdvance && !submitting ? { scale: 1.02 } : undefined}
            whileTap={canAdvance && !submitting ? { scale: 0.98 } : undefined}
            transition={{ duration: 0.15, ease: EASE }}
            className={clsx(
              'inline-flex h-12 items-center gap-2 rounded-input px-6 font-sans text-[15px] font-bold uppercase tracking-[0.04em] transition-colors',
              canAdvance && !submitting
                ? 'bg-primary text-primary-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_30px_-10px_hsl(var(--primary)/0.5)] hover:bg-primary/95'
                : 'cursor-not-allowed bg-bg-subtle text-fg-mute',
            )}
          >
            {submitting ? 'Saving…' : "LET'S GOOOO"}
            {!submitting && <ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
          </motion.button>
        )}
      </nav>
    </div>
  );
}

const stepVariants = {
  enter: (d: 1 | -1) => ({ opacity: 0, x: d * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (d: 1 | -1) => ({ opacity: 0, x: d * -24 }),
};

function Progress({ step }: { step: StepId }) {
  return (
    <ol className="flex items-center gap-3">
      {[0, 1, 2].map((i) => {
        const state = i < step ? 'done' : i === step ? 'current' : 'pending';
        return (
          <li key={i} className="flex items-center gap-3">
            <motion.span
              initial={false}
              animate={{
                backgroundColor:
                  state === 'current'
                    ? 'hsl(var(--primary))'
                    : state === 'done'
                      ? 'hsl(var(--fg))'
                      : 'hsl(var(--bg-subtle))',
                color:
                  state === 'pending' ? 'hsl(var(--fg-mute))' : 'hsl(var(--primary-fg))',
                scale: state === 'current' ? 1.05 : 1,
              }}
              transition={{ duration: 0.3, ease: EASE }}
              className={clsx(
                'grid h-8 w-8 place-items-center rounded-full border font-mono text-[11px] font-bold tabular-nums',
                state === 'pending' ? 'border-border-token' : 'border-transparent',
              )}
              aria-label={`Step ${i + 1} ${state}`}
            >
              {state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
            </motion.span>
            {i < 2 && (
              <motion.span
                initial={false}
                animate={{
                  backgroundColor:
                    i < step ? 'hsl(var(--fg))' : 'hsl(var(--bg-subtle))',
                }}
                transition={{ duration: 0.3, ease: EASE }}
                className="h-px w-6 sm:w-10"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepCard({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-[30px] font-medium leading-tight tracking-tight text-fg md:text-[34px]">
        {title}
      </h2>
      <p className="mt-2 max-w-prose font-sans text-[14px] leading-relaxed text-fg-soft">
        {subtitle}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
