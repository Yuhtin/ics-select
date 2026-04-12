# ICS Select Design System

**Data:** 2026-04-12
**Escopo:** Design system unificado para o ICS Select. Define tipografia, paleta, componentes base, e principios visuais que se aplicam a todas as telas (admin, membro, landing page).

---

## 1. Tipografia

### Font stack

- **Headings:** Satoshi (Variable, 700-900 weight) — geometric, tech, premium
- **Body:** Satoshi (Variable, 400-500 weight) — mesma familia para coesao
- **Mono/code:** JetBrains Mono — para badges numericos, stats, timers

Satoshi e uma font premium gratuita (via Fontshare) com pesos variados e suporte completo a caracteres. Alternativa se Satoshi nao funcionar: General Sans.

### Escala tipografica

| Token | Size | Weight | Uso |
|---|---|---|---|
| `display` | 48px / 3rem | 800 | Hero headlines (landing page) |
| `h1` | 32px / 2rem | 700 | Titulos de pagina |
| `h2` | 24px / 1.5rem | 700 | Titulos de secao |
| `h3` | 18px / 1.125rem | 600 | Subtitulos, card headers |
| `body` | 15px / 0.9375rem | 400 | Texto padrao |
| `body-sm` | 13px / 0.8125rem | 400 | Texto secundario, labels |
| `caption` | 11px / 0.6875rem | 500 | Badges, chips, meta info |
| `mono` | 14px / 0.875rem | 500 | Stats, numeros, contadores |

### Letter spacing

- Headings: `-0.02em` (apertado, moderno)
- Body: `0` (default)
- Captions/badges uppercase: `0.05em` (tracking aberto)

---

## 2. Paleta de Cores

### Primary — Azul moderno

Nao o azul corporativo original (#005ab4). Um azul mais vibrante e moderno.

| Token | Valor | Uso |
|---|---|---|
| `primary-50` | `#EEF2FF` | Backgrounds sutis |
| `primary-100` | `#E0E7FF` | Hover states |
| `primary-500` | `#4F46E5` | Indigo — primary accent |
| `primary-600` | `#4338CA` | Hover do primary |
| `primary-700` | `#3730A3` | Active/pressed |
| `primary-900` | `#1E1B4B` | Texto sobre backgrounds claros |

### Accent — Coral quente

Para destaques, FOMO, CTAs de urgencia, badges exclusivos.

| Token | Valor | Uso |
|---|---|---|
| `accent-50` | `#FFF7ED` | Backgrounds sutis |
| `accent-100` | `#FFEDD5` | Hover |
| `accent-500` | `#F97316` | Coral — accent principal |
| `accent-600` | `#EA580C` | Hover |

### Backgrounds — Creme quente

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#FAFAF7` | Background principal (creme levemente neutro) |
| `surface` | `#FFFFFF` | Cards, modais |
| `surface-muted` | `#F5F5F0` | Cards secundarios, sidebars |
| `surface-subtle` | `#EEEDE8` | Hovers, dividers |

### Foreground

| Token | Valor | Uso |
|---|---|---|
| `fg` | `#1A1A1A` | Texto principal (quase preto) |
| `fg-muted` | `#6B6B6B` | Texto secundario |
| `fg-subtle` | `#A3A3A3` | Placeholders, meta info |

### Status (mantidos)

| Status | Cor |
|---|---|
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Danger | `#EF4444` |
| Info | `#4F46E5` (same as primary) |

### Platform colors (mantidos)

YouTube `#FF0000`, LeetCode `#FFA116`, Medium `#191919`, GitHub `#8B5CF6`, Article `#0D9488`, Book `#D97706`.

---

## 3. Border Radius

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | `8px` | Inputs, selects |
| `radius-md` | `12px` | Botoes, chips menores |
| `radius-lg` | `16px` | Cards, modais |
| `radius-xl` | `20px` | Cards grandes, hero sections |
| `radius-full` | `9999px` | Botoes pill, badges, avatares |

**Regra:** botoes e badges sao **pill** (radius-full). Cards e modais sao **radius-lg/xl**. Inputs sao **radius-sm**.

---

## 4. Sombras

| Token | Valor | Uso |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | Inputs em repouso |
| `shadow-sm` | `0 2px 8px rgba(0,0,0,0.06)` | Cards |
| `shadow-md` | `0 4px 16px rgba(0,0,0,0.08)` | Cards em hover, dropdowns |
| `shadow-lg` | `0 8px 32px rgba(0,0,0,0.12)` | Modais |
| `shadow-glow-primary` | `0 0 20px rgba(79,70,229,0.15)` | Elementos em destaque (primary glow) |
| `shadow-glow-accent` | `0 0 20px rgba(249,115,22,0.15)` | Elementos FOMO (accent glow) |

---

## 5. Componentes Base

### Botoes

| Variante | Visual |
|---|---|
| Primary | `bg-primary-500 text-white` pill, shadow-sm, hover: shadow-md + scale 1.02 |
| Secondary | `bg-surface border border-border text-fg` pill, hover: bg-surface-subtle |
| Accent/CTA | `bg-accent-500 text-white` pill, shadow-glow-accent, hover: scale 1.02 |
| Ghost | `text-fg-muted` sem background, hover: bg-surface-subtle |
| Danger | `bg-danger text-white` pill |

Todos os botoes sao **pill** (border-radius-full). Tamanhos: `sm` (32px height), `md` (40px), `lg` (48px).

### Inputs

- Border radius: `radius-sm` (8px)
- Variant `bordered` por default (borda visivel, sem fundo)
- Focus: ring de 2px em `primary-500/30` + borda `primary-500`
- Labels: `body-sm` weight 500, cor `fg-muted`
- Placeholders: cor `fg-subtle`

### Cards

- Background: `surface` (branco)
- Border: `1px solid` em `surface-subtle`
- Border radius: `radius-lg` (16px) para cards normais, `radius-xl` (20px) para cards hero
- Shadow: `shadow-sm`, hover: `shadow-md`
- Padding: `24px`

### Badges/Chips

- Border radius: `radius-full` (pill)
- Tamanho compacto: `caption` font, padding `4px 12px`
- Variantes por cor: primary (indigo), accent (coral), success, warning, danger, neutral
- Badges de exclusividade: fundo com gradient sutil + texto bold + glow

### Modais

- Border radius: `radius-xl` (20px)
- Shadow: `shadow-lg`
- Backdrop: blur (12px) + overlay semi-transparente
- Header: icone contextual + titulo + subtitulo
- Animacao: scale de 0.95 + opacity, duration 200ms

### Tables

- Headers: `caption` font, uppercase, letter-spacing 0.05em, cor `fg-subtle`
- Rows: hover com `bg-surface-muted`, transicao suave
- Zebra striping sutil (alternating `bg-surface` / `bg-surface-muted/50`)
- Border radius no container: `radius-lg`

### Navbar

- Glassmorphism: `backdrop-blur-xl`, `bg-surface/80`
- Items: pill shape com icone + label
- Active: `bg-primary-500/10 text-primary-500`
- Height: 56px desktop, bottom tab bar 64px mobile

---

## 6. Principios de Densidade

| Contexto | Density | Whitespace | Tipografia |
|---|---|---|---|
| Membro — mapa, plano de estudo | Espacoso | Muito whitespace, poucos elementos | Display/h1, body grande |
| Admin — dashboard, tabelas | Rico | Compacto mas organizado | h2/h3, body-sm |
| Landing page — hero, FOMO | Espacoso | Dramatico, impactante | Display, body grande |
| Modais/formularios | Moderado | Agrupado por secoes | h3, body, body-sm |

---

## 7. Elementos de Exclusividade / FOMO

Para reforcar que o programa e para apenas 12 selecionados:

- **Badge "12 Selecionados"**: pill com gradient coral, glow accent, icone de coroa/estrela
- **Counter de vagas**: "Restam X vagas" em destaque coral com animacao de pulso
- **Texto de escassez**: "Acesso restrito", "Programa exclusivo", "Apenas convidados"
- **Selo de membro**: badge premium no perfil do usuario dentro da plataforma
- **Progress indicators**: ring progress e barras sempre visiveis para reforcar engajamento

---

## 8. Implementacao Tecnica

### Instalacao da font Satoshi

Satoshi e distribuida via Fontshare (CDN gratuito). Adicionar no `app/layout.tsx`:

```tsx
// Opcao 1: @fontsource (npm)
import '@fontsource-variable/satoshi';

// Opcao 2: CSS import do Fontshare CDN
// <link href="https://api.fontshare.com/v2/css?f[]=satoshi@variable&display=swap" rel="stylesheet">
```

### CSS variables

Todas as cores, radius, sombras sao definidas como CSS variables em `globals.css` e mapeadas no `tailwind.config.ts`. Isso permite trocar temas no futuro.

### Tailwind config changes

- Atualizar `colors` com os novos tokens (primary indigo, accent coral, bg creme)
- Atualizar `borderRadius` com os novos tokens
- Atualizar `boxShadow` com os novos tokens incluindo glows
- Atualizar `fontFamily` para Satoshi
- Adicionar scale de tipografia custom

### HeroUI theme update

Atualizar o plugin `heroui()` no tailwind para usar os novos primary (indigo) e danger colors, e ajustar as layout variables (radius, fontSize).

---

## 9. Fora de escopo

- Dark mode (pode ser fase futura)
- Temas multiplos / customizacao por usuario
- Design tokens exportados para Figma (manual por enquanto)
- Componentes nativos mobile (React Native)
