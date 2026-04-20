import Image from 'next/image';
import { Reveal } from './reveal';

export function LandingProduct() {
  return (
    <section
      className="block py-20 md:py-24 px-5 md:px-8 relative"
      style={{ background: 'hsl(var(--bg-subtle))', paddingBottom: 80 }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-14 items-center">
        <Reveal>
          <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.1em] uppercase text-fg-mute font-medium">
            <span className="w-7 h-px bg-border-strong" />§ 03 · Produto
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
            Sua home. O único lugar que você abre de manhã.
          </h2>
          <p className="text-fg-mute max-w-[60ch] text-[17px]">
            O plano do dia, a cohort, o streak, e o que está travando. Tudo acima da dobra, sem
            navegar em 12 abas.
          </p>

          <ul className="flex flex-col gap-[22px] mt-8 list-none p-0">
            <Feature
              num="01"
              title={'Hero "agora"'}
              body={
                <>O próximo item. Com o Calendar aberto do lado, é só bater Cmd+↵ e começar.</>
              }
            />
            <Feature
              num="02"
              title="Ring do dia"
              body={
                <>
                  3/5 done. Verde = easy, amber = hard, indigo = agora, cinza = pendente. Um olhar,
                  uma decisão.
                </>
              }
            />
            <Feature
              num="03"
              title="Carried over"
              body={
                <>
                  Terracota só aparece quando há algo voltando. É a cor que diz &ldquo;eu sei que
                  você deixou isso pra trás, não esqueci&rdquo;.
                </>
              }
              last
            />
          </ul>
        </Reveal>

        <Reveal delay={150}>
          <div
            className="relative rounded-2xl overflow-hidden border border-border-token bg-white transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)]"
            style={{
              boxShadow: '0 20px 60px rgba(20,24,31,.12)',
              transform: 'perspective(1400px) rotateY(-4deg) rotateX(2deg)',
            }}
          >
            {/* Chrome */}
            <div
              className="absolute top-0 left-0 right-0 flex gap-1.5 px-4 py-3 z-10"
              style={{
                background: 'hsl(var(--bg-subtle))',
                borderBottom: '1px solid hsl(var(--border))',
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF6057' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FFBD2E' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#27C93F' }} />
            </div>
            <Image
              src="/landing/product-me-home.png"
              alt="ICS Select · /me/home"
              width={2400}
              height={1500}
              sizes="(max-width: 960px) 100vw, 800px"
              className="w-full block"
              style={{ marginTop: 36 }}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Feature({
  num,
  title,
  body,
  last,
}: {
  num: string;
  title: React.ReactNode;
  body: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li
      className={`grid gap-[18px] items-start py-3.5 ${
        last ? '' : 'border-b border-border-token'
      }`}
      style={{ gridTemplateColumns: '40px 1fr' }}
    >
      <span className="font-mono text-[13px] text-fg-mute font-medium pt-0.5">{num}</span>
      <div>
        <h4 className="text-[17px] font-semibold m-0 mb-1 tracking-[-0.01em] text-fg">{title}</h4>
        <p className="text-fg-mute text-[14px] m-0 leading-[1.5]">{body}</p>
      </div>
    </li>
  );
}
