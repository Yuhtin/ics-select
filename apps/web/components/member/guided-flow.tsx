'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

export interface GuidedFlowProps {
  stepKey: string;
  headingId: string;
  index: number;
  total: number;
  direction: 1 | -1;
  title: string;
  description?: string;
  canContinue: boolean;
  final: boolean;
  submitLabel: string;
  submittingLabel: string;
  submitting?: boolean;
  exitLabel: string;
  onExit: () => void;
  onPrevious: () => void;
  onContinue: () => void;
  onSubmit: () => void;
  context?: ReactNode;
  children: ReactNode;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const ACTION = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-input px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

/** Presentation only: feature values, validation, and persistence stay with the caller. */
export function GuidedFlow(props: GuidedFlowProps) {
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const currentStepRef = useRef(props.stepKey);
  currentStepRef.current = props.stepKey;
  const navigationLock = useRef(false);
  const [presentedStep, setPresentedStep] = useState(props.stepKey);
  const [navigationPending, setNavigationPending] = useState(false);
  const transitioning = navigationPending || presentedStep !== props.stepKey;

  function navigate(action: () => void) {
    if (navigationLock.current || transitioning || props.submitting) return;
    // Lock synchronously as well as disabling controls: two activations can arrive
    // before React renders the next question. Only its completed entrance unlocks.
    navigationLock.current = true;
    setNavigationPending(true);
    action();
  }

  function continueOrSubmit() {
    if (!props.canContinue || navigationLock.current || transitioning || props.submitting) return;
    if (props.final) props.onSubmit();
    else navigate(props.onContinue);
  }
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);

  return (
    <section className="grid min-h-[min(680px,calc(100dvh-72px))] grid-rows-[auto_1fr_auto]">
      <header className="flex items-center gap-4">
        <button type="button" onClick={props.onExit} aria-label={props.exitLabel} className={`${ACTION} px-2 text-fg-soft`}>
          <X aria-hidden className="h-4 w-4" strokeWidth={1.5} /><span>Exit</span>
        </button>
        <span aria-hidden className="h-[3px] flex-1 overflow-hidden bg-border-token">
          <motion.span className="block h-full origin-left bg-primary" initial={false} animate={{ scaleX: (props.index + 1) / props.total }} transition={{ duration: reduceMotion ? 0 : 0.3, ease: EASE }} />
        </span>
        <span aria-hidden className="shrink-0 font-mono text-xs text-fg-mute">{props.index + 1} of {props.total}</span>
        <span className="sr-only" aria-live="polite" aria-atomic="true">Question {props.index + 1} of {props.total}</span>
      </header>
      <div className={props.context
        ? 'grid min-w-0 items-center gap-6 py-6 lg:py-8 lg:grid-cols-[minmax(260px,300px)_minmax(0,680px)] lg:justify-center lg:gap-12'
        : 'mx-auto grid w-full min-w-0 max-w-[680px] items-center py-10'}>
        {props.context}
        <AnimatePresence mode="wait" initial={false} custom={props.direction}>
          <motion.div
            key={props.stepKey}
            data-guided-panel
            className="min-w-0"
            custom={props.direction}
            variants={{
              enter: (direction: number) => ({ opacity: 0, y: reduceMotion ? 0 : 24 * direction }),
              active: { opacity: 1, y: 0 },
              exit: (direction: number) => ({ opacity: 0, y: reduceMotion ? 0 : -24 * direction }),
            }}
            initial="enter"
            animate="active"
            exit="exit"
            transition={{ duration: reduceMotion ? 0.1 : 0.3, ease: EASE }}
            onAnimationComplete={(definition) => {
              if (definition === 'active' && currentStepRef.current === props.stepKey && headingRef.current?.id === props.headingId) {
                setPresentedStep(props.stepKey);
                setNavigationPending(false);
                navigationLock.current = false;
                headingRef.current.focus({ preventScroll: true });
              }
            }}
          >
            <h1 id={props.headingId} ref={headingRef} tabIndex={-1} className="text-[28px] font-semibold leading-[1.15] tracking-[-0.045em] text-fg outline-none sm:text-[36px]">{props.title}</h1>
            {props.description && <p className="mt-3 max-w-prose text-sm leading-relaxed text-fg-soft">{props.description}</p>}
            <div className="mt-7">{props.children}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-border-token py-5">
        <button type="button" aria-label="Previous question" onClick={() => navigate(props.onPrevious)} disabled={props.index === 0 || props.submitting || transitioning} className={`${ACTION} text-fg-soft disabled:invisible`}>
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.5} />Previous
        </button>
        <motion.button
          type="button"
          whileTap={reduceMotion || !props.canContinue || props.submitting || transitioning ? undefined : { scale: 0.98 }}
          onClick={continueOrSubmit}
          disabled={!props.canContinue || props.submitting || transitioning}
          className={`${ACTION} bg-primary px-5 font-semibold text-primary-fg disabled:bg-bg-subtle disabled:text-fg-mute`}
        >
          {props.final ? (props.submitting ? props.submittingLabel : props.submitLabel) : 'Continue'}
          {!props.final && <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.5} />}
        </motion.button>
      </footer>
    </section>
  );
}
