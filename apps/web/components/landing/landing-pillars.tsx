import Image from 'next/image';
import { Reveal } from './reveal';

export function LandingPillars() {
  return (
    <section id="como-funciona" className="landing-container landing-section">
      <Reveal className="max-w-[780px]">
        <p className="landing-eyebrow">Como funciona</p>
        <h2 className="landing-heading mt-4">Três coisas. Nada mais.</h2>
        <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-fg-soft">
          Sem gamificação barata, sem &ldquo;jornadas&rdquo; coloridas. Plano semanal individual,
          cohort pequena que te cobra, e aulas de arquitetura que te ensinam a pensar.
        </p>
      </Reveal>

      <div className="landing-pillars-grid mt-12">
        <Reveal as="article" className="landing-pillar-lead">
          <div className="p-6 pb-8 md:p-9">
            <h3 className="landing-pillar-title">Plano semanal,<br />feito pra você.</h3>
            <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-fg-soft">
              Cada semana um plano individual, feito pro seu objetivo e pro seu nível agora.
              Nada de trilha genérica. O que você precisa, na ordem que você precisa.
            </p>
          </div>
          <div className="landing-plan-fragment">
            <Image
              src="/landing/product-me-home.png"
              alt="Plano semanal no Academy Fellow, com a próxima atividade e os estudos do dia"
              width={1440}
              height={1050}
              sizes="(max-width: 1023px) 1200px, 1440px"
              className="landing-plan-image"
            />
          </div>
        </Reveal>

        <div className="grid min-w-0 gap-8">
          <Reveal as="article" delay={60} className="landing-pillar-secondary">
            <h3 className="landing-pillar-title">Os 12 melhores.</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-soft">
              Você vê o streak, o outcome e o progresso dos seus colegas.
              Ninguém estuda sozinho, mas ninguém perde na multidão.
            </p>
            <div className="landing-cohort-fragment mt-6">
              <Image
                src="/landing/product-me-home.png"
                alt="Ranking da cohort no Academy Fellow"
                width={1440}
                height={1050}
                sizes="(max-width: 1023px) 1200px, 1440px"
                className="landing-cohort-image"
              />
            </div>
          </Reveal>

          <Reveal as="article" delay={100} className="landing-pillar-secondary">
            <h3 className="landing-pillar-title">Aulas de Arquitetura.</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-soft">
              Aprender a pensar em computação. Cada aula abre um sistema real: como foi desenhado,
              onde estão os trade-offs, o que aparece na entrevista.
            </p>
            <div className="mt-6 border-l-2 border-primary pl-5">
              <p className="text-xs font-medium text-primary">Aula 07 · System Design</p>
              <p className="mt-2 text-sm leading-relaxed text-fg-soft">
                &ldquo;Rate limiter distribuído: por que token bucket ganha do leaky bucket quando o tráfego é bursty.&rdquo;
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
