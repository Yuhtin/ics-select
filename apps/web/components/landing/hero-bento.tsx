'use client';

import { motion } from 'framer-motion';
import { Crown, Lock, Users } from 'lucide-react';

export function HeroBento() {
  return (
    <section className="pt-32 pb-20 px-6 lg:px-8">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 lg:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-display text-foreground leading-[1.1]">
            Preparamos voce para as entrevistas que{' '}
            <span className="relative inline-block">
              <span className="relative z-10">mudam carreiras</span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-brand/20 -z-0 rounded-sm" />
            </span>
            .
          </h1>
          <p className="text-body text-foreground-muted mt-6 max-w-lg">
            Programa exclusivo do Inteli que prepara os 12 melhores alunos para processos seletivos de Big Techs e consultorias de elite.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <a href="#interesse" className="btn-accent-glow px-6 py-3 rounded-pill text-body font-semibold transition-transform">
              Quero participar
            </a>
            <a href="#programa" className="px-6 py-3 rounded-pill text-body font-medium text-foreground-muted border border-border hover:bg-surface-subtle transition-colors">
              Conhecer o programa
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="col-span-2 bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-brand-soft flex items-center justify-center">
                <Crown className="h-5 w-5 text-brand" />
              </div>
              <div>
                <p className="text-h2 font-bold text-foreground">12</p>
                <p className="text-caption text-foreground-muted">Selecionados por ciclo</p>
              </div>
            </div>
            <div className="badge-exclusive mt-3 w-fit">
              Programa Exclusivo
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <Users className="h-5 w-5 text-brand mb-2" />
            <p className="text-h3 font-bold text-foreground">1 Ciclo</p>
            <p className="text-caption text-foreground-muted">Ativo agora</p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <Lock className="h-5 w-5 text-danger mb-2" />
            <p className="text-h3 font-bold text-foreground">Esgotado</p>
            <p className="text-caption text-foreground-muted">Ciclo 2026.1</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
