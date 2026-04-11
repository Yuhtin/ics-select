# Design system e telas — ICS Select

**Data:** 2026-04-11
**Escopo:** Primeira passada de design intencional no `apps/web`. Define tokens, tipografia, shell de navegação e componentes "assinatura", aplica nas 4 telas mockadas no Stitch, e propaga automaticamente para as ~11 páginas restantes via re-tematização do HeroUI.

## Contexto

O frontend hoje (`apps/web`) roda com HeroUI + Tailwind nos defaults, sem tokens customizados, sem fonte de marca, sem logo, com topbar único (`components/nav/app-nav.tsx`) e conteúdo direto em `p-6`. Funcional, mas sem identidade visual.

Existem 4 mocks dark-mode no Stitch (Login mobile, Login desktop, Admin dashboard, Plano de estudo semanal) que estabelecem estilo Material Design 3 com Inter, azul `#18a0fb` como marca, surface containers empilhados em tons de navy, sidebar + topbar. Essas mocks são a **referência de layout e identidade visual**, mas:

1. **O app vai ser light-first nesta rodada** (dark mode fica pra uma fase futura com mocks dedicadas).
2. **HeroUI fica** como base de controles (Button, Input, Select, Table, Modal, etc) por meio de re-tematização, porque reescrever 15 componentes não cabe no escopo.
3. **A estrutura de navegação troca** de topbar-only para sidebar canônica + topbar fino (inspirado em Vercel/Linear/Notion, não uma tradução fiel da mock).
4. **A personalidade visual** combina estrutura "plataforma profissional" (Vercel-like: espaçamento arejado, tipografia clean, shadows discretas) com expressão de marca confiante (azul ICS `#18a0fb` como protagonista em logo, CTAs de IA, acentos, stat cards).

As mocks continuam servindo como guia para as telas-vitrine (Login, Dashboard admin, Plano semanal). As outras páginas herdam a identidade por remap de tema — sem redesign de layout.

## Decisões de design

### 1. Escopo e estratégia de propagação

**Sistema de design completo aplicado em 4 telas como vitrine, e propagado por herança de tokens para todas as outras páginas existentes.** Nenhuma página "fica pra trás visualmente", mas só as 4 mocks recebem layout novo; o resto herda cores, tipografia, radius, shadows e comportamento de componentes automaticamente ao trocar o tema do HeroUI e o `tailwind.config.ts`.

### 2. Framework

**Híbrido.** HeroUI re-tematizado cobre controles (Button, Input, Select, Textarea, Table, Modal, Chip, Progress, Avatar, Slider, Card, useDisclosure). Tailwind puro cobre layout e componentes de assinatura (shell, sidebar, topbar, stat cards, member cards, library rows, login card, AI assistant card).

Rejeitado: (a) sair do HeroUI e reescrever 15 componentes — custo alto, nega o "inherit por remap"; (b) usar só HeroUI — trava os signature components que precisam de detalhes custom fora do framework.

### 3. Navegação

**Sidebar canônica como nav primária + topbar fino.** Admin e member usam a mesma estrutura. Admin tem 5 itens (Dashboard, Ciclos, Membros, Acervo, Uso de IA). Member tem 2 (Meu plano, Disponibilidade). Topbar contém só search placeholder, bell placeholder e avatar dropdown à direita — o lado esquerdo é visualmente coberto pela sidebar fixa.

Rejeitado: topbar+sidebar simultâneos (redundância do mockup, pouco idiomático em SaaS light); topbar-only (perde o "feel" das mocks).

### 4. Tema

**Light-first único.** `next-themes` permanece instalado, mas `providers.tsx` usa `forcedTheme="light"`. Dark mode volta numa rodada futura com mocks dark dedicadas. Custo zero pra reativar (só trocar `forcedTheme` por `defaultTheme` e adicionar o bloco `.dark` no `globals.css` + tema HeroUI dark).

### 5. Personalidade visual

**Estrutura Vercel/Stripe (arejado, denso-porém-respirado, body 15px, shadows leves) + expressão ICS (azul `#18a0fb` protagonista em logo, CTAs de IA, stat cards, chips, borders em hover).** O azul de marca aparece em superfície grande **apenas** no `AiAssistantCard` (gradient + shadow-brand) — todo o resto usa brand como acento. Essa economia intencional evita virar "arco-íris SaaS".

## Fundações (tokens)

### Paleta

Derivada das cores M3 light counterparts do palette Stitch, com `#18a0fb` mantido como protagonista (em vez do mais conservador `#00629e`).

```
Neutros:
background            #fbfbfe   canvas principal (branco levemente azulado)
surface               #ffffff   cards default
surface-muted         #f5f6f8   sidebar bg, seções secundárias
surface-subtle        #f0f1f4   hover state, área inset
border                #e5e7eb   divisores e bordas de card
border-strong         #d1d5db   bordas hover/focus
foreground            #0f172a   texto principal
foreground-muted      #475569   texto secundário, labels
foreground-subtle     #94a3b8   texto terciário, placeholders

Marca:
brand                 #18a0fb   azul ICS protagonista
brand-hover           #0c8ce9   botões pressed/hover
brand-soft            #e0f2fe   tints de background (CTA cards, chips)
brand-soft-foreground #0c4a6e   texto sobre brand-soft (ratio AAA)
brand-ring            #18a0fb33 focus ring com alpha

Semânticos:
success               #10b981 / success-soft #d1fae5
warning               #f59e0b / warning-soft #fef3c7
danger                #ef4444 / danger-soft  #fee2e2
info                  #3b82f6 / info-soft    #dbeafe
```

**Regra de contraste:** `#18a0fb` não passa WCAG AA como cor de texto sobre branco (ratio 3.4:1). É usado somente em backgrounds, borders e ícones grandes (≥24px). Quando precisar de "texto cor de marca", usar `brand-soft-foreground` (`#0c4a6e`, ratio 10.2:1 AAA).

### Tipografia

- **Fonte:** Inter via `next/font/google`, pesos 400/500/600/700/800, `display: 'swap'`, variable `--font-inter`.
- **Fallback:** `ui-sans-serif, system-ui, sans-serif`.
- **Escala (base 15px):**
  ```
  text-xs     11px   labels uppercase, metadata
  text-sm     13px   nav items, small UI
  text-base   15px   body default
  text-lg     17px   subtítulos
  text-xl     20px   títulos de seção
  text-2xl    24px   títulos de página
  text-3xl    30px   heros
  text-4xl    36px   landing/login
  ```
- **Letter-spacing:** `tracking-tight` em títulos ≥ `text-xl`; `tracking-wider uppercase` em labels pequenos (`text-xs` caps).
- **Line-height:** body `leading-relaxed` (1.625); títulos `leading-tight` (1.15).

### Espaçamento, radius, shadows

- **Densidade:** `gap-6` em grids de card, `p-6` em cards, `py-2.5 px-4` em botões default, `h-9` (36px) em inputs.
- **Radius:** `rounded-md` (6px) inputs pequenos e chips; `rounded-lg` (8px) cards e botões; `rounded-xl` (12px) hero cards e signature panels; `rounded-full` chips e avatars.
- **Shadows:**
  ```
  shadow-xs     0 1px 2px   rgb(15 23 42 / 0.04)   cards default
  shadow-sm     0 2px 4px   rgb(15 23 42 / 0.06)   cards elevados, hover
  shadow-md     0 4px 12px  rgb(15 23 42 / 0.08)   modals, dropdowns, login card
  shadow-brand  0 8px 24px  rgb(24 160 251 / 0.25) apenas AiAssistantCard
  ```

## Re-tematização do HeroUI

### CSS vars em `globals.css`

Todos os tokens viram CSS vars no `:root` em formato **HSL triplet sem wrapper** (padrão shadcn), para permitir `bg-background/50` com alpha modifier do Tailwind. Exemplo:

```css
:root {
  --background: 220 29% 99%;        /* #fbfbfe */
  --foreground: 222 47% 11%;        /* #0f172a */
  --surface: 0 0% 100%;
  --surface-muted: 220 14% 97%;
  --surface-subtle: 220 14% 95%;
  --border: 220 13% 91%;
  --border-strong: 220 13% 83%;
  --foreground-muted: 215 25% 32%;
  --foreground-subtle: 215 20% 65%;
  --brand: 202 96% 54%;
  --brand-hover: 203 89% 48%;
  --brand-soft: 204 94% 94%;
  --brand-soft-foreground: 202 80% 24%;
  --success: 160 84% 39%;
  --success-soft: 152 76% 90%;
  --warning: 38 92% 50%;
  --warning-soft: 48 96% 89%;
  --danger: 0 84% 60%;
  --danger-soft: 0 93% 94%;
  --info: 217 91% 60%;
  --info-soft: 214 95% 92%;
}

html, body {
  @apply font-sans bg-background text-foreground antialiased;
}
```

### `tailwind.config.ts`

Mapeia as CSS vars em `theme.extend.colors` (com `<alpha-value>`) e passa paleta HeroUI equivalente no plugin `heroui()`. Estrutura:

```ts
import { heroui } from '@heroui/react';

export default {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          muted: 'hsl(var(--surface-muted) / <alpha-value>)',
          subtle: 'hsl(var(--surface-subtle) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--border) / <alpha-value>)',
          strong: 'hsl(var(--border-strong) / <alpha-value>)',
        },
        'foreground-muted': 'hsl(var(--foreground-muted) / <alpha-value>)',
        'foreground-subtle': 'hsl(var(--foreground-subtle) / <alpha-value>)',
        brand: {
          DEFAULT: 'hsl(var(--brand) / <alpha-value>)',
          hover: 'hsl(var(--brand-hover) / <alpha-value>)',
          soft: 'hsl(var(--brand-soft) / <alpha-value>)',
          'soft-foreground': 'hsl(var(--brand-soft-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          soft: 'hsl(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          soft: 'hsl(var(--warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
          soft: 'hsl(var(--danger-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          soft: 'hsl(var(--info-soft) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        sm: '0 2px 4px -1px rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)',
        md: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
        brand: '0 8px 24px -4px rgb(24 160 251 / 0.25), 0 4px 8px -2px rgb(24 160 251 / 0.15)',
      },
      // Observação: não sobrescrever `borderRadius` aqui. Os defaults do Tailwind
      // (rounded-md=6px, rounded-lg=8px, rounded-xl=12px) batem com as regras
      // do spec. HeroUI consome os hex diretamente no layout.radius abaixo.
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: '#fbfbfe',
            foreground: '#0f172a',
            divider: '#e5e7eb',
            focus: '#18a0fb',
            content1: '#ffffff',
            content2: '#f5f6f8',
            content3: '#f0f1f4',
            content4: '#e5e7eb',
            default: {
              50: '#fbfbfe', 100: '#f5f6f8', 200: '#e5e7eb', 300: '#d1d5db',
              400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
              800: '#1e293b', 900: '#0f172a',
              DEFAULT: '#e5e7eb', foreground: '#0f172a',
            },
            primary: {
              50: '#e0f2fe', 100: '#bae6fd', 200: '#7dd3fc', 300: '#38bdf8',
              400: '#18a0fb', 500: '#0c8ce9', 600: '#0369a1', 700: '#075985',
              800: '#0c4a6e', 900: '#082f49',
              DEFAULT: '#18a0fb', foreground: '#ffffff',
            },
            success: { DEFAULT: '#10b981', foreground: '#ffffff' },
            warning: { DEFAULT: '#f59e0b', foreground: '#0f172a' },
            danger:  { DEFAULT: '#ef4444', foreground: '#ffffff' },
          },
          layout: {
            radius: { small: '0.375rem', medium: '0.5rem', large: '0.75rem' },
            fontSize: { small: '0.8125rem', medium: '0.9375rem', large: '1.0625rem' },
          },
        },
      },
    }),
  ],
};
```

### Font loading

`apps/web/app/layout.tsx`:

```ts
import { Inter } from 'next/font/google';
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
// <html className={inter.variable}>
```

### Forced light

`apps/web/app/providers.tsx`:

```tsx
<NextThemesProvider attribute="class" forcedTheme="light">
```

### Tokens compartilhados (preparação futura)

`packages/shared/src/design/tokens.ts` exporta os mesmos hex em objetos TypeScript. Não é consumido nesta rodada — existe para habilitar emails futuros, componentes de whatsapp templates, etc.

## Shell layout

### Estrutura

```
┌─────────────────────────────────────────────┐
│  topbar  h-14  (56px)                       │  fixed/sticky top
├──────┬──────────────────────────────────────┤
│      │                                      │
│ side │                                      │
│ bar  │       main (ml-60 pt-14)             │
│ w-60 │       container max-w-7xl px-8 py-8  │
│      │                                      │
└──────┴──────────────────────────────────────┘
```

### Sidebar `w-60` (240px)

- `fixed left-0 top-0 h-screen w-60 border-r border-border bg-surface-muted`
- Conteúdo vertical:
  1. **Brand lockup** (px-5, h-14): "IS" logomark 32px (`bg-brand text-white font-black rounded-lg shadow-sm`) + "ICS Select" wordmark (`text-base font-bold tracking-tight`). Essa linha visualmente substitui o left slot do topbar.
  2. Divider `border-t border-border`.
  3. Nav primária (px-3 py-4, `flex flex-col gap-1`):
     - Idle item: `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-subtle transition-colors`
     - Ícone lucide 20px à esquerda, label, chip opcional à direita.
     - Active: `bg-brand-soft text-brand-soft-foreground` + ícone `text-brand`.
  4. Spacer `flex-1`.
  5. Footer: avatar + nome + email (`text-xs`) em linha única. Clicável, abre menu com logout.
- **Itens por role:**
  - ADMIN: Dashboard, Ciclos, Membros, Acervo, Uso de IA
  - MEMBER: Meu plano, Disponibilidade

### Topbar `h-14` (56px)

- `sticky top-0 z-40 h-14 bg-background/80 backdrop-blur-md border-b border-border`
- Left slot vazio (sidebar cobre a área visualmente).
- Right slot: `Search` placeholder (Cmd+K — decorativo), `Bell` (decorativo), `Avatar dropdown` (redundante com sidebar, por esperado UX).

### Breakpoints

- **`lg` (≥1024px):** layout full — sidebar expandida + topbar + main (`ml-60 pt-14`).
- **`md` (≥768px, <1024px):** sidebar colapsa para `w-14` (só ícones, tooltip on hover).
- **`<md`:** sidebar vira drawer off-canvas, topbar ganha `Menu` icon à esquerda.

### Main

- Wrapper: `main class="ml-60 pt-14 min-h-screen"` (desktop), ajustes em `md` e mobile.
- Container interno de cada page: `<div class="mx-auto max-w-7xl px-8 py-8">`. Pages densas de tabela podem ampliar pra `max-w-[90rem]`.

## Componentes "assinatura"

Ficam em `apps/web/components/ui/` (componentes visuais de página) e `apps/web/components/shell/` (estrutura de navegação).

### `BrandLockup` (`components/shell/brand-lockup.tsx`)

"IS" logomark em quadrado azul + wordmark "ICS Select". Props: `size="sm" | "md" | "lg" | "xl"`.
- sm (sidebar): mark 28px, wordmark `text-sm font-bold`
- md (default): mark 32px, wordmark `text-base font-bold`
- lg (login desktop): mark 48px, wordmark `text-2xl font-bold`
- xl (login mobile): mark 56px, wordmark `text-3xl font-bold`

Mark: `rounded-lg bg-brand text-white flex items-center justify-center font-black tracking-tighter shadow-sm`. Texto interno fixo "IS".

### `PageHeader` (`components/shell/page-header.tsx`)

Cabeçalho padrão de cada page. Props: `eyebrow?`, `title`, `description?`, `actions?`.

Layout:
```
EYEBROW UPPERCASE              [actions à direita]
Title em text-3xl font-bold
Description em text-sm muted
```

- Eyebrow: `text-xs font-semibold uppercase tracking-wider text-brand`
- Title: `text-3xl font-bold tracking-tight text-foreground mt-1`
- Description: `text-sm text-foreground-muted mt-2`
- Actions slot: `flex items-center gap-2` alinhado com title

### `StatCard` (`components/ui/stat-card.tsx`)

Card de métrica do dashboard admin. Props: `icon`, `label`, `value`, `trend?`, `variant?: "default" | "hero"`.

- Default: `rounded-xl border border-border bg-surface p-6 shadow-xs`
- Label: `text-xs uppercase tracking-wider text-foreground-muted`
- Valor: `text-3xl font-bold text-foreground tracking-tight mt-2`
- Icon container: `h-9 w-9 rounded-lg bg-brand-soft text-brand` (lucide 18px)
- Trend chip: `inline-flex items-center gap-1 text-xs font-medium text-success` (ou danger)
- Hero variant: `bg-gradient-to-br from-brand to-brand-hover text-white shadow-brand` — usado no `AiAssistantCard` via composição, não direto.

### `MemberCard` (`components/ui/member-card.tsx`)

Card da grid de membros do dashboard admin. Props: `member`, `progress`, `onViewPlan`, `onMessage`.

- Container: `rounded-xl border border-border bg-surface p-5 shadow-xs hover:shadow-sm hover:border-border-strong transition-all`
- Header: avatar 40px + nome/email (`flex items-center gap-3`)
- Divider: `border-t border-border my-4`
- Progress: label "Plano atual: Semana X" (`text-xs text-foreground-muted`), barra `h-1.5 rounded-full bg-surface-subtle` com fill `bg-brand`
- Actions: `flex gap-2 mt-4` com dois botões HeroUI secundários pequenos

### `LibraryItemRow` (`components/ui/library-item-row.tsx`)

Linha de item no plano semanal. Props: `item`, `status`, `onClick`.

- Linha: `rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted transition-colors flex items-center gap-4`
- Icon quadrado 40px: `rounded-lg bg-brand-soft text-brand` com lucide (tipo da questão)
- Bloco de texto: título `text-base font-semibold`; metadata row `text-xs text-foreground-muted` com chips separados por `·` (fonte, tempo estimado, tags)
- `StatusChip` à direita
- Botão "Ver detalhes" ghost à direita

### `StatusChip` (`components/ui/status-chip.tsx`)

Inline chip usado para estado de item. Estados: `pending`, `in_progress`, `done_easy`, `done_hard`, `stuck`.

```
pending       bg-surface-subtle  text-foreground-muted
in_progress   bg-info-soft       text-info
done_easy     bg-success-soft    text-success
done_hard     bg-warning-soft    text-warning
stuck         bg-danger-soft     text-danger
```

Formato: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium`.

### `AiAssistantCard` (`components/ui/ai-assistant-card.tsx`)

O CTA brand gradient do plano semanal. É o **único lugar** no app onde a cor de marca aparece em superfície grande.

- Container: `rounded-xl p-6 bg-gradient-to-br from-brand to-brand-hover text-white shadow-brand relative overflow-hidden`
- Decoração: pseudo-element `::before` com `h-32 w-32 rounded-full bg-white/10 blur-2xl absolute -top-10 -right-10`
- Eyebrow com ícone `Sparkles` lucide: `text-xs font-medium opacity-80 flex items-center gap-1.5`
- Título: `text-lg font-bold mt-3`
- Descrição: `text-sm opacity-90 mt-2 leading-relaxed`
- Botão interno: `bg-white text-brand rounded-md px-4 py-2 text-sm font-semibold hover:bg-white/90 mt-4 inline-flex items-center gap-2`
- Props: `title`, `description`, `ctaLabel`, `onCtaClick`

### `DataTable` (`components/ui/data-table.tsx`)

Wrapper que envolve `Table` do HeroUI com container `rounded-xl border border-border bg-surface shadow-xs overflow-hidden` e um header slot opcional (título, filtros, actions). A Table interna fica intacta — só o frame externo muda. Aplicado em `/admin/cycles` e `/admin/library`.

### Shell components

- `app-shell.tsx` — wrapper que monta sidebar + topbar + main. Recebe `children`.
- `sidebar.tsx` — self-contained, lê `useSession` (ou `useCurrentUser`) para montar itens por role.
- `sidebar-item.tsx` — primitive de linha de nav.
- `topbar.tsx` — barra superior fina.

## Layouts das 4 telas mock

### `/login` — Login Desktop

- Container pai: `min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden`
- Background decoration (sutilíssimo, light mode não suporta blobs fortes): dois divs absolute
  - `top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-brand/8 blur-3xl`
  - `bottom-[-10%] right-[-10%] h-[30%] w-[30%] rounded-full bg-brand/5 blur-3xl`
- Card: `relative z-10 w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-md`
- Conteúdo do card:
  - `BrandLockup size="lg"` centralizado
  - `h1 text-2xl font-bold tracking-tight text-foreground mt-6 text-center`: "Bem-vindo ao ICS Select"
  - `p text-sm text-foreground-muted leading-relaxed mt-2 text-center`: "Acesse a plataforma de preparação técnica para consultoria."
  - Spacer `mt-8`
  - Botão Google: `<Button color="default" variant="bordered" size="lg" fullWidth startContent={<GoogleIcon/>} onClick={handleLogin}>Entrar com Google</Button>` com classes `border-border hover:border-brand/50 hover:bg-brand-soft/30`
  - Divider "SEGURANÇA": `flex items-center gap-4 py-4` com linhas `h-[1px] flex-grow bg-border` e label `text-[10px] uppercase tracking-widest font-bold text-foreground-subtle`
  - Domain hint: `flex items-center gap-3 p-4 rounded-lg bg-brand-soft/40 border border-brand/10` — ícone `Building2` lucide `text-brand`, texto "Use seu e-mail institucional @inteli.edu.br para autenticação automática." com `@inteli.edu.br` em `text-brand font-medium`
  - Footer: `border-t border-border mt-8 pt-6 text-center` com link "Problemas com o acesso? Fale com o suporte"
- Badges decorativas abaixo do card: "SSO ATIVO · DATA CRIPTOGRAFADO" em `text-xs text-foreground-subtle opacity-60`

### `/login` — Login Mobile

Mesma página, responsivo via breakpoints — **não é uma rota separada**:
- `<sm`: card ocupa `w-full` sem `max-w-md`, `p-6` em vez de `p-8`
- `BrandLockup size="xl"` fora do card (acima dele, centralizado), seguindo o padrão do mockup mobile
- Card contém heading, descrição, botão Google, hint institucional, footer
- Rodapé com links "Suporte · Documentação" separados por dot

### `/admin/dashboard`

- `<PageHeader eyebrow="CICLO ATUAL" title="Cycle 04 Summary" description="Fundamentos de Algoritmos · Semana 04" actions={...}>` com actions `[<Button variant="bordered">Relatório</Button>, <Button color="primary" startContent={<Plus/>}>Novo ciclo</Button>]`
- 4 `StatCard`s em `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8`:
  - Taxa de Progresso — valor numérico
  - Velocidade Média — percentual
  - Itens Travados — count
  - Semanas de Foco — count
- Section heading "Membros do ciclo": `text-lg font-semibold mt-10 mb-4`
- Grid de `MemberCard`s: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Dados alimentados pelos endpoints existentes (`/admin-dashboard/*`) — backend não muda.

### `/me` — Plano semanal

- Container interno: `grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8`
- **Coluna principal:**
  - `<PageHeader eyebrow="SEMANA 04" title="Fundamentos de Algoritmos" description="8 a 14 de abril">`
  - Progress bar semanal: `flex justify-between text-xs text-foreground-muted mb-2` com label + "X de Y · Z%"; barra `h-2 rounded-full bg-surface-subtle` com fill `bg-brand`
  - Lista `flex flex-col gap-3 mt-8` de `LibraryItemRow`s (dados reais do endpoint `/me`)
- **Aside (coluna direita):**
  - `<AiAssistantCard title="Otimize seu plano" description="Sugestões baseadas no seu histórico e dificuldades" ctaLabel="Gerar sugestões" onCtaClick={...}>` — chama o chat existente em `components/ai/context-chat.tsx`
  - Section "Atividade Recente": `text-xs uppercase tracking-wider text-foreground-muted mb-3` + lista de 3-5 eventos **mock hardcoded** (escopo deferido pra quando o backend expuser feed real)
- `ContextChat` floating bubble existente é mantido — herda o novo tema automaticamente. Eventuais ajustes manuais de estilo ficam como followup.

## Propagação para telas não-mockadas

As páginas abaixo **não** recebem redesign de layout. Herdam cores, tipografia, radius e shadows automaticamente via remap do `tailwind.config.ts` e `heroui()`:

- `/privacy`
- `/me/availability`
- `/me/plan/[planId]/item/[itemId]`
- `/admin/cycles/[id]`
- `/admin/cycles/[id]/classes`
- `/admin/library/new`, `/admin/library/[id]`
- `/admin/members`, `/admin/members/[id]`
- `/admin/ai-usage`

**Exceção com wrapper:** `/admin/cycles` (lista) e `/admin/library` (lista) recebem o wrapper `DataTable` — substituição de um único componente externo, sem tocar no conteúdo da table.

## Arquivos

### Criados

```
apps/web/components/shell/
  app-shell.tsx
  sidebar.tsx
  sidebar-item.tsx
  topbar.tsx
  brand-lockup.tsx
  page-header.tsx

apps/web/components/ui/
  stat-card.tsx
  member-card.tsx
  library-item-row.tsx
  status-chip.tsx
  ai-assistant-card.tsx
  data-table.tsx

packages/shared/src/design/
  tokens.ts
  index.ts
```

### Editados

```
apps/web/app/layout.tsx              adiciona next/font Inter
apps/web/app/globals.css              CSS vars + base styles
apps/web/tailwind.config.ts           colors, font, shadows, heroui theme
apps/web/app/providers.tsx            forcedTheme="light"
apps/web/app/(app)/layout.tsx         <AppNav/> → <AppShell>
apps/web/app/login/page.tsx           login rewrite com LoginCard + BrandLockup
apps/web/app/admin/dashboard/page.tsx rewrite com signature components
apps/web/app/me/page.tsx              rewrite 2-col com LibraryItemRow + aside
apps/web/app/admin/cycles/page.tsx    wrap com DataTable
apps/web/app/admin/library/page.tsx   wrap com DataTable
packages/shared/src/index.ts          re-export design/tokens
```

### Deletados

```
apps/web/components/nav/app-nav.tsx   substituído pelo AppShell
```

## Ordem de implementação

1. **Tokens + Tailwind + font.** Nenhuma mudança visual ainda — Tailwind só passa a conhecer as cores novas. Typecheck + build passam.
2. **HeroUI re-theme.** Todas as páginas existentes mudam de visual simultaneamente. `<Button color="primary">` fica azul ICS.
3. **Signature components.** Criados em isolamento, ainda não usados.
4. **Shell novo.** `AppShell`, `Sidebar`, `Topbar`, `SidebarItem` criados em isolamento.
5. **Swap do shell.** `apps/web/app/(app)/layout.tsx` troca `<AppNav />` por `<AppShell>`. Deleta `components/nav/app-nav.tsx`. Todas as páginas autenticadas ganham sidebar.
6. **Login rewrite.**
7. **Dashboard admin rewrite.**
8. **`/me` rewrite.**
9. **`DataTable` aplicado em `/admin/cycles` e `/admin/library`.**
10. **Smoke test manual das páginas herdadas.** Abrir uma a uma e corrigir problemas pontuais (Card com padding errado, texto hardcoded cinza escuro, etc).

## Testes e verificação

- **`pnpm --filter @ics-select/web build`** — typecheck + build estático. Qualquer erro de token não mapeado aparece aqui.
- **`pnpm --filter @ics-select/web test`** — Playwright tem `tests/auth-flow.spec.ts` existente. Precisa continuar passando após o login rewrite. **Nenhum snapshot visual novo** é adicionado (o snapshot flakey foi removido no commit `3960b27`; não reintroduzir).
- **Smoke manual:** `pnpm dev` + visitar as 4 mocks + ao menos 5 das 11 páginas herdadas pra conferir re-theme.

## Escopo deferido

Fora desta rodada, explicitamente:

- **Dark mode.** Infraestrutura pronta (next-themes instalado, só `forcedTheme="light"` bloqueando). Volta com mocks dark dedicadas.
- **Animações / motion.** Nada além das transições `hover:` básicas. Sem framer-motion, sem page transitions.
- **Cmd+K search** na topbar. Placeholder visual apenas.
- **Notificações na topbar.** Bell decorativo sem dropdown/menu.
- **Feed "Atividade Recente" com dados reais** na aside de `/me`. Placeholder mock.
- **Email templates** usando os tokens compartilhados. `packages/shared/src/design/tokens.ts` existe só pra preparar o terreno.
- **Acessibilidade nível AAA.** Foco em AA via defaults do HeroUI + contraste dos tokens.
- **Refinamentos visuais no `ContextChat`.** Componente herda o re-theme; ajustes finos ficam como followup.

## Riscos

1. **Pontos cegos do re-theme HeroUI.** Componentes que fazem assunções sobre cor que não respeitam o override (ex: `<Progress classNames={{...}}>` com cor hardcoded). Mitigação: passo 10 do build order revisita cada página herdada e corrige pontuais.
2. **Alpha modifier com HSL vars.** `bg-brand/50` depende da sintaxe `hsl(var(--brand) / <alpha-value>)` que precisa do Tailwind v3+. O projeto usa Tailwind 3 (ver CLAUDE.md) — compatível. Testar no primeiro componente com alpha (`AiAssistantCard`).
3. **`ContextChat` (chat SSE)** em `components/ai/context-chat.tsx`. Usa fetch direto pra streaming, não HeroUI. Pode ter estilos inline que precisam ajuste. Item explícito no plano de implementação.
4. **Route group `(app)` sem `page.tsx`.** CLAUDE.md avisa que não deve existir `app/(app)/page.tsx`. Confirmar que o shell novo não cria.
5. **Next/font na build Vercel.** Inter baixa no build. ~50ms a mais na primeira build, irrelevante.
