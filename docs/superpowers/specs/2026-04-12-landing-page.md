# Landing Page — ICS Select

**Data:** 2026-04-12
**Escopo:** Landing page publica na raiz `/` que apresenta o programa ICS Select e captura interesse para o proximo ciclo. Usuarios logados continuam sendo redirecionados para `/map` (membro) ou `/admin/cycles` (admin).

---

## 1. Rota e Logica de Redirect

A landing page vive em `app/page.tsx`. A logica atual de redirect para logados continua, mas agora usuarios nao-logados veem a landing page ao inves de serem redirecionados para `/login`.

Fluxo:
- Nao logado → renderiza landing page
- Logado MEMBER → redirect `/map`
- Logado ADMIN → redirect `/admin/cycles`

---

## 2. Secoes da Pagina

### 2.1 Navbar

Navbar fixa transparente com glassmorphism:
- Esquerda: logo `BrandLockup`
- Direita: links ancora para secoes (Programa, Resultados, Processo) + botao CTA "Quero participar" (pill, accent coral)
- Mobile: hamburger menu ou simplificada com so o CTA

### 2.2 Hero (bento grid)

Layout assimetrico estilo ref do video:

- **Esquerda (~55%):**
  - Headline display: "Preparamos voce para as entrevistas que mudam carreiras."
  - Highlight na palavra "mudam carreiras" com background accent-soft ou underline indigo
  - Subtitulo body: "Programa exclusivo do Inteli que prepara os 12 melhores alunos para processos seletivos de Big Techs e consultorias de elite."
  - Dois botoes: "Quero participar" (accent glow, pill) + "Conhecer o programa" (secondary, pill, scroll to next section)

- **Direita (~45%):**
  - Bento grid com 3-4 cards de tamanhos variados:
    - Card stat: "12 Selecionados" com badge-exclusive
    - Card stat: "1 Ciclo" com icone
    - Card preview: mockup/screenshot do mapa de estudo da plataforma (pode ser imagem estatica)
    - Card mini: "Vagas esgotadas" com badge vermelho

### 2.3 Marquee de Empresas

Ticker horizontal infinito (CSS animation) com logos/nomes das empresas-alvo:
- Google, Meta, Amazon, Apple, Microsoft, Netflix, McKinsey, BCG X, QuantumBlack, Bain, Accenture Strategy

Estilo: fundo `surface-muted`, texto grande `h3` com icone/logo ao lado, separado por ponto medio. Scroll continuo, velocidade lenta.

### 2.4 O que e o Programa (features bento grid)

Titulo de secao: "Um programa diferente de tudo que voce ja viu"

Bento grid com cards de features (3 colunas desktop, stack mobile):

| Card | Titulo | Descricao |
|---|---|---|
| Grande (2 cols) | Plano de estudo personalizado | Cada membro recebe um plano semanal montado pelo Diretor Educacional com materiais selecionados |
| Normal | Sessoes ao vivo | Aulas semanais de coding com revisao de conceitos |
| Normal | Integracao Google Calendar | Sessoes de estudo automaticamente agendadas no seu calendario |
| Normal | Progresso gamificado | Mapa de progressao estilo jogo com feedback por modulo |
| Grande (2 cols) | Acompanhamento com IA | Diagnostico individual, sugestoes de estudo e chat contextual |

Cards com padding generoso, border-radius xl, shadow-sm, hover shadow-md.

### 2.5 Stats Animados

3-4 numeros grandes com animacao de contagem (count-up) ao entrar no viewport:

| Stat | Valor | Label |
|---|---|---|
| Membros selecionados | 12 | por ciclo |
| Materiais no acervo | 50+ | videos, problemas, artigos |
| Horas de conteudo | 100+ | de estudo dirigido |
| Taxa de conclusao | 85% | dos planos semanais |

Layout: 4 colunas desktop, 2x2 mobile. Numeros em `display` ou `h1`, labels em `body-sm`. Animacao: numeros contam de 0 ate o valor em ~2s quando a secao entra no viewport (Framer Motion + Intersection Observer).

### 2.6 Depoimentos

Carousel ou grid de cards com depoimentos de ex-membros:

Cada card:
- Aspas grandes (icone quote) em indigo
- Texto do depoimento (body, italico)
- Foto (avatar circular), nome, cargo/descricao atual
- Fundo surface com border sutil

3 cards visiveis desktop, 1 mobile com swipe. Dados vem de um array hardcoded (placeholder ate receber depoimentos reais).

### 2.7 Como Funciona (3 steps)

Titulo: "Como funciona"

3 steps horizontais com timeline:

1. **Inscricao** — Preencha o formulario de interesse e aguarde a abertura do proximo ciclo
2. **Selecao** — Passamos por um processo seletivo tecnico para escolher os 12 participantes
3. **Programa** — Durante o ciclo, voce segue planos de estudo semanais com acompanhamento individual

Cada step: numero grande (indigo), titulo bold, descricao body-sm. Timeline: linha horizontal conectando os 3 steps. Mobile: vertical.

### 2.8 CTA Final + Formulario de Interesse

Secao com fundo gradient indigo (dark) + texto branco:

- Headline: "Vagas esgotadas para o Ciclo 2026.1"
- Subtitulo: "Deixe seu email para ser avisado quando abrirem as inscricoes do proximo ciclo"
- Formulario inline: Input de email + Input de nome + Button "Garantir minha vaga" (accent glow)
- Texto legal pequeno: "Seus dados estao seguros. Sem spam."

Os dados do formulario sao salvos via `POST /interest` (novo endpoint simples) ou podem ir para um Google Form embed.

### 2.9 Footer

Footer simples:
- Logo + "Feito por Davi Duarte"
- Links: Termos de Servico, Politica de Privacidade
- Copyright 2026

---

## 3. Componentes Reutilizaveis

| Componente | Uso |
|---|---|
| `LandingNavbar` | Navbar transparente com links ancora |
| `HeroBento` | Hero section com bento grid |
| `CompanyMarquee` | Ticker infinito de empresas |
| `FeatureBento` | Grid de feature cards |
| `StatsCounter` | Numeros animados com count-up |
| `TestimonialCard` | Card de depoimento |
| `StepsTimeline` | 3 steps com timeline horizontal |
| `InterestForm` | Formulario de captura de email/nome |
| `LandingFooter` | Footer simples |

Todos vivem em `apps/web/components/landing/`.

---

## 4. Animacoes

| Elemento | Animacao |
|---|---|
| Secoes | Fade-in + slide-up ao entrar no viewport (Framer Motion `whileInView`) |
| Stats | Count-up de 0 ao valor final (~2s) |
| Marquee | CSS `translateX` infinito, velocidade ~30px/s |
| Hero cards | Staggered fade-in (0.1s delay entre cards) |
| CTA button | Pulse sutil no glow accent |
| Highlight texto | Background-size animation no load |

---

## 5. Responsividade

| Componente | Desktop | Mobile |
|---|---|---|
| Navbar | Links + CTA | CTA so |
| Hero | Split 55/45 bento | Stack vertical |
| Marquee | Full width | Full width (mesma coisa) |
| Features | 3 cols bento | Stack 1 col |
| Stats | 4 cols | 2x2 grid |
| Depoimentos | 3 cards | 1 card, swipe |
| Steps | Horizontal timeline | Vertical |
| CTA | Inline form | Stacked inputs |

---

## 6. Dados

Todo o conteudo e hardcoded no componente (nao vem da API):
- Empresas: array de strings
- Features: array de objetos `{ title, description, span? }`
- Stats: array `{ value, label }`
- Depoimentos: array `{ quote, name, role, avatarUrl }`
- Steps: array `{ number, title, description }`

Excecao: o formulario de interesse pode fazer POST para a API ou para um servico externo.

---

## 7. Formulario de Interesse — Abordagem

Para simplicidade, o formulario faz POST para um Google Form ou salva num endpoint `POST /interest` no API.

**Recomendacao:** Google Form embed (ou redirect) evita criar endpoint, migration, modelo Prisma so para isso. Caso prefira endpoint proprio, precisaria: model `InterestSubmission { id, name, email, createdAt }`, controller, migration.

---

## 8. SEO

- `<title>`: "ICS Select — Preparacao para Big Techs | Inteli"
- `<meta description>`: "Programa exclusivo que prepara os 12 melhores alunos do Inteli para entrevistas em Google, Meta, Amazon e consultorias de elite."
- Open Graph tags com imagem (pode ser screenshot da landing)
- Semantic HTML: `<header>`, `<main>`, `<section>`, `<footer>`

---

## 9. Fora de escopo

- Blog / conteudo dinamico
- Multi-idioma
- A/B testing
- Analytics (pode ser adicionado depois com Vercel Analytics)
- Formulario de inscricao real (so captura de interesse)
