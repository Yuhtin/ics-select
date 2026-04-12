# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public landing page at `/` that presents the ICS Select program with a bento-grid hero, company marquee, feature cards, animated stats, testimonials, steps timeline, and interest capture form.

**Architecture:** All components live in `apps/web/components/landing/`. The root `app/page.tsx` becomes the landing page for unauthenticated users (logged-in users still redirect). Content is hardcoded (no API). Framer Motion handles scroll-triggered animations. The interest form submits to a Google Form via hidden iframe.

**Tech Stack:** Next.js 15 App Router, Framer Motion, Tailwind CSS, Satoshi font.

**Spec:** `docs/superpowers/specs/2026-04-12-landing-page.md`

---

## File Structure

### New files

```
apps/web/components/landing/
├── landing-navbar.tsx         # Floating navbar with anchor links + CTA
├── hero-bento.tsx             # Bento grid hero with headline + stat cards
├── company-marquee.tsx        # Infinite scrolling company ticker
├── feature-bento.tsx          # Feature cards bento grid
├── stats-counter.tsx          # Animated count-up stats
├── testimonial-section.tsx    # Testimonial cards
├── steps-timeline.tsx         # 3-step horizontal timeline
├── interest-form.tsx          # Email/name capture form + CTA section
├── landing-footer.tsx         # Simple footer
└── landing-data.ts            # All hardcoded content (companies, features, stats, testimonials, steps)
```

### Modified files

```
apps/web/app/page.tsx          # Replace redirect-only page with landing page for unauthenticated users
```

---

## Phase 1: Data + Layout Shell

### Task 1: Landing Data File

**Files:**
- Create: `apps/web/components/landing/landing-data.ts`

- [ ] **Step 1: Create the data file with all hardcoded content**

```typescript
// apps/web/components/landing/landing-data.ts

export const COMPANIES = [
  'Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Netflix',
  'McKinsey', 'BCG X', 'QuantumBlack', 'Bain', 'Accenture Strategy',
];

export const FEATURES = [
  { title: 'Plano de estudo personalizado', description: 'Cada membro recebe um plano semanal montado pelo Diretor Educacional com materiais selecionados de video, artigos e problemas.', span: 2 },
  { title: 'Sessoes ao vivo', description: 'Aulas semanais de coding com revisao de conceitos e resolucao de problemas em grupo.', span: 1 },
  { title: 'Google Calendar integrado', description: 'Sessoes de estudo automaticamente agendadas no seu calendario pessoal.', span: 1 },
  { title: 'Progresso gamificado', description: 'Mapa de progressao estilo jogo com feedback por modulo e acompanhamento visual do seu avanco.', span: 1 },
  { title: 'Acompanhamento com IA', description: 'Diagnostico individual, sugestoes de estudo personalizadas e chat contextual sobre seu desempenho.', span: 2 },
];

export const STATS = [
  { value: 12, label: 'Selecionados por ciclo' },
  { value: 50, label: 'Materiais no acervo', suffix: '+' },
  { value: 100, label: 'Horas de conteudo', suffix: '+' },
  { value: 85, label: 'Taxa de conclusao', suffix: '%' },
];

export const TESTIMONIALS = [
  { quote: 'O ICS Select mudou completamente minha forma de me preparar. Em 2 meses eu ja me sentia confiante para entrevistas.', name: 'Membro ICS', role: 'Ciclo 2026.1', avatarUrl: null },
  { quote: 'O plano personalizado e o acompanhamento do diretor fizeram toda a diferenca. Nunca tive esse nivel de suporte.', name: 'Membro ICS', role: 'Ciclo 2026.1', avatarUrl: null },
  { quote: 'A gamificacao me manteve motivado durante todo o ciclo. Cada modulo concluido era uma vitoria.', name: 'Membro ICS', role: 'Ciclo 2026.1', avatarUrl: null },
];

export const STEPS = [
  { number: 1, title: 'Inscricao', description: 'Preencha o formulario de interesse e aguarde a abertura do proximo ciclo.' },
  { number: 2, title: 'Selecao', description: 'Passamos por um processo seletivo tecnico para escolher os 12 participantes.' },
  { number: 3, title: 'Programa', description: 'Durante o ciclo, voce segue planos de estudo semanais com acompanhamento individual.' },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/landing-data.ts
git commit -m "feat(web): add landing page data constants"
```

---

### Task 2: Landing Navbar

**Files:**
- Create: `apps/web/components/landing/landing-navbar.tsx`

- [ ] **Step 1: Create the navbar**

```tsx
// apps/web/components/landing/landing-navbar.tsx
'use client';

import { useState, useEffect } from 'react';
import { BrandLockup } from '../shell/brand-lockup';

const NAV_LINKS = [
  { href: '#programa', label: 'Programa' },
  { href: '#resultados', label: 'Resultados' },
  { href: '#processo', label: 'Processo' },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'backdrop-blur-xl bg-surface/80 border-b border-border/30 shadow-xs' : ''
    }`}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 h-16 flex items-center justify-between">
        <BrandLockup size="md" />

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-body-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        <a
          href="#interesse"
          className="btn-accent-glow px-5 py-2.5 rounded-pill text-body-sm font-semibold transition-transform"
        >
          Quero participar
        </a>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/landing-navbar.tsx
git commit -m "feat(web): add landing navbar with glassmorphism"
```

---

## Phase 2: Sections

### Task 3: Hero Bento

**Files:**
- Create: `apps/web/components/landing/hero-bento.tsx`

- [ ] **Step 1: Create the hero section**

The hero has a split layout: headline left, bento grid cards right. Cards include stat cards and a "Vagas esgotadas" badge.

```tsx
// apps/web/components/landing/hero-bento.tsx
'use client';

import { motion } from 'framer-motion';
import { Crown, Lock, Users, Calendar } from 'lucide-react';

export function HeroBento() {
  return (
    <section className="pt-32 pb-20 px-6 lg:px-8">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 lg:gap-16 items-center">
        {/* Left — headline */}
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

        {/* Right — bento cards */}
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
            <p className="text-h3 font-bold text-foreground">Vagas esgotadas</p>
            <p className="text-caption text-foreground-muted">Ciclo 2026.1</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/hero-bento.tsx
git commit -m "feat(web): add hero bento section with headline and stat cards"
```

---

### Task 4: Company Marquee

**Files:**
- Create: `apps/web/components/landing/company-marquee.tsx`

- [ ] **Step 1: Create the infinite scrolling marquee**

```tsx
// apps/web/components/landing/company-marquee.tsx
'use client';

import { COMPANIES } from './landing-data';

export function CompanyMarquee() {
  const items = [...COMPANIES, ...COMPANIES];

  return (
    <section className="py-8 bg-surface-muted border-y border-border/50 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((company, i) => (
          <span
            key={`${company}-${i}`}
            className="text-h3 font-semibold text-foreground-subtle mx-8 flex-shrink-0"
          >
            {company}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/company-marquee.tsx
git commit -m "feat(web): add company marquee with infinite scroll"
```

---

### Task 5: Feature Bento

**Files:**
- Create: `apps/web/components/landing/feature-bento.tsx`

- [ ] **Step 1: Create the feature cards bento grid**

```tsx
// apps/web/components/landing/feature-bento.tsx
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
              <p className="text-body-sm text-foreground-muted">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/feature-bento.tsx
git commit -m "feat(web): add feature bento grid section"
```

---

### Task 6: Stats Counter

**Files:**
- Create: `apps/web/components/landing/stats-counter.tsx`

- [ ] **Step 1: Create animated count-up stats**

```tsx
// apps/web/components/landing/stats-counter.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { STATS } from './landing-data';

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let frame: number;
    const duration = 2000;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isInView, target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export function StatsCounter() {
  return (
    <section id="resultados" className="py-24 px-6 lg:px-8 bg-surface-muted">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-display text-brand">
                <CountUp target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-body-sm text-foreground-muted mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/stats-counter.tsx
git commit -m "feat(web): add animated stats counter section"
```

---

### Task 7: Testimonials

**Files:**
- Create: `apps/web/components/landing/testimonial-section.tsx`

- [ ] **Step 1: Create testimonial cards**

```tsx
// apps/web/components/landing/testimonial-section.tsx
'use client';

import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { TESTIMONIALS } from './landing-data';

export function TestimonialSection() {
  return (
    <section className="py-24 px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-h1 text-foreground text-center mb-14"
        >
          O que dizem nossos membros
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-surface border border-border rounded-xl p-7 shadow-sm"
            >
              <Quote className="h-8 w-8 text-brand/30 mb-4" />
              <p className="text-body text-foreground italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border/50">
                <div className="h-10 w-10 rounded-full bg-brand-soft flex items-center justify-center text-body-sm font-bold text-brand">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-body-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-caption text-foreground-muted">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/testimonial-section.tsx
git commit -m "feat(web): add testimonial section"
```

---

### Task 8: Steps Timeline

**Files:**
- Create: `apps/web/components/landing/steps-timeline.tsx`

- [ ] **Step 1: Create the 3-step timeline**

```tsx
// apps/web/components/landing/steps-timeline.tsx
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
          {/* Timeline line (desktop only) */}
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
              <p className="text-body-sm text-foreground-muted">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/steps-timeline.tsx
git commit -m "feat(web): add steps timeline section"
```

---

### Task 9: Interest Form + CTA

**Files:**
- Create: `apps/web/components/landing/interest-form.tsx`

- [ ] **Step 1: Create the CTA section with interest form**

```tsx
// apps/web/components/landing/interest-form.tsx
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
    // For now, just show success. Replace with Google Form POST or API endpoint later.
    if (name && email) setSubmitted(true);
  };

  return (
    <section id="interesse" className="py-24 px-6 lg:px-8 bg-brand text-white relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand-hover to-[hsl(243_75%_45%)] opacity-100" />

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
            <p className="text-body-sm text-white/60">Fique de olho no seu email.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex-1 rounded-pill px-5 py-3 text-body text-foreground bg-white border-0 outline-none focus:ring-2 focus:ring-white/30 placeholder:text-foreground-subtle"
            />
            <input
              type="email"
              placeholder="Seu melhor email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 rounded-pill px-5 py-3 text-body text-foreground bg-white border-0 outline-none focus:ring-2 focus:ring-white/30 placeholder:text-foreground-subtle"
            />
            <button
              type="submit"
              className="bg-accent hover:bg-accent-hover text-white rounded-pill px-6 py-3 text-body font-semibold flex items-center gap-2 justify-center transition-colors shadow-glow-accent"
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/interest-form.tsx
git commit -m "feat(web): add interest form CTA section"
```

---

### Task 10: Landing Footer

**Files:**
- Create: `apps/web/components/landing/landing-footer.tsx`

- [ ] **Step 1: Create the footer**

```tsx
// apps/web/components/landing/landing-footer.tsx
import Link from 'next/link';
import { BrandLockup } from '../shell/brand-lockup';

export function LandingFooter() {
  return (
    <footer className="py-12 px-6 lg:px-8 border-t border-border">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BrandLockup size="sm" />
          <span className="text-caption text-foreground-subtle">Feito por Davi Duarte</span>
        </div>
        <div className="flex items-center gap-6 text-caption text-foreground-muted">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Politica de Privacidade</Link>
          <span className="text-foreground-subtle">&copy; 2026</span>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/landing/landing-footer.tsx
git commit -m "feat(web): add landing footer"
```

---

## Phase 3: Assembly

### Task 11: Root Page — Landing for Unauthenticated, Redirect for Authenticated

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Rewrite the root page**

Replace `apps/web/app/page.tsx` with a page that shows the landing for unauthenticated users and redirects authenticated users:

```tsx
// apps/web/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth/auth-context';
import { LandingNavbar } from '../components/landing/landing-navbar';
import { HeroBento } from '../components/landing/hero-bento';
import { CompanyMarquee } from '../components/landing/company-marquee';
import { FeatureBento } from '../components/landing/feature-bento';
import { StatsCounter } from '../components/landing/stats-counter';
import { TestimonialSection } from '../components/landing/testimonial-section';
import { StepsTimeline } from '../components/landing/steps-timeline';
import { InterestForm } from '../components/landing/interest-form';
import { LandingFooter } from '../components/landing/landing-footer';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setShowLanding(true);
      return;
    }
    if (!user.privacyAcceptedAt) {
      router.replace('/privacy');
    } else {
      router.replace(user.role === 'ADMIN' ? '/admin/cycles' : '/map');
    }
  }, [user, isLoading, router]);

  if (!showLanding) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-foreground-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <HeroBento />
        <CompanyMarquee />
        <FeatureBento />
        <StatsCounter />
        <TestimonialSection />
        <StepsTimeline />
        <InterestForm />
      </main>
      <LandingFooter />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ics-select/web build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): assemble landing page on root route"
```

---

### Task 12: SEO Metadata

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Update metadata in layout.tsx**

Update the `metadata` export:

```typescript
export const metadata: Metadata = {
  title: 'ICS Select — Preparacao para Big Techs | Inteli',
  description: 'Programa exclusivo que prepara os 12 melhores alunos do Inteli para entrevistas em Google, Meta, Amazon e consultorias de elite.',
  openGraph: {
    title: 'ICS Select — Preparacao para Big Techs',
    description: 'Programa exclusivo de preparacao para entrevistas tecnicas em Big Techs e consultorias de elite.',
    type: 'website',
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): update SEO metadata for landing page"
```

---

### Task 13: Build Verification + Visual Test

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`

- [ ] **Step 2: Run full build**

Run: `pnpm build`

- [ ] **Step 3: Start dev server and visually verify**

Run: `pnpm --filter @ics-select/web dev`

Open `http://localhost:3000` in a browser (not logged in) and verify:
1. Landing page renders with all sections
2. Navbar scrolls to anchored sections
3. Marquee animates
4. Stats count up when scrolled into view
5. "Quero participar" scrolls to interest form
6. Form shows success state after submission
7. Mobile responsive layout works

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(web): resolve landing page integration issues"
```
