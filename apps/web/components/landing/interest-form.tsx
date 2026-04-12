'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle } from 'lucide-react';

export function InterestForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email) setSubmitted(true);
  };

  return (
    <section id="interesse" className="py-24 px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand-hover to-[hsl(243_75%_45%)]" />

      <div className="mx-auto max-w-2xl text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="badge-exclusive mx-auto mb-6 w-fit">
            Vagas esgotadas — Ciclo 2026.1
          </div>
          <h2 className="text-h1 text-white">Garanta sua vaga no proximo ciclo</h2>
          <p className="text-body text-white/70 mt-3">
            Deixe seu email para ser avisado quando abrirem as inscricoes.
          </p>
        </motion.div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 flex flex-col items-center gap-3"
          >
            <CheckCircle className="h-12 w-12 text-white" />
            <p className="text-h3 text-white">Pronto! Voce sera avisado.</p>
            <p className="text-sm text-white/60">Fique de olho no seu email.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex-1 rounded-pill px-5 py-3 text-sm text-foreground bg-white border-0 outline-none focus:ring-2 focus:ring-white/30 placeholder:text-foreground-subtle"
            />
            <input
              type="email"
              placeholder="Seu melhor email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 rounded-pill px-5 py-3 text-sm text-foreground bg-white border-0 outline-none focus:ring-2 focus:ring-white/30 placeholder:text-foreground-subtle"
            />
            <button
              type="submit"
              className="bg-accent hover:bg-accent-hover text-white rounded-pill px-6 py-3 text-sm font-semibold flex items-center gap-2 justify-center transition-colors shadow-glow-accent"
            >
              Garantir vaga
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
        <p className="text-caption text-white/40 mt-4">Sem spam. Seus dados estao seguros.</p>
      </div>
    </section>
  );
}
