import { Reveal } from './reveal';

type BTech = {
  name: string;
  city: string;
  logo?: string;
  markBg?: string;
  markLabel?: string;
  glow: string;
};

const BTECHS: BTech[] = [
  { name: 'Apple', city: 'Cupertino', logo: '/landing/logos/apple.svg', glow: 'rgba(0,0,0,.06)' },
  { name: 'Google', city: 'Mountain View', logo: '/landing/logos/google.svg', glow: 'rgba(66,133,244,.12)' },
  { name: 'Amazon', city: 'Seattle', logo: '/landing/logos/amazon.svg', glow: 'rgba(255,153,0,.12)' },
  { name: 'Meta', city: 'Menlo Park', logo: '/landing/logos/meta.svg', glow: 'rgba(8,102,255,.14)' },
  { name: 'Netflix', city: 'Los Gatos', logo: '/landing/logos/netflix.svg', glow: 'rgba(229,9,20,.14)' },
  { name: 'BCG X', city: 'Global', markBg: '#1A1A1A', markLabel: 'BCG·X', glow: 'rgba(26,26,26,.08)' },
  { name: 'Brex', city: 'San Francisco', logo: '/landing/logos/brex.png', glow: 'rgba(246,87,56,.12)' },
  { name: 'QuantumBlack', city: 'Londres', logo: '/landing/logos/quantumblack.ico', glow: 'rgba(0,0,0,.08)' },
  { name: 'xAI', city: 'Palo Alto', logo: '/landing/logos/xai.svg', glow: 'rgba(0,0,0,.06)' },
  { name: 'Anthropic', city: 'San Francisco', logo: '/landing/logos/anthropic.svg', glow: 'rgba(196,93,58,.14)' },
  { name: 'OpenAI', city: 'San Francisco', logo: '/landing/logos/openai.svg', glow: 'rgba(16,163,127,.12)' },
  { name: '+ 24 outras', city: 'Globalmente', markBg: '#FF0057', markLabel: '…', glow: 'rgba(255,0,87,.1)' },
];

export function LandingBigTechs() {
  return (
    <section className="block pt-10 md:pt-12 pb-16 md:pb-20 px-5 md:px-8 relative" id="program">
      <Reveal>
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.1em] uppercase text-fg-mute font-medium">
          <span className="w-7 h-px bg-border-strong" />§ 02 · Alvos
        </div>
        <h2
          className="font-serif font-normal mt-3.5 mb-3"
          style={{
            fontSize: 'clamp(30px, 3.6vw, 52px)',
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            maxWidth: '24ch',
          }}
        >
          As empresas que pagam <em className="italic">top-of-market</em> e pedem muito em troca.
        </h2>
        <p className="text-fg-mute max-w-[60ch] text-[15px]">
          Seu plano é feito pras rubricas reais de cada uma. Não um guia genérico. O que{' '}
          <strong className="font-semibold text-fg">Google</strong> pede em system design é diferente do que{' '}
          <strong className="font-semibold text-fg">Netflix</strong> espera em ownership, e do que{' '}
          <strong className="font-semibold text-fg">Meta</strong> pede em problem solving.
        </p>
      </Reveal>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-3.5 mt-8">
        {BTECHS.map((b, i) => (
          <Reveal key={b.name} delay={i * 60}>
            <div
              className="btech-card relative overflow-hidden h-[112px] sm:h-[120px] border border-border-token rounded-[14px] bg-surface flex flex-col items-center justify-center gap-1.5 p-2.5 text-center transition-all duration-[260ms] ease-[cubic-bezier(.16,1,.3,1)] cursor-pointer hover:-translate-y-1 hover:border-fg hover:shadow-[0_14px_30px_rgba(20,24,31,0.1)]"
              style={{ ['--glow' as string]: b.glow } as React.CSSProperties}
            >
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.logo}
                  alt={`${b.name} logo`}
                  width={36}
                  height={36}
                  className="relative z-[1] w-9 h-9 object-contain rounded-[8px]"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  className={`relative z-[1] w-9 h-9 rounded-[10px] grid place-items-center font-bold tracking-[-0.02em] text-white ${
                    (b.markLabel ?? '').length > 2 ? 'text-[10px]' : 'text-lg'
                  }`}
                  style={{ background: b.markBg }}
                >
                  {b.markLabel}
                </div>
              )}
              <div className="relative z-[1] text-[12px] font-medium text-fg leading-tight">{b.name}</div>
              <div className="relative z-[1] font-mono text-[9px] text-fg-mute tracking-[0.06em] uppercase">
                {b.city}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
