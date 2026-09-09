import Image from 'next/image';
import { Reveal } from './reveal';

const BTECHS = [
  { name: 'Apple', logo: 'apple.svg' },
  { name: 'Google', logo: 'google.svg' },
  { name: 'Amazon', logo: 'amazon.svg' },
  { name: 'Meta', logo: 'meta.svg' },
  { name: 'Netflix', logo: 'netflix.svg' },
  { name: 'BCG X', logo: 'bcg-x.svg' },
  { name: 'Brex', logo: 'brex.png' },
  { name: 'QuantumBlack', logo: 'quantumblack.ico' },
  { name: 'xAI', logo: 'xai.svg' },
  { name: 'Anthropic', logo: 'anthropic.svg' },
  { name: 'OpenAI', logo: 'openai.svg' },
];

export function LandingBigTechs() {
  return (
    <section id="program" className="landing-container landing-section">
      <Reveal>
        <p className="landing-eyebrow">Alvos</p>
        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <h2 className="landing-heading">
            As empresas que pagam <em className="not-italic text-primary">top-of-market</em> e pedem muito em troca.
          </h2>
          <p className="text-[15px] leading-relaxed text-fg-soft lg:pt-2">
            Seu plano é feito pras rubricas reais de cada uma. Não um guia genérico. O que{' '}
            <strong className="font-semibold text-fg">Google</strong> pede em system design é diferente do que{' '}
            <strong className="font-semibold text-fg">Netflix</strong> espera em ownership, e do que{' '}
            <strong className="font-semibold text-fg">Meta</strong> pede em problem solving.
          </p>
        </div>
        <ul aria-label="Empresas alvo" className="landing-logos mt-10">
          {BTECHS.map((company) => (
            <li key={company.name} className="flex min-h-20 items-center justify-center">
              <Image
                src={`/landing/logos/${company.logo}`}
                alt={company.name}
                width={96}
                height={40}
                sizes="96px"
                unoptimized
                className="h-10 w-24 object-contain"
              />
            </li>
          ))}
          <li className="flex min-h-20 items-center justify-center text-xs font-medium text-fg-mute">
            + 24 outras
          </li>
        </ul>
      </Reveal>
    </section>
  );
}
