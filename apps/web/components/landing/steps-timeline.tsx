'use client';

import { motion } from 'framer-motion';
import { ArrowRight, FileText, Trophy, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { STEPS } from './landing-data';

const STEP_ICONS: LucideIcon[] = [FileText, Trophy, Users];

export function StepsTimeline() {
  return (
    <section id="processo" className="py-24 px-6 lg:px-8 bg-surface-muted">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-caption text-brand font-semibold uppercase tracking-[0.1em] mb-3">Processo seletivo</p>
          <h2 className="text-h1 text-foreground">Três etapas para uma preparação de elite</h2>
          <p className="text-body text-foreground-muted mt-3 max-w-lg mx-auto">
            O processo é simples, mas a seleção é rigorosa. Apenas 12 vagas por ciclo.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Timeline connector (desktop) */}
          <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-brand/20 via-brand to-brand/20" />

          {STEPS.map((step, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="text-center relative"
              >
                <div className="h-24 w-24 rounded-2xl bg-surface border border-border shadow-sm flex flex-col items-center justify-center mx-auto mb-5 relative z-10">
                  <span className="text-caption text-brand font-bold">ETAPA</span>
                  <span className="text-h1 text-foreground font-bold leading-none">{step.number}</span>
                </div>
                <h3 className="text-h3 text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-foreground-muted leading-relaxed max-w-[260px] mx-auto">{step.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* FOMO + CTA block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16 bg-surface border border-border rounded-2xl p-8 text-center shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <div>
              <p className="text-h3 text-foreground font-bold">O Ciclo 2026.1 já começou</p>
              <p className="text-sm text-foreground-muted mt-1">
                Todas as 12 vagas foram preenchidas. Inscreva-se para o próximo.
              </p>
            </div>
            <a
              href="#interesse"
              className="bg-brand hover:bg-brand-hover text-white px-8 py-3.5 rounded-pill text-sm font-semibold transition-all hover:scale-[1.02] shadow-glow-primary flex items-center gap-2 flex-shrink-0"
            >
              Lista de espera
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="flex -space-x-2">
              {[...'ABCDE'].map((l, i) => (
                <div key={i} className="h-7 w-7 rounded-full bg-brand-soft border-2 border-surface flex items-center justify-center text-[10px] font-bold text-brand">
                  {l}
                </div>
              ))}
            </div>
            <p className="text-caption text-foreground-muted">+7 pessoas já na lista de espera</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
