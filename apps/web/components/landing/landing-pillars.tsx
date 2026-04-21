import Image from 'next/image';
import { Reveal } from './reveal';

export function LandingPillars() {
  return (
    <section id="como-funciona" className="block pt-16 md:pt-20 pb-10 md:pb-12 px-5 md:px-8 relative">
      <Reveal>
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.1em] uppercase text-fg-mute font-medium">
          <span className="w-7 h-px bg-border-strong" />§ 01 · Como funciona
        </div>
        <h2
          className="font-serif font-normal mt-3.5 mb-4"
          style={{
            fontSize: 'clamp(36px, 4.6vw, 64px)',
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            maxWidth: '24ch',
          }}
        >
          Três coisas. Nada mais.
        </h2>
        <p className="text-fg-mute max-w-[60ch] text-[17px]">
          Sem gamificação barata, sem &ldquo;jornadas&rdquo; coloridas. Plano semanal individual,
          cohort pequena que te cobra, e aulas de arquitetura que te ensinam a pensar.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] mt-12">
        <Reveal>
          <Pillar num="01" title={<>Plano semanal,<br />feito pra você.</>}
            body="Cada semana um plano individual, feito pro seu objetivo e pro seu nível agora. Nada de trilha genérica. O que você precisa, na ordem que você precisa."
          >
            <div className="flex items-center gap-3.5">
              <div
                className="ring-demo"
                style={{ ['--pct' as string]: 60 } as React.CSSProperties}
              >
                <span className="relative text-xl font-semibold tracking-[-0.02em] tabular-nums">
                  3/5
                </span>
              </div>
              <div>
                <div className="text-xs font-medium text-fg">Today · Wed</div>
                <div className="font-mono text-[10px] text-fg-mute mt-0.5">
                  120 MIN · 2 LEFT
                </div>
              </div>
            </div>
          </Pillar>
        </Reveal>

        <Reveal delay={100}>
          <Pillar num="02" title={<>Os 12<br />melhores.</>}
            body="Você vê o streak, o outcome e o progresso dos seus colegas. Ninguém estuda sozinho, mas ninguém perde na multidão."
          >
            <CRow src="/landing/av-mp.png" name="Mariana" meta="18/18 · 52d" highlight={false} />
            <CRow src="/landing/av-jl.png" name="João" meta="17/18 · 48d" highlight={false} />
            <CRow src="/landing/av-dv.png" name="Davi (você)" meta="14/18 · 47d" highlight />
          </Pillar>
        </Reveal>

        <Reveal delay={200}>
          <Pillar num="03" title={<>Aulas de<br />Arquitetura.</>}
            body="Aprender a pensar em computação. Cada aula abre um sistema real: como foi desenhado, onde estão os trade-offs, o que aparece na entrevista."
          >
            <div className="pl-2.5 border-l-2 border-reflect">
              <div className="font-mono text-[10px] text-reflect uppercase tracking-[0.06em] font-semibold">
                Aula 07 · System Design
              </div>
              <div className="font-serif italic text-sm text-fg-soft mt-1 leading-[1.4]">
                &ldquo;Rate limiter distribuído: por que token bucket ganha do leaky bucket quando o tráfego é bursty.&rdquo;
              </div>
            </div>
          </Pillar>
        </Reveal>
      </div>
    </section>
  );
}

function Pillar({
  num,
  title,
  body,
  children,
}: {
  num: string;
  title: React.ReactNode;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="p-8 rounded-[24px] bg-surface border border-border-token flex flex-col min-h-[420px] relative overflow-hidden transition-[transform,border-color] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:border-fg"
    >
      <div className="font-serif font-normal leading-[0.9] tracking-[-0.04em] text-fg mb-2 text-[96px]">
        {num}
        <span className="text-primary">.</span>
      </div>
      <h3 className="font-serif text-[28px] font-medium tracking-[-0.02em] m-0 mb-3 text-fg">
        {title}
      </h3>
      <p className="text-fg-soft text-[15px] leading-[1.55] m-0 mb-6">{body}</p>
      <div
        className="mt-auto rounded-xl p-3.5 border border-border-token"
        style={{ background: 'hsl(var(--bg-subtle))' }}
      >
        {children}
      </div>
    </div>
  );
}

function CRow({
  src,
  name,
  meta,
  highlight,
}: {
  src: string;
  name: string;
  meta: string;
  highlight: boolean;
}) {
  return (
    <div
      className="grid items-center gap-2.5 py-1.5"
      style={{ gridTemplateColumns: '24px 1fr auto' }}
    >
      <Image
        src={src}
        alt=""
        width={44}
        height={44}
        className="w-[22px] h-[22px] rounded-full"
      />
      <span
        className={`text-xs text-fg ${highlight ? 'font-semibold' : ''}`}
      >
        {name}
      </span>
      <span className="font-mono text-[10px] text-fg-mute">{meta}</span>
    </div>
  );
}
