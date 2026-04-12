'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { FEATURES } from './landing-data';

export function FeatureBento() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  return (
    <section id="programa" className="py-24 px-6 lg:px-8" ref={containerRef}>
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-caption text-brand font-semibold uppercase tracking-[0.1em] mb-3">O programa</p>
          <h2 className="text-h1 text-foreground">Um programa diferente de tudo<br className="hidden sm:block" /> que você já viu</h2>
          <p className="text-body text-foreground-muted mt-4 max-w-2xl mx-auto">
            Combinamos tecnologia, acompanhamento personalizado e gamificação para maximizar sua preparação para entrevistas técnicas.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`bg-surface border border-border rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow cursor-default ${
                feature.span === 2 ? 'md:col-span-2' : ''
              }`}
            >
              <span className="text-3xl mb-4 block">{feature.icon}</span>
              <h3 className="text-h3 text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-foreground-muted leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
