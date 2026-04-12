'use client';

import { motion } from 'framer-motion';
import { FEATURES } from './landing-data';

export function FeatureBento() {
  return (
    <section id="programa" className="py-24 px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-h1 text-foreground">Um programa diferente de tudo que voce ja viu</h2>
          <p className="text-body text-foreground-muted mt-3 max-w-2xl mx-auto">
            Combinamos tecnologia, acompanhamento personalizado e gamificacao para maximizar sua preparacao.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`bg-surface border border-border rounded-xl p-7 shadow-sm hover:shadow-md transition-shadow ${
                feature.span === 2 ? 'md:col-span-2' : ''
              }`}
            >
              <h3 className="text-h3 text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-foreground-muted">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
