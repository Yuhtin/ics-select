'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ClipboardList, Code2, Calendar, Map, Bot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
};

const FEATURES: Feature[] = [
  {
    title: 'Plano de estudo sob medida',
    description: 'Cada semana, o Diretor Educacional monta um plano personalizado com vídeos, artigos e problemas selecionados para o seu nível e objetivos.',
    icon: ClipboardList,
    accent: 'bg-brand/10 text-brand',
  },
  {
    title: 'Sessões ao vivo de coding',
    description: 'Aulas semanais onde resolvemos problemas reais de entrevistas técnicas em grupo, com feedback individual e revisão de conceitos.',
    icon: Code2,
    accent: 'bg-success/10 text-success',
  },
  {
    title: 'Google Calendar integrado',
    description: 'Suas sessões de estudo são agendadas automaticamente no seu calendário. Sem desculpa para esquecer.',
    icon: Calendar,
    accent: 'bg-warning/10 text-warning',
  },
  {
    title: 'Mapa de progressão gamificado',
    description: 'Acompanhe seu avanço em um mapa visual estilo jogo. Cada módulo concluído é uma conquista — veja seu progresso crescer.',
    icon: Map,
    accent: 'bg-danger/10 text-danger',
  },
  {
    title: 'Acompanhamento com IA',
    description: 'Diagnóstico individual do seu desempenho, sugestões personalizadas de estudo e chat contextual para tirar dúvidas a qualquer momento.',
    icon: Bot,
    accent: 'bg-brand/10 text-brand',
  },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="flex-shrink-0 w-[340px] bg-surface border border-border rounded-xl p-8 shadow-sm hover:shadow-md transition-all group"
    >
      <div className={`h-12 w-12 rounded-xl ${feature.accent} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h3 className="text-h3 text-foreground mb-3">{feature.title}</h3>
      <p className="text-sm text-foreground-muted leading-relaxed">{feature.description}</p>
    </motion.div>
  );
}

export function FeatureBento() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const x = useTransform(scrollYProgress, [0, 1], ['5%', '-40%']);

  return (
    <section id="programa" ref={containerRef} className="py-24 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="text-caption text-brand font-semibold uppercase tracking-[0.1em] mb-3">O programa</p>
          <h2 className="text-h1 text-foreground max-w-xl">Tudo que você precisa para chegar preparado na entrevista</h2>
          <p className="text-body text-foreground-muted mt-4 max-w-lg">
            Combinamos tecnologia, acompanhamento personalizado e gamificação em um programa de 12 semanas.
          </p>
        </motion.div>
      </div>

      <motion.div
        style={{ x }}
        className="flex gap-5 pl-6 lg:pl-[calc((100vw-72rem)/2+1.5rem)]"
      >
        {FEATURES.map((feature, i) => (
          <FeatureCard key={feature.title} feature={feature} index={i} />
        ))}
      </motion.div>
    </section>
  );
}
