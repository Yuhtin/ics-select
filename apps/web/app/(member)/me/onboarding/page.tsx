'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { TRACKS } from '@ics-select/shared';
import {
  useUpdateAvailability,
  useUpdateProfile,
} from '../../../../lib/queries/me-settings';
import { useAuth } from '../../../../lib/auth/auth-context';
import { ApiErrorResponse } from '../../../../lib/api/client';
import { PhoneInput } from '../../../../components/member/phone-input';
import { TrackPicker } from '../../../../components/member/track-picker';
import {
  AvailabilityPresets,
  type AvailabilityMinutes,
} from '../../../../components/member/availability-presets';
import { SessionLengthPresets } from '../../../../components/member/session-length-presets';
import { ThemePicker } from '../../../../components/member/theme-picker';
import { useThemeWithSync } from '../../../../lib/theme/use-theme-sync';
import { useUpdateTheme } from '../../../../lib/queries/me-theme';

const PHONE_REGEX = /^\+\d{8,15}$/;

type Availability = AvailabilityMinutes;

const DEFAULT_AVAILABILITY: Availability = {
  mondayMinutes: 60,
  tuesdayMinutes: 60,
  wednesdayMinutes: 60,
  thursdayMinutes: 60,
  fridayMinutes: 30,
  saturdayMinutes: 90,
  sundayMinutes: null,
};

type StepId = 0 | 1 | 2 | 3;

const EASE = [0.16, 1, 0.3, 1] as const;

export default function MemberOnboardingPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigationLock = useRef(false);
  const [transitioning, setTransitioning] = useState(false);
  const { user, refetch } = useAuth();
  const updateProfile = useUpdateProfile();
  const updateAvailability = useUpdateAvailability();
  const { resolvedTheme, setTheme, mounted } = useThemeWithSync();
  const updateTheme = useUpdateTheme();

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
    () => Object.values(availability).reduce<number>((sum, v) => sum + (v ?? 0), 0) > 0,
    [availability],
  );

  const canAdvance =
    step === 0 ? phoneOk :
    step === 1 ? trackOk :
    step === 2 ? availabilityOk :
    true; // step 3 (theme) always has a default
  const submitting =
    updateProfile.isPending || updateAvailability.isPending || updateTheme.isPending;

  function goTo(next: StepId) {
    if (navigationLock.current || submitting) return;
    navigationLock.current = true;
    setTransitioning(true);
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  async function handleFinish() {
    if (submitting || navigationLock.current) return;
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
        mondayMinutes: availability.mondayMinutes ?? 0,
        tuesdayMinutes: availability.tuesdayMinutes ?? 0,
        wednesdayMinutes: availability.wednesdayMinutes ?? 0,
        thursdayMinutes: availability.thursdayMinutes ?? 0,
        fridayMinutes: availability.fridayMinutes ?? 0,
        saturdayMinutes: availability.saturdayMinutes ?? 0,
        sundayMinutes: availability.sundayMinutes ?? 0,
        preferredSessionMinutes: sessionMin,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Sao_Paulo',
      });
      // Theme was already persisted per-click via useThemeWithSync. This is a
      // belt-and-suspenders final write in case the user picked theme while
      // unauthenticated (we don't believe that's possible in this flow, but the
      // call is idempotent so we do it anyway). Failure does not block finish.
      try {
        const pref = (resolvedTheme === 'dark' ? 'DARK' : 'LIGHT') as 'LIGHT' | 'DARK';
        await updateTheme.mutateAsync({ themePreference: pref });
      } catch {
        // swallow — localStorage already has the choice
      }
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

  const stepVariants = {
    enter: (direction: 1 | -1) => ({ opacity: 0, y: reduceMotion ? 0 : direction * 24 }),
    center: { opacity: 1, y: 0 },
    exit: (direction: 1 | -1) => ({ opacity: 0, y: reduceMotion ? 0 : direction * -20 }),
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="mx-auto max-w-[680px] py-6 md:py-10">
      <header className="mb-10 space-y-3">
        <p className="font-sans text-xs font-medium text-fg-mute">
          Welcome{user?.name ? `, ${firstName}` : ''}
        </p>
        <h1 className="font-sans text-[32px] font-semibold leading-[1.1] tracking-[-0.045em] text-fg md:text-[40px]">
          Four small things.
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
            data-onboarding-panel
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0.1 : 0.3, ease: EASE }}
            onAnimationComplete={(definition) => {
              if (definition !== 'center') return;
              const changedStep = navigationLock.current;
              navigationLock.current = false;
              setTransitioning(false);
              if (changedStep) headingRef.current?.focus({ preventScroll: true });
            }}
          >
            {step === 0 && (
              <StepCard
                headingRef={headingRef}
                eyebrow="Step 1 / 4 · WhatsApp"
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
                  <p className="mt-2 font-sans text-[11px] text-danger">
                    E.164 format: + country code + number. Example: +5511999999999
                  </p>
                )}
              </StepCard>
            )}

            {step === 1 && (
              <StepCard
                headingRef={headingRef}
                eyebrow="Step 2 / 4 · Track"
                title="Which one are you shooting for?"
                subtitle="Shapes the kind of practice the director picks each week. You can switch between cycles."
              >
                <TrackPicker value={track} onChange={setTrack} />
              </StepCard>
            )}

            {step === 2 && (
              <StepCard
                headingRef={headingRef}
                eyebrow="Step 3 / 4 · Availability"
                title="How much time per day?"
                subtitle="Rough minutes you can protect for study. The scheduler packs blocks into this budget; you can resize it anytime."
              >
                <AvailabilityPresets value={availability} onChange={setAvailability} />

                <div className="mt-6">
                  <p className="font-sans text-xs font-medium text-fg-mute">
                    Preferred session length
                  </p>
                  <p className="mt-1 font-sans text-[13px] text-fg-soft">
                    The chunk size we split longer items into.
                  </p>
                  <div className="mt-3">
                    <SessionLengthPresets value={sessionMin} onChange={setSessionMin} />
                  </div>
                </div>

                <div className="mt-8 flex items-start gap-3 border-t border-border-token pt-5">
                  <Lock className="mt-[2px] h-3.5 w-3.5 shrink-0 text-fg-mute" strokeWidth={1.5} />
                  <p className="font-sans text-[12px] leading-relaxed text-fg-soft">
                    <span className="font-semibold text-fg">Só você enxerga seu Calendar.</span>{' '}
                    O scheduler lê apenas os slots marcados como{' '}
                    <span className="font-medium text-fg">ocupados</span> e
                    agenda as sessões nos horários livres — título,
                    descrição e convidados dos seus eventos ficam invisíveis
                    pra gente.
                  </p>
                </div>
              </StepCard>
            )}

            {step === 3 && (
              <StepCard
                headingRef={headingRef}
                eyebrow="Step 4 / 4 · Appearance"
                title="Dark or light?"
                subtitle="Preview below, the site switches as you pick. You can swap anytime in Settings."
              >
                <ThemePicker
                  value={mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : undefined}
                  onChange={(next) => setTheme(next)}
                  size="onboarding"
                />
              </StepCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {submitError && (
        <p role="alert" className="mt-4 font-sans text-xs text-danger">{submitError}</p>
      )}

      <nav className="mt-10 flex items-center justify-between gap-3 border-t border-border-token pt-5">
        <motion.button
          type="button"
          onClick={() => goTo(Math.max(0, step - 1) as StepId)}
          disabled={step === 0 || transitioning || submitting}
          whileTap={reduceMotion || transitioning || submitting ? undefined : { scale: 0.98 }}
          className={clsx(
            'inline-flex min-h-11 min-w-11 items-center gap-2 rounded-input px-3 font-sans text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            step === 0
              ? 'invisible'
              : 'text-fg-soft hover:bg-bg-subtle hover:text-fg',
          )}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Back
        </motion.button>

        {step < 3 ? (
          <motion.button
            type="button"
            onClick={() => canAdvance && goTo((step + 1) as StepId)}
            disabled={!canAdvance || transitioning}
            whileTap={reduceMotion || !canAdvance || transitioning ? undefined : { scale: 0.98 }}
            className={clsx(
              'inline-flex min-h-11 items-center gap-2 rounded-input px-4 font-sans text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              canAdvance
                ? 'bg-primary text-primary-fg hover:bg-primary/90'
                : 'cursor-not-allowed bg-bg-subtle text-fg-mute',
            )}
          >
            Next
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={handleFinish}
            disabled={!canAdvance || submitting || transitioning}
            whileHover={!reduceMotion && canAdvance && !submitting && !transitioning ? { y: -2 } : undefined}
            whileTap={!reduceMotion && canAdvance && !submitting && !transitioning ? { scale: 0.98 } : undefined}
            transition={{ duration: reduceMotion ? 0 : 0.15, ease: EASE }}
            className={clsx(
              'inline-flex h-12 items-center gap-2 rounded-input px-6 font-sans text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              canAdvance && !submitting
                ? 'bg-primary text-primary-fg hover:bg-primary/95'
                : 'cursor-not-allowed bg-bg-subtle text-fg-mute',
            )}
          >
            {submitting ? 'Saving…' : "LET'S GOOOO"}
            {!submitting && <ArrowRight className="h-4 w-4" strokeWidth={1.5} />}
          </motion.button>
        )}
      </nav>
    </div>
  );
}

function Progress({ step }: { step: StepId }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className="h-[3px] flex-1 overflow-hidden bg-border-token">
        <motion.span
          initial={false}
          animate={{ scaleX: (step + 1) / 4 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: EASE }}
          className="block h-full origin-left bg-primary"
        />
      </span>
      <span aria-hidden className="font-mono text-xs text-fg-mute">{step + 1} of 4</span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">Step {step + 1} of 4</span>
    </div>
  );
}

function StepCard({
  headingRef,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="font-sans text-xs font-medium text-fg-mute">
        {eyebrow}
      </p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-[28px] font-semibold leading-[1.15] tracking-[-0.045em] text-fg outline-none sm:text-[36px]">
        {title}
      </h2>
      <p className="mt-2 max-w-prose font-sans text-[14px] leading-relaxed text-fg-soft">
        {subtitle}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
