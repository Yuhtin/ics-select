'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, ArrowUpRight } from 'lucide-react';
import { submitWaitlist, getWaitlistConfig, type WaitlistConfig } from '../../lib/waitlist/api';
import { labelToCourse } from '../../lib/waitlist/course';

type ModalState = 'form' | 'submitting' | 'success' | 'error';

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

  useEffect(() => setMounted(true), []);

  // Fetch waitlist config (target cycle) whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    getWaitlistConfig().then(setConfig).catch(() => {/* leave config null on failure */});
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

  // Reset to form whenever modal re-opens
  useEffect(() => {
    if (open) setState('form');
  }, [open]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState('submitting');
    const formData = new FormData(e.currentTarget);
    const courseLabel = formData.get('course')?.toString() ?? '';
    const course = labelToCourse(courseLabel);
    if (!course) {
      setState('error');
      return;
    }
    const skill = Number(formData.get('skill') ?? 0);
    if (!Number.isFinite(skill) || skill < 1 || skill > 5) {
      setState('error');
      return;
    }

    try {
      await submitWaitlist({
        name: String(formData.get('name') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        course,
        skillLevel: skill,
        github: String(formData.get('github') ?? '').trim() || undefined,
        linkedin: String(formData.get('linkedin') ?? '').trim() || undefined,
        wantsUpdates: formData.get('updates') === 'on',
        website: String(formData.get('website') ?? ''),
      });
      setState('success');
    } catch {
      setState('error');
    }
  }, []);

  if (!mounted) return null;

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
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
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
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-4 right-4 w-9 h-9 rounded-full border border-border-token bg-surface text-fg-soft grid place-items-center hover:bg-bg-subtle hover:text-fg transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {(state === 'form' || state === 'submitting' || state === 'error') && (
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
                  Receba um aviso<br />quando abrirmos.
                </h3>
                <p className="text-fg-mute text-sm leading-[1.5] mb-6">
                  Sem spam. Um email só: no dia que as aplicações abrirem, com o link direto.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                  {/* Honeypot — off-screen text input; bots fill it, humans never see it. */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden"
                  />
                  <Field label="Nome">
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Como devemos te chamar?"
                      className="modal-input"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="seu@email.com"
                      className="modal-input"
                    />
                  </Field>
                  <Field label="Curso">
                    <select name="course" required className="modal-input">
                      <option value="">Selecione…</option>
                      <option>Ciência da Computação</option>
                      <option>Administração</option>
                      <option>Engenharia de Software</option>
                      <option>Engenharia de Computação</option>
                      <option>Sistemas de Informação</option>
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Link GitHub">
                      <input
                        type="url"
                        name="github"
                        placeholder="github.com/seuuser"
                        className="modal-input"
                      />
                    </Field>
                    <Field label="Link LinkedIn">
                      <input
                        type="url"
                        name="linkedin"
                        placeholder="linkedin.com/in/seuuser"
                        className="modal-input"
                      />
                    </Field>
                  </div>
                  <Field label="Nível de conhecimento em programação">
                    <SkillScale name="skill" />
                  </Field>
                  <label className="flex items-start gap-2.5 py-1.5 text-[13px] text-fg-soft cursor-pointer">
                    <input
                      type="checkbox"
                      name="updates"
                      defaultChecked
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      Quero receber notas mensais sobre progresso das cohorts atuais.
                    </span>
                  </label>
                  <button
                    type="submit"
                    disabled={state === 'submitting' || !config?.cycleTarget}
                    className="mt-1 flex items-center justify-center gap-2 bg-fg text-bg rounded-full py-3.5 px-5 text-sm font-medium hover:bg-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {state === 'submitting' ? 'Enviando…' : config?.cycleTarget ? 'Entrar na lista' : 'Aguardando abertura do próximo ciclo'}
                    {state !== 'submitting' && config?.cycleTarget && (
                      <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                    )}
                  </button>
                  {state === 'error' && (
                    <p className="text-red-600 text-xs mt-1 text-center">
                      Não foi possível enviar. Tenta de novo em instantes.
                    </p>
                  )}
                  <p className="text-[11px] text-fg-faint text-center mt-1">
                    Ao enviar, concorda com nossos{' '}
                    <a href="#" className="text-fg-mute underline-offset-2 hover:underline">
                      termos
                    </a>
                    . 6 meses, 12 vagas, 1 ciclo por vez.
                  </p>
                </form>
              </>
            )}

            {state === 'success' && (
              <div className="text-center py-5">
                <div className="w-16 h-16 rounded-full bg-success-soft text-success mx-auto mb-4 grid place-items-center">
                  <Check className="w-8 h-8" strokeWidth={2.5} />
                </div>
                <h4 className="font-serif text-[26px] font-medium tracking-[-0.02em] mb-2 text-fg">
                  Você está na lista.
                </h4>
                <p className="text-fg-mute text-sm">
                  Te avisamos assim que o ciclo 2026.3 abrir. Enquanto isso, dá uma olhada em{' '}
                  <a
                    href="#program"
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
    document.body
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

function SkillScale({ name }: { name: string }) {
  const [value, setValue] = useState<number>(0);
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
            onClick={() => setValue(n)}
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
      <input type="hidden" name={name} value={value || ''} required />
    </div>
  );
}
