'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, X } from 'lucide-react';
import {
  submitWaitlist,
  getWaitlistConfig,
  type WaitlistConfig,
} from '../../lib/waitlist/api';
import {
  WAITLIST_COURSES,
  courseToLabel,
  type WaitlistCourse,
} from '../../lib/waitlist/course';

type Step = 1 | 2 | 3 | 4;
type ModalState = 'form' | 'submitting' | 'success' | 'error';

type FormData = {
  name: string;
  email: string;
  course: WaitlistCourse | null;
  year: number | null;
  skillLevel: number;
  github: string;
  linkedin: string;
};

const INITIAL: FormData = {
  name: '',
  email: '',
  course: null,
  year: null,
  skillLevel: 0,
  github: '',
  linkedin: '',
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function WaitlistModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<ModalState>('form');
  const [config, setConfig] = useState<WaitlistConfig | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [data, setData] = useState<FormData>(INITIAL);
  const [stepError, setStepError] = useState<string | null>(null);

  const honeypotRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const githubRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    getWaitlistConfig()
      .then(setConfig)
      .catch(() => {
        /* leave config null */
      });
  }, [open]);

  // Body scroll lock + Esc close
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Reset wizard whenever modal re-opens
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setDirection(1);
    setState('form');
    setData(INITIAL);
    setStepError(null);
  }, [open]);

  // Auto-focus the primary input of each step
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (step === 1) nameRef.current?.focus();
      else if (step === 2) emailRef.current?.focus();
      else if (step === 4) githubRef.current?.focus();
    }, 320); // after step enter animation
    return () => window.clearTimeout(timer);
  }, [open, step]);

  const advance = () => {
    setDirection(1);
    setStep((s) => Math.min(4, s + 1) as Step);
    setStepError(null);
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(1, s - 1) as Step);
    setStepError(null);
  };

  const submitFinal = async () => {
    if (!data.course || !data.year) {
      setState('error');
      return;
    }
    setState('submitting');
    try {
      await submitWaitlist({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        course: data.course,
        year: data.year,
        skillLevel: data.skillLevel,
        github: data.github.trim() || undefined,
        linkedin: data.linkedin.trim() || undefined,
        website: honeypotRef.current?.value ?? '',
      });
      setState('success');
    } catch {
      setState('error');
    }
  };

  const handleStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (step === 1) {
      if (!data.name.trim()) {
        setStepError('Preenche teu nome.');
        return;
      }
      advance();
      return;
    }
    if (step === 2) {
      const email = data.email.trim().toLowerCase();
      if (!/@sou\.inteli\.edu\.br$/i.test(email)) {
        setStepError('Precisa ser um email @sou.inteli.edu.br');
        return;
      }
      setData((d) => ({ ...d, email }));
      advance();
      return;
    }
    if (step === 3) {
      if (!data.course || !data.year || data.skillLevel < 1) {
        setStepError('Preenche todos os campos.');
        return;
      }
      advance();
      return;
    }
    await submitFinal();
  };

  if (!mounted) return null;

  const canSubmit = state !== 'submitting' && !!config?.cycleTarget;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] grid place-items-center p-6"
          style={{
            background: 'hsl(var(--fg) / 0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: EASE }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-labelledby="waitlist-title"
            className="relative w-full max-w-[520px] bg-surface rounded-[24px] p-10 max-h-[calc(100vh-48px)] overflow-y-auto"
            style={{ boxShadow: '0 40px 80px rgba(20,24,31,.24)' }}
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.36, ease: EASE }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-4 right-4 w-9 h-9 rounded-full border border-border-token bg-surface text-fg-soft grid place-items-center hover:bg-bg-subtle hover:text-fg transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {state !== 'success' && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-soft font-mono text-[11px] font-medium tracking-[0.02em] text-fg">
                  <span className="relative inline-block w-2 h-2 rounded-full bg-success animate-pulse-ring" />
                  {config?.cycleTarget
                    ? `Ciclo ${config.cycleTarget} · abre em ${formatStartsAt(config.startsAt)}`
                    : 'Próximo ciclo ainda não anunciado'}
                </div>

                <h3
                  id="waitlist-title"
                  className="font-serif text-[34px] font-normal tracking-[-0.025em] leading-[1.05] mt-3.5 mb-2.5 text-fg"
                >
                  Entre na seleção.
                </h3>
                <p className="text-fg-mute text-sm leading-[1.5] mb-5">
                  Se abrir vaga, entrevistamos na ordem de inscrição. Sem pegadinha.
                </p>

                <ProgressDots step={step} />

                {/* Honeypot kept outside AnimatePresence so it's always mounted */}
                <input
                  ref={honeypotRef}
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden"
                />

                <form onSubmit={handleStepSubmit} className="flex flex-col gap-4">
                  <div className="relative min-h-[180px]">
                    <AnimatePresence mode="wait" custom={direction}>
                      <motion.div
                        key={step}
                        custom={direction}
                        variants={{
                          enter: (dir: number) => ({ opacity: 0, x: 16 * dir }),
                          center: { opacity: 1, x: 0 },
                          exit: (dir: number) => ({ opacity: 0, x: -16 * dir }),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.28, ease: EASE }}
                        className="flex flex-col gap-3.5"
                      >
                        {step === 1 && (
                          <StepName
                            innerRef={nameRef}
                            value={data.name}
                            onChange={(v) => setData((d) => ({ ...d, name: v }))}
                          />
                        )}
                        {step === 2 && (
                          <StepEmail
                            innerRef={emailRef}
                            value={data.email}
                            onChange={(v) => setData((d) => ({ ...d, email: v }))}
                          />
                        )}
                        {step === 3 && (
                          <StepContext
                            course={data.course}
                            year={data.year}
                            skillLevel={data.skillLevel}
                            onCourse={(c) => setData((d) => ({ ...d, course: c }))}
                            onYear={(y) => setData((d) => ({ ...d, year: y }))}
                            onSkill={(s) => setData((d) => ({ ...d, skillLevel: s }))}
                          />
                        )}
                        {step === 4 && (
                          <StepLinks
                            githubRef={githubRef}
                            github={data.github}
                            linkedin={data.linkedin}
                            onGithub={(v) => setData((d) => ({ ...d, github: v }))}
                            onLinkedin={(v) => setData((d) => ({ ...d, linkedin: v }))}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {stepError && (
                    <p className="text-red-600 text-xs text-center -mt-2">{stepError}</p>
                  )}
                  {state === 'error' && !stepError && (
                    <p className="text-red-600 text-xs text-center -mt-2">
                      Não foi possível enviar. Tenta de novo em instantes.
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 mt-1">
                    {step > 1 ? (
                      <button
                        type="button"
                        onClick={goBack}
                        className="text-[13px] text-fg-mute hover:text-fg transition-colors"
                      >
                        ← Voltar
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="inline-flex items-center justify-center gap-2 bg-fg text-bg rounded-full py-3 px-5 text-sm font-medium hover:bg-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {!config?.cycleTarget
                        ? 'Aguardando abertura'
                        : state === 'submitting'
                          ? 'Enviando…'
                          : step === 4
                            ? 'Enviar inscrição'
                            : 'Continuar'}
                      {state !== 'submitting' &&
                        config?.cycleTarget &&
                        (step === 4 ? (
                          <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                        ))}
                    </button>
                  </div>
                </form>
              </>
            )}

            {state === 'success' && (
              <div className="text-center py-5">
                <div className="w-16 h-16 rounded-full bg-success-soft text-success mx-auto mb-4 grid place-items-center">
                  <Check className="w-8 h-8" strokeWidth={2.5} />
                </div>
                <h4 className="font-serif text-[26px] font-medium tracking-[-0.02em] mb-2 text-fg">
                  Inscrição recebida.
                </h4>
                <p className="text-fg-mute text-sm leading-[1.5]">
                  Quando abrir vaga, te chamamos pra entrevista. Sua posição respeita a ordem de chegada. Enquanto isso, dá uma olhada em{' '}
                  <a
                    href="#como-funciona"
                    onClick={onClose}
                    className="text-primary font-medium no-underline hover:underline"
                  >
                    como funciona
                  </a>
                  .
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ProgressDots({ step }: { step: Step }) {
  return (
    <div className="flex gap-1.5 mb-6 mt-5">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            n === step
              ? 'w-6 bg-fg'
              : n < step
                ? 'w-1.5 bg-fg'
                : 'w-1.5 bg-border-token'
          }`}
        />
      ))}
    </div>
  );
}

function StepName({
  innerRef,
  value,
  onChange,
}: {
  innerRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Qual seu nome?">
      <input
        ref={innerRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Como devemos te chamar?"
        className="modal-input"
        autoComplete="name"
      />
    </Field>
  );
}

function StepEmail({
  innerRef,
  value,
  onChange,
}: {
  innerRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Seu email Inteli">
      <input
        ref={innerRef}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="seu@sou.inteli.edu.br"
        className="modal-input"
        autoComplete="email"
        inputMode="email"
      />
      <span className="text-[11px] text-fg-faint">
        Só aceita email @sou.inteli.edu.br.
      </span>
    </Field>
  );
}

function StepContext({
  course,
  year,
  skillLevel,
  onCourse,
  onYear,
  onSkill,
}: {
  course: WaitlistCourse | null;
  year: number | null;
  skillLevel: number;
  onCourse: (c: WaitlistCourse) => void;
  onYear: (y: number) => void;
  onSkill: (s: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Curso">
        <div className="flex flex-wrap gap-1.5">
          {WAITLIST_COURSES.map((c) => {
            const active = course === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onCourse(c)}
                aria-pressed={active}
                className={`px-3 py-2 rounded-full border font-mono text-[11px] uppercase tracking-[0.04em] transition-colors ${
                  active
                    ? 'bg-fg text-bg border-fg'
                    : 'bg-surface text-fg-soft border-border-token hover:border-fg-soft hover:text-fg'
                }`}
              >
                {courseToLabel(c)}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Em que ano você tá?">
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((n) => {
            const active = year === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onYear(n)}
                aria-pressed={active}
                className={`h-10 rounded-[8px] border font-mono text-sm transition-colors ${
                  active
                    ? 'bg-fg text-bg border-fg'
                    : 'bg-surface text-fg-soft border-border-token hover:border-fg-soft hover:text-fg'
                }`}
              >
                {n}º
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Nível de conhecimento em programação">
        <SkillScale value={skillLevel} onChange={onSkill} />
      </Field>
    </div>
  );
}

function StepLinks({
  githubRef,
  github,
  linkedin,
  onGithub,
  onLinkedin,
}: {
  githubRef: React.RefObject<HTMLInputElement | null>;
  github: string;
  linkedin: string;
  onGithub: (v: string) => void;
  onLinkedin: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-fg-mute text-[13px] leading-[1.5]">
        Compartilha seus links se quiser acelerar a triagem. Pode deixar em branco.
      </p>
      <Field label="GitHub (opcional)">
        <input
          ref={githubRef}
          type="url"
          value={github}
          onChange={(e) => onGithub(e.target.value)}
          placeholder="github.com/seuuser"
          className="modal-input"
          autoComplete="off"
        />
      </Field>
      <Field label="LinkedIn (opcional)">
        <input
          type="url"
          value={linkedin}
          onChange={(e) => onLinkedin(e.target.value)}
          placeholder="linkedin.com/in/seuuser"
          className="modal-input"
          autoComplete="off"
        />
      </Field>
    </div>
  );
}

function formatStartsAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-soft">{label}</span>
      {children}
    </label>
  );
}

function SkillScale({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Nível de 1 a 5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(n)}
            className={`h-10 rounded-[8px] border font-mono text-sm transition-colors ${
              active
                ? 'bg-fg text-bg border-fg'
                : 'bg-surface text-fg-soft border-border-token hover:border-fg-soft hover:text-fg'
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
