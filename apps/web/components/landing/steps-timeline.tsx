'use client';

import { motion } from 'framer-motion';
import { STEPS } from './landing-data';

export function StepsTimeline() {
  return (
    <section id="processo" className="py-24 px-6 lg:px-8 bg-surface-muted">
      <div className="mx-auto max-w-4xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-h1 text-foreground text-center mb-14"
        >
          Como funciona
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-0.5 bg-border" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              className="text-center relative"
            >
              <div className="h-16 w-16 rounded-full bg-brand text-white flex items-center justify-center text-h2 font-bold mx-auto mb-4 relative z-10">
                {step.number}
              </div>
              <h3 className="text-h3 text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-foreground-muted">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
