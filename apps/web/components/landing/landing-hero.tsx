import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from './reveal';

export function LandingHero() {
  return (
    <section className="landing-container landing-hero">
      <Reveal className="landing-hero-copy">
        <p className="mb-7 text-xl font-medium tracking-[-0.025em] text-primary">
          Inteli <span className="font-serif text-[1.18em] italic">Academy</span>
        </p>
        <h1 className="landing-hero-title">
          <span>O caminho disciplinado</span>{' '}
          <span>pra tech de elite</span>
        </h1>
        <p className="mt-7 max-w-[45ch] text-base leading-relaxed text-fg-soft md:text-[17px]">
          Seis meses. <strong className="font-semibold text-fg">Sempre 12 ativos.</strong>{' '}
          Plano semanal no seu Calendar, cohort que te cobra, e aulas de arquitetura pra pensar em sistemas de verdade.
        </p>
        <div className="mt-8 flex flex-col items-start gap-4">
          <a href="#cohorts" className="landing-button">
            Quero conhecer
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.8} />
          </a>
          <p className="text-xs leading-relaxed text-fg-soft">
            Ciclo 2026.3 · <strong className="font-semibold">abre em Julho</strong>
          </p>
        </div>
      </Reveal>

      <Reveal delay={100} className="landing-hero-art">
        <div aria-hidden className="landing-hero-blue" />
        <Image
          src="/brand/academy/academy-community.webp"
          alt="Comunidade Inteli Academy reunida no campus do Inteli"
          width={1280}
          height={960}
          priority
          sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) calc(100vw - 80px), 520px"
          className="landing-hero-photo"
        />
        <Image
          src="/brand/academy/academy-robot.webp"
          alt=""
          width={736}
          height={736}
          sizes="(max-width: 767px) 180px, 260px"
          className="landing-hero-robot"
        />
      </Reveal>
    </section>
  );
}
