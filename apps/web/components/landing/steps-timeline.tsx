'use client';

import { motion } from 'framer-motion';
import { STEPS } from './landing-data';

export function StepsTimeline() {
  return (
    <section id="processo" className="py-24 px-6 lg:px-8 bg-surface-muted">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-caption text-brand font-semibold uppercase tracking-[0.1em] mb-3">Processo</p>
          <h2 className="text-h1 text-foreground">Como funciona</h2>
          <p className="text-body text-foreground-muted mt-3 max-w-lg mx-auto">
            Três etapas simples separam você de uma preparação de elite para entrevistas técnicas.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-0.5 bg-border" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="text-center relative"
            >
              <div className="h-16 w-16 rounded-full bg-brand text-white flex items-center justify-center text-h2 font-bold mx-auto mb-4 relative z-10 shadow-glow-primary">
                {step.number}
              </div>
              <h3 className="text-h3 text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-foreground-muted">{step.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12"
        >
          <a
            href="#interesse"
            className="bg-brand hover:bg-brand-hover text-white px-8 py-3.5 rounded-pill text-body font-semibold transition-all hover:scale-[1.02] shadow-glow-primary inline-flex items-center gap-2"
          >
            Começar agora
          </a>
        </motion.div>
      </div>
    </section>
  );
}
