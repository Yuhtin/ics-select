# ICS Select × BTG Pactual — Design System da skin BTG

**Contexto:** frontend alternativo do ICS Select apresentado como projeto para o BTG Pactual. Os membros usam `/btg` e o admin usa `/btgadmin`. **Backend, usuários, ciclos, geração de IA e acervo são os mesmos.** Este doc é a **cheat sheet** da skin, com tokens, fontes, regras de cor e a arquitetura de rotas. O racional e as fontes de pesquisa estão em `docs/btg/reports/Identidade visual BTG Pactual.md`.

**Base factual:** tokens lidos do tema público Orquestra v7 do BTG (`orquestracdn.btgpactual.com/themes/v7/btg_styles_lightmode.theme.css`) em 2026-09-29.

**Última atualização:** 2026-09-29.

---

## Princípio: claro, plano e com um único azul de ação

O produto digital do BTG **não é navy**. É uma página cinza-clara com cards brancos, texto preto em opacidade e **um só azul saturado (`#195AB4`) para tudo que é ação**. O navy (`#05132A` / `#0B2859`) é uma **superfície de marca**: aparece no herói da home, na faixa do topo do admin e em blocos de destaque, nunca como fundo da aplicação.

Mantemos a regra do ICS de **cor conquistada**: 80–90% da tela é preto sobre branco/cinza, e a cor só aparece para marcar um sinal que precisa ser notado. O verde e o vermelho de ganho/perda são a "linguagem de mercado" do BTG e servem para os outcomes, não para decoração.

---

## Tokens (CSS vars)

Todos ficam escopados em `[data-skin='btg']`, aplicado no `<html>` (ver Arquitetura).

```css
[data-skin='btg'] {
  /* Marca */
  --btg-logo-navy:      #001E61; /* só wordmark/co-brand, nunca UI */
  --btg-primary:        #195AB4; /* ação: botões, links, foco, seleção */
  --btg-primary-hover:  #3E75C0;
  --btg-primary-press:  #134489;
  --btg-secondary:      #10408D;
  --btg-secondary-hover:#234F96;
  --btg-secondary-press:#0C316B;

  /* Rampa azul (primary-extended 10→100) */
  --btg-blue-10:  #D2E5FF;
  --btg-blue-20:  #B1D2FF;
  --btg-blue-30:  #87BAFF;
  --btg-blue-40:  #6BAAFF;
  --btg-blue-50:  #549CFF;
  --btg-blue-60:  #307AE0;
  --btg-blue-70:  #195AB4; /* = primary */
  --btg-blue-80:  #10408D; /* = secondary */
  --btg-blue-90:  #0B2859;
  --btg-blue-100: #05132A;

  /* Superfícies navy (heróis/banners) */
  --btg-navy-01: #05132A; /* herói da home, topo do admin */
  --btg-navy-02: #0B2859; /* cards dentro de bloco navy */
  --btg-on-navy-high: rgba(255,255,255,0.96);
  --btg-on-navy-mid:  rgba(255,255,255,0.80);
  --btg-on-navy-low:  rgba(255,255,255,0.74);
  --btg-on-navy-rule: rgba(255,255,255,0.16);

  /* Fundo e superfícies */
  --btg-bg:       #F5F5F6; /* página */
  --btg-surface:  #FFFFFF; /* card, input, modal */
  --btg-hover:    #E8E8E8; /* hover neutro */
  --btg-selected: #E6E6E6;

  /* Texto (preto com opacidade, não hex cinza) */
  --btg-text-high:     rgba(0,0,0,0.96);
  --btg-text-mid:      rgba(0,0,0,0.80);
  --btg-text-low:      rgba(0,0,0,0.64);
  --btg-text-disabled: rgba(0,0,0,0.40);

  /* Bordas e foco */
  --btg-rule:  rgba(0,0,0,0.16);
  --btg-focus: #195AB4;

  /* Indicadores (texto de número / outcome) */
  --btg-gain:         #128850;
  --btg-gain-surface: #D0EBDF;
  --btg-loss:         #CE363F;
  --btg-loss-surface: #FCCACC;

  /* Status (banners, toasts, badges) */
  --btg-success: #159E5C;  --btg-success-surface: #DAECE5;
  --btg-error:   #EB3D47;  --btg-error-surface:   #FFDBDD;
  --btg-warning: #F05800;  --btg-warning-surface: #FFE7CC;
  --btg-info:    #1F7DFF;  --btg-info-surface:    #D2E5FF;

  /* Apoio (charts/categorias; valores do Orquestra support-*) */
  --btg-violet: #754CC5;
  --btg-neutral-60: #61686E;
  --btg-neutral-40: #B8BEC4;
}
```

**Regra do navy:** `#001E61` é a cor do logo e **não é token de UI**. Para blocos escuros, use `--btg-navy-01/02`.

---

## Outcomes do ICS em cores BTG

A semântica é a mesma do ICS (`isPositiveOutcome` continua sendo a fonte da verdade). Só trocamos a cor. O formato também se mantém: **dot de 6–10px ou borda esquerda de 3px**, nunca fundo cheio. A única exceção é o badge, que pode usar a `*-surface` correspondente como fundo com texto na cor base.

| `ItemOutcome` | Positivo? | Token | Hex | Racional |
|---|---|---|---|---|
| `DONE_EASY` | sim | `--btg-gain` | `#128850` | "Alta": o verde de indicador positivo do BTG. |
| `DONE_HARD` | sim | `--btg-warning` | `#F05800` | Concluído com esforço. O laranja substitui o âmbar do ICS. |
| `DOUBTS` | sim | `--btg-violet` | `#754CC5` | Feito, mas com dúvida para revisitar. Não usamos azul para não competir com o primário. |
| `STUCK` | **não** | `--btg-loss` | `#CE363F` | "Baixa": o vermelho de indicador negativo. Sinal urgente. |
| `SKIPPED` | sim | `--btg-neutral-60` | `#61686E` | Já sabia. É neutro sólido e aparece acompanhado de ícone `Check` para não parecer pendente. |
| `PENDING` | **não** | `--btg-neutral-40` | `#B8BEC4` | Ainda não. Dot vazado (borda 1.5px). |

### Os acentos do ICS traduzidos

| Papel no ICS | Token ICS | Token BTG | Uso |
|---|---|---|---|
| Momentum / agir agora | `--focus` | `--btg-primary` | Herói `now`, CTA "Começar estudo", streak de 30 dias. |
| Reflexivo / carry-over, racional da IA | `--accent` | `--btg-secondary` | Borda esquerda de 3px e eyebrow em `#10408D`. |
| Urgente | `--outcome-stuck` | `--btg-loss` | Herói `running_late`, banner de travado, alertas urgentes do admin. |
| Atrasado | `--outcome-done-hard` | `--btg-warning` | Linha atrasada com badge "Atrasado". |
| Concluído / em dia | `--outcome-done-easy` | `--btg-gain` | Herói "tudo feito", dots de conclusão. |

A prioridade continua sendo **uma cor por unidade visual**: `loss > warning > primary > secondary > default`.

---

## Tipografia

A **BTG Pactual Sans** é proprietária (foundry Plau) e **não pode ser usada nem hospedada por nós**. O substituto é a **Figtree** (Google Fonts, via `<link>` no layout; nunca `@import` em CSS).

```css
[data-skin='btg'] {
  --btg-font-sans: 'Figtree', Helvetica, Arial, sans-serif;
  --btg-font-mono: 'IBM Plex Mono', ui-monospace, monospace;
}
```

A hierarquia vem do **tamanho**, como no BTG. O peso padrão é 400 e o 600 fica reservado a botões e números de destaque.

| Nível | Tamanho / line-height | Peso | Uso |
|---|---|---|---|
| Display | 32px / 125% | 400 | Herói da home ("Sua semana"), nome do membro no admin. |
| Título | 24px / 125% | 400 | Título de página e de item. |
| Corpo | 16px / 150% | 400 | Texto, títulos de linha de lista. |
| Secundário | 14px / 150% | 400 | Meta, descrições, labels de formulário. |
| Legenda | 12px / 150% | 400 (600 em eyebrow) | Eyebrows, badges, timestamps. |
| Números | IBM Plex Mono, `tabular-nums` | 400/600 | Horas (`19:00`), %, score de engajamento, IDs, minutos. |

**Não use** serifas (Newsreader e Source Serif pertencem à skin editorial do ICS), texto acima de 32px, uppercase em títulos ou peso 700+ em texto corrido.

---

## Geometria

| Item | Valor |
|---|---|
| Espaçamento | múltiplos de 4 (4, 8, 12, 16, 24, 32, 48, 64) |
| Raio de inputs, botões e badges quadrados | **4px** |
| Raio de cards, modais e sheets | **8px** (sheet mobile: `8px 8px 0 0`) |
| Raio de pills, chips e toggles | **999px** |
| Avatar | 50% |
| Elevação | **plana**, sem sombra de card. Separação `--btg-bg` → `--btg-surface` + borda 1px `--btg-rule` |
| Sombra permitida | apenas o modal: `0 3px 18px #39445614, 0 12px 48px #3944563d` |
| Foco | `box-shadow: 0 0 0 2px var(--btg-focus)` em todo elemento interativo (`:focus-visible`) |
| Container membro | `max-width: 936px` |
| Container admin | `max-width: 1416px` (denso; tabelas e grids) |
| Margem lateral mobile | 24px (`calc(100% - 48px)`) |
| Header | **72px** no desktop, 56px no mobile |
| Ícones | `lucide-react`, stroke 1.5 (2 no estado ativo). Nunca emoji |
| Motion | 150ms hover, 200ms modal. Easing `[0.16, 1, 0.3, 1]` |

---

## Padrões de componente

- **Botão primário:** fundo `--btg-primary`, texto branco 96%, raio 4px, altura 48px (32px em linhas densas do admin). Hover `--btg-primary-hover`, pressed `--btg-primary-press`.
- **Botão secundário:** fundo transparente, borda 1px `--btg-primary`, texto `--btg-primary`.
- **Botão terciário/neutro:** fundo `--btg-surface`, hover `--btg-hover`, texto `--btg-text-high`.
- **Disabled:** fundo `rgba(0,0,0,.10)` e texto `--btg-text-disabled`.
- **Card:** `--btg-surface`, borda 1px `--btg-rule`, raio 8px, padding 16/24. O header pode ter divisor de 1px (como o `btg-card` do Orquestra).
- **Herói navy:** bloco `--btg-navy-01`, texto `--btg-on-navy-*`, raio 8px. Use **um por página**, só na home do membro (`/btg`) e no topo do cockpit do ciclo (`/btgadmin`). O CTA dentro do navy é um botão branco com texto `--btg-primary`.
- **Linha de item:** borda esquerda de 3px na cor do outcome ou da plataforma (as cores de plataforma do ICS continuam valendo como stripe), título em Figtree 16px e meta em Plex Mono 12px `--btg-text-low`.
- **Badge:** raio 4px ou pill, fundo `*-surface`, texto na cor base, 12px/600.
- **Toast/banner:** fundo `*-surface`, borda esquerda de 3px na cor de status e ícone lucide.
- **Tabela do admin:** linhas de 48px, divisores de 1px `--btg-rule`, números em Plex Mono alinhados à direita e header 12px `--btg-text-low`.

---

## Voz e copy (pt-BR)

- **pt-BR, tratando por "você"**, inclusive no chrome (diferente da skin ICS, que usa chrome em inglês). Termos técnicos ficam em inglês quando é o uso corrente (LeetCode, system design, feedback).
- **Vocabulário do BTG:** *excelência, meritocracia, longo prazo, dono, autonomia, mão na massa, inconformismo*. Exemplos: "Excelência se constrói todo dia", "Seu progresso no longo prazo", "Você é dono do seu plano".
- **Tom:** confiante e direto, sem gíria e sem hype. Frases curtas.
- **Labels de navegação:** Hoje · Plano · Turma · Agenda · Retro · Ajustes (membro). Ciclo · Membros · Acervo · Planos · Uso de IA (admin).
- **Não usar** ativos de campanha do BTG (**#DêUmBTG**, "A excelência está em você", "Quem espera mais de um Banco...") **sem aprovação** do BTG.
- **Sobre o Inteli**, a formulação é **"fundado por sócios do BTG"**. Nunca "a faculdade do BTG" nem nada que sugira que o Banco é dono do Inteli.
- Ao citar a instituição, capitalize como o BTG faz: "o Banco", "Partners".

## Regra do logo

**Não reproduza os arquivos de logo do BTG** (SVG, PNG, símbolo) nem a fonte BTG Pactual Sans até haver aprovação oficial. Até lá, o co-brand é **só texto**: "ICS Select × BTG Pactual", com "BTG Pactual" em Figtree 400 na cor `--btg-logo-navy` (ou branco 96% sobre navy). Não imite a forma do logo nem use o símbolo circular. Não aplique a marca em nenhum lugar que dê a entender um produto oficial do BTG: o rodapé deve dizer "Projeto do Inteli Consulting Society apresentado ao BTG Pactual".

---

## Arquitetura

### O que é reaproveitado sem mudança

- **Todos os hooks de dados** em `apps/web/lib/queries` (~70 hooks).
- **`apps/web/lib/api/client.ts`**: `apiFetch`, `NEXT_PUBLIC_API_URL`, Bearer token em `localStorage` + cookie `ics_refresh`.
- **`apps/web/lib/auth/auth-context.tsx`**: `useAuth`.
- **API:** nenhuma mudança. A origem é a mesma, então CORS e cookies continuam como estão.

### Rotas

`app/btg/` e `app/btgadmin/` são **segmentos reais, não route groups**, e ficam sob o root layout para manter providers (QueryClient, Auth, HeroUI, next-themes).

| Skin BTG | Equivalente ICS |
|---|---|
| `/btg` | `/me` |
| `/btg/item/[id]` | `/me/item/[id]` |
| `/btg/cohort` | `/me/cohort` |
| `/btg/calendar` | `/me/calendar` |
| `/btg/retro` | `/me/retro` |
| `/btg/settings/*` | `/me/settings/*` |
| `/btg/onboarding` | `/me/onboarding` |
| `/btgadmin` | `/admin/cycle/active` |
| `/btgadmin/cycle/[id]` | `/admin/cycle/[id]` |
| `/btgadmin/members` | `/admin/members` |
| `/btgadmin/member/[id]` | `/admin/member/[id]` |
| `/btgadmin/member/[id]/plan/[planId]` | `/admin/member/[id]/plan/[planId]` |
| `/btgadmin/library` | `/admin/library` |
| `/btgadmin/plans` | `/admin/plans` |
| `/btgadmin/ai-usage` | `/admin/ai-usage` |

### Tokens da skin

As vars ficam em `[data-skin='btg']`. O atributo é aplicado **no `<html>` por um effect client-side** nos layouts `app/btg/layout.tsx` e `app/btgadmin/layout.tsx`, e é removido no cleanup. O motivo é que modais e toasts do HeroUI são renderizados em portal no `document.body`, fora da árvore do segmento, e só herdam as vars se elas estiverem no `<html>`.

### Login e logout

1. A tela de login da skin grava `sessionStorage.setItem('skin', 'btg')` **antes** de redirecionar para `API/auth/google`.
2. `app/auth/callback/page.tsx` (linhas ~17–18, onde hoje faz `router.replace('/')`) passa a ler `sessionStorage.skin`. Se o valor for `'btg'`, roteia por role: ADMIN vai para `/btgadmin` e os demais para `/btg`. Hoje essa decisão por role está em `app/page.tsx:20`.
3. O destino do logout em `lib/auth/auth-context.tsx:48` (`window.location.href = '/login'`) precisa considerar a skin e mandar para o login BTG quando a skin ativa for BTG.

### Shells e links

Os shells são **reescritos para a skin**: `topbar-member`, `bottom-tab-bar`, `topbar-admin` e `onboarding-gate`. Não dá para reusar os atuais porque existem **66 links hardcoded para `/me`, `/admin` e `/login` em 35 arquivos**.

Os componentes folha reusados precisam receber um `basePath` (ou usar um hook `useSkinPath()`) no lugar do prefixo fixo:

`triage-alert-row`, `item-focus`, `day-list`, `calendar-sidebar`, `library-item-card`, `cohort-strip`, `cycle-members-grid`, `engagement-ranking-table`, `cycle-overview-view`, `unscheduled-section`, `timeline-tab`.

### Rodando localmente

```bash
docker compose up -d postgres   # pgvector local em :5432
pnpm dev                        # api + web
# membro: http://localhost:3000/btg · admin: http://localhost:3000/btgadmin
```

**Use apenas o banco local** (`apps/api/.env`). **Nunca** use `apps/api/.env.production` nem aponte comandos para qualquer host que não seja `localhost`.

---

## Anti-patterns

- Usar navy como fundo da aplicação ou mais de um herói navy por página.
- Usar `#001E61` em botão ou link, quando o correto é `--btg-primary`.
- Usar azul como cor de outcome, porque compete com a ação.
- Adicionar sombra em card.
- Usar raio acima de 8px (fora pills).
- Usar peso 700 em texto corrido, serifas ou emoji.
- Hardcodar `/btg` em componente compartilhado em vez de usar `basePath`.
- Usar logo, fonte ou slogan do BTG sem aprovação.

## Na dúvida

Pergunte: **"Isto parece uma tela do app do BTG com o conteúdo do ICS?"** O teste prático é conferir se ela é clara, plana, com um único azul de ação, números em mono e verde ou vermelho só onde há ganho ou perda. Se a resposta for sim, a skin está certa.
