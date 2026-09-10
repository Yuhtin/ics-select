import Image from 'next/image';
import { Reveal } from './reveal';

export function LandingProduct() {
  return (
    <section className="landing-product landing-section">
      <div className="landing-container">
        <Reveal className="max-w-[900px]">
          <p className="landing-eyebrow">Produto</p>
          <h2 className="landing-heading mt-4">Sua home. O único lugar que você abre de manhã.</h2>
          <p className="mt-5 max-w-[62ch] text-base leading-relaxed text-fg-soft">
            O plano do dia, onde a cohort tá, e o que você deixou pra trás — tudo numa tela. Você
            abre o app de manhã e sabe o próximo passo em 2 segundos.
          </p>
        </Reveal>
        <Reveal delay={80} className="landing-product-image mt-10">
          <Image
            src="/landing/product-me-home.png"
            alt="Academy Fellow: próxima atividade, plano semanal e progresso da cohort"
            width={1440}
            height={1050}
            sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1399px) calc(100vw - 80px), 1280px"
            className="block h-auto w-full"
          />
        </Reveal>
        <Reveal className="mt-10 lg:ml-auto lg:w-4/5">
          <ol className="landing-product-list">
            <Feature num="01" title={'Hero "agora"'}>
              O próximo item da semana, com horário no Calendar e tempo estimado. Você não
              precisa decidir o que estudar agora — o admin já decidiu por você.
            </Feature>
            <Feature num="02" title="Ring do dia">
              3/5 done. Verde = easy, amber = hard, indigo = agora, cinza = pendente. Um olhar,
              uma decisão.
            </Feature>
            <Feature num="03" title="Carried over">
              Item que você não fechou semana passada volta destacado, até bater um outcome.
              Não se esconde num relatório e não vira débito silencioso — fica no topo do plano
              novo até resolver.
            </Feature>
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

function Feature({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <li className="landing-product-point">
      <span aria-hidden className="font-mono text-sm text-primary">{num}</span>
      <h3 className="text-lg font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="text-sm leading-relaxed text-fg-soft">{children}</p>
    </li>
  );
}
