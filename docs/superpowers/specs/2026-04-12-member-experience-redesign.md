# Member Experience Redesign — Mapa de Progressao Gamificado

**Data:** 2026-04-12
**Escopo:** Redesign completo da experiencia do membro (nao-admin) no ICS Select. Substituir o layout de dashboard corporativo por uma experiencia gamificada de aprendizado com mapa de progressao estilo jogo.

---

## 1. Nova Paleta e Identidade Visual

Sair do azul corporativo (#005ab4) para uma paleta quente e acolhedora. O azul permanece apenas no logo.

### Cores base

| Token | Valor | Uso |
|---|---|---|
| background | `#FDF8F3` (creme suave) | Fundo principal — substitui o azul-branco frio |
| surface | `#FFFFFF` com sombras warm | Cards, modais |
| foreground | `#2D2418` (marrom escuro) | Texto principal |
| accent (brand) | `#F97316` (coral quente) | Botoes primarios, elementos de acao — substitui o azul |

### Cores de plataforma (bordas dos nodes)

| Plataforma | Cor |
|---|---|
| YouTube | `#FF0000` |
| LeetCode | `#FFA116` |
| Medium | `#191919` |
| GitHub | `#8B5CF6` |
| Artigo generico | `#0D9488` |
| Livro | `#D97706` |

### Cores de status

| Status | Cor |
|---|---|
| Consegui | `#10B981` (verde) |
| Travei | `#EF4444` (vermelho coral) |
| Tive duvidas | `#F59E0B` (amarelo) |
| Pendente | `#A8A29E` (cinza quente) |
| Bloqueado | Cinza frio + opacity 50% |

---

## 2. Layout Geral

### Topbar flutuante transparente (somente membros)

- Fixa no topo com `backdrop-blur` e fundo semi-transparente (glassmorphism leve)
- **Esquerda:** logo ICS Select
- **Centro/direita:** 3 itens de navegacao como icones + label — Mapa (compass), Calendario (calendar), Membros (users)
- **Extrema direita:** avatar do usuario clicavel → dropdown com Perfil, Disponibilidade, Sair
- **Mobile:** transforma em bottom tab bar fixa (Mapa, Calendario, Membros, Perfil)

### Area central — o mapa

- Ocupa toda a largura disponivel (100% - sidebar de stats)
- Scroll vertical para navegar pelo path de nodes
- Fundo com gradient suave warm + elementos decorativos SVG (nuvens, estrelas, bandeirinhas) posicionados com `position: absolute`, parallax sutil no scroll

### Sidebar direita de stats (~300px, desktop only)

- `position: sticky`, acompanha o scroll
- Cards empilhados:
  1. Ring de progresso — porcentagem do plano atual com animacao
  2. Modulos: X de Y concluidos
  3. Dias restantes no plano (icone de relogio)
  4. Streak de estudo — dias consecutivos com pelo menos 1 modulo completo
- **Mobile:** colapsa em banner horizontal compacto abaixo da topbar

### Admin mantem layout atual

Sidebar esquerda + conteudo. So membros ganham a experiencia nova.

---

## 3. Visao de Mundos (World Select)

Cada plano semanal e um "mundo". Navegacao entre planos passados, ativo e futuros.

### Acesso

- Botao "Ver todos os mundos" no mapa, ou breadcrumb "<- Todos os mundos"
- Por default, o membro abre diretamente no mundo do plano ativo

### Card de mundo

- **Plano concluido:** card colorido e vibrante, checkmark dourado, porcentagem de conclusao, label "Semana 3 — Arrays & Hashing", clicavel para revisitar
- **Plano ativo:** borda pulsante/glow, badge "Agora", destaque visual
- **Plano futuro:** opacidade reduzida, icone de cadeado, label "Em breve", sem interacao

### Layout

- Grid horizontal com scroll lateral (desktop)
- Scroll vertical, cards full-width (mobile)
- Ordem cronologica: mais antigo a esquerda/topo

### Transicao mundo -> mapa

- Animacao de zoom-in (scale + fade) ao clicar num mundo
- Botao de voltar no canto do mapa

### Dados

- Cada mundo mapeia 1:1 com um `Plan` da API
- Plano atual: `GET /me/week`
- Historico: novo endpoint `GET /me/plans` retornando todos os planos do membro

---

## 4. Mapa de Progressao (Node Map)

Coracao da experiencia. Visao dos modulos/items dentro de um plano.

### Path (trilha)

- SVG com curvas bezier serpenteando verticalmente (S-curves alternando esquerda/direita)
- Linha grossa (~8px), cor warm, borda tracejada sutil
- Trecho percorrido (modulos feitos) muda de cor/opacidade para indicar progresso
- Decoracoes ao longo do path: estrelas, bandeirinhas, arbustos — SVGs estaticos posicionados entre nodes
- **Mobile:** path centralizado vertical, nodes em coluna reta sem curvas S

### Nodes

Circulos (~64-80px) posicionados sobre o path, espacados uniformemente.

| Estado | Visual |
|---|---|
| Pendente | Fundo branco, borda cinza quente, icone do formato no centro |
| Ativo (proximo a fazer) | Fundo branco, borda cor da plataforma, pulso sutil CSS, levemente maior |
| Consegui | Fundo verde suave, checkmark, estrelinhas ao redor |
| Travei | Fundo vermelho-coral suave, icone X, borda vermelha |
| Tive duvidas | Fundo amarelo suave, icone interrogacao, borda amarela |
| Bloqueado | Cinza, cadeado, opacity 50% |

Ordem: segue campo `order` do `PlanItem`, de baixo para cima (inicio embaixo, "chegada" no topo).

### Interacao Hover (card flutuante)

- Animacao fade + scale via Framer Motion (~150ms)
- Conteudo: titulo do material, tempo estimado ("~45min"), formato
- Borda colorida pela plataforma
- Posicao: acima ou abaixo do node conforme espaco disponivel

### Interacao Click (card expandido)

- Card de hover anima expandindo (Framer Motion `layoutId`) para card maior (~400px)
- Backdrop blur escurece levemente o mapa atras
- **Mobile:** abre como bottom sheet (slide up)

**Conteudo do card expandido:**

- Header: titulo completo + badge de formato + tempo estimado
- Borda colorida pela plataforma
- Link do material: botao primario "Abrir material" (nova aba)
- Descricao do item (se existir)
- **Se nao completou — secao de conclusao:**
  - 3 botoes: "Consegui" (verde), "Travei" (vermelho), "Tive duvidas" (amarelo)
  - Textarea: "Deixe um feedback sobre este estudo..." (opcional)
  - Botao "Enviar"
- **Se ja completou:** mostra status escolhido + feedback, com opcao de editar
- Fechar: clique fora, Esc, ou botao X

### Tecnologia

- DOM puro com SVG paths + CSS animations
- Nodes sao componentes React posicionados com CSS absolute
- Path entre nodes e `<svg>` com curvas bezier
- Animacoes via Framer Motion
- Elementos decorativos sao SVGs/imagens posicionados com absolute

---

## 5. Calendario Semanal

Acessivel pela topbar. Visao estilo Google Calendar.

### Layout desktop

- **Esquerda (~250px):** mini-calendario mensal clicavel + lista de sessoes do dia selecionado
- **Centro:** grid semanal com linhas de hora (7h-23h) e colunas (Seg-Dom)

### Cards de sessao

- Cada `StudySession` aparece como card posicionado no horario correto
- Cor de fundo baseada na plataforma do material
- Mostra: titulo truncado, horario, duracao
- Click abre o mesmo card expandido do mapa (componente reutilizado)

### Header

- Navegacao entre semanas (<- / ->)
- Toggle: Diario / Semanal (default: semanal)
- Indicador de "Hoje" destacado

### Mobile

- Visao diaria (uma coluna), swipe horizontal entre dias
- Mini-calendar escondido atras de botao

### Dados

- Usa `StudySession` existentes da API
- `scheduledAt` + `durationMinutes` determinam posicao e altura no grid
- Endpoint: `GET /me/week` ja retorna sessions dentro de cada item

---

## 6. Pagina de Membros

Mural da turma com ranking sutil.

### Layout

- Header: "Minha Turma — Ciclo X" + contagem de membros
- Grid de cards: 3 colunas desktop, 2 tablet, 1 mobile

### Card de membro

- Avatar (foto Google OAuth) + nome
- Barra de progresso semanal (porcentagem do plano atual)
- Badge sutil de posicao no ranking (1o/2o/3o com icone dourado/prata/bronze, resto numero pequeno)
- Status textual: "5 de 8 modulos"

### Ranking

- Ordenacao padrao: progresso semanal descendente
- Sem enfatizar competicao — ranking e a ordenacao natural dos cards
- Card do proprio usuario tem borda de destaque

### Privacidade

Mostra apenas progresso percentual, nao quais itens o colega fez.

### Dados

- Novo endpoint: `GET /cycles/:id/members/progress` retornando membros do ciclo ativo com progresso semanal

---

## 7. Responsividade

| Componente | Desktop | Mobile |
|---|---|---|
| Topbar | Fixa no topo, icones + labels | Bottom tab bar fixa |
| Mapa | Curvas S amplas, nodes alternando | Path centralizado, nodes em coluna |
| Card expandido | Card flutuante com backdrop | Bottom sheet (slide up) |
| Sidebar stats | Fixa a direita ~300px | Banner horizontal compacto |
| Calendario | Mini-cal + grid semanal | Visao diaria, swipe entre dias |
| Membros | Grid 3 colunas | Grid 1 coluna, cards compactos |
| Mundos | Grid horizontal scroll | Scroll vertical, cards full-width |

---

## 8. Endpoints de API necessarios (novos)

| Endpoint | Metodo | Descricao |
|---|---|---|
| `/me/plans` | GET | Historico de todos os planos do membro (para visao de mundos) |
| `/cycles/:id/members/progress` | GET | Membros do ciclo com progresso semanal (para pagina de membros) |
| `/plans/:planId/items/:itemId/feedback` | PATCH | Atualizar status (consegui/travei/duvidas) + feedback textual |

Nota: o endpoint de feedback pode reutilizar/estender o `POST /plans/:id/items/:itemId/done` existente, adicionando os campos de status granular e feedback.

---

## 9. Dependencias novas (frontend)

| Pacote | Uso |
|---|---|
| `framer-motion` | Animacoes de hover, expand, transicoes entre mundos |

Nenhuma outra dependencia nova necessaria. SVGs sao inline, path e calculado programaticamente.

---

## 10. Fora de escopo

- Sistema de badges/conquistas (pode ser fase futura)
- Chat IA integrado ao mapa
- Flashcards (CTA atual sera removido temporariamente)
- Notificacoes push
- Dark mode (app continua forced light)
