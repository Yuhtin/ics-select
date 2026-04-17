# ICS Select — Revamp Design (v1)

**Data:** 2026-04-16
**Autor:** Davi Duarte (Diretor Educacional, Inteli Consulting Society) + Claude
**Status:** Aguardando revisão final antes do plano de implementação
**Substitui:** `2026-04-11-ics-select-design.md` (design original) como referência principal; os specs `2026-04-12-*` e `2026-04-16-member-map-3d-redesign-design.md` ficam arquivados (direções exploradas, não levadas adiante).

---

## 1. Contexto do revamp

A plataforma atual (~60% do spec original implementado) funciona mas está **sem vida visualmente** e pouco funcional no dia-a-dia. Os três sintomas chave:

- **Membros acham difícil acompanhar autoestudos** (não existe `/me/today`, plano é exposto como catálogo de semana inteira sem indicador de "agora").
- **Scheduler cria eventos fictícios** (`publication.service.ts:68` passa `busyByDay = {}` — plano colide com compromissos reais).
- **Admin "não consegue bater o olho"** — dashboard raso, sem alertas, sem triagem, IA escondida, reflexões dispersas.

A plataforma ainda **não tem usuários reais**. Isso permite um revamp do tipo **Foundation** — reescrever o que precisa, sem shims de compatibilidade.

### Decisões macro já fechadas

| Decisão | Racional |
|---|---|
| **Approach = Foundation** | Sem usuários, as mudanças de domínio (outcome unificado, drop de `StudySession`, taxonomia de topics) não cabem em "surface". Rewrite direcionado do que precisa mudar. |
| **Paradigma visual = Magazine Editorial** | Warm + serif + tipografia confiante; opõe-se ao dashboard corporativo e à tentativa de gamificação via mapa 3D (matado). |
| **UI em inglês, conteúdo em pt-BR** | Público se prepara pra carreira técnica internacional; termos `Up next`, `Streak`, `Cohort`, `Triage` não têm tradução boa. Reflexões/retrôs/feedbacks permanecem em pt-BR (voz do autor). |
| **Goal-agnostic** | Não é só Big Tech — cohort também tem Consulting Tech, Competitive Programming, Startups. Taxonomia de `Track` no modelo. |
| **3D map morto** | Código de `map-3d/` e `map-2d/` (21+ arquivos) removido. Mapa-trilha era uma tentativa de injetar vida; foi trocado pelo loop diário funcional. |

---

## 2. Sistema visual

### 2.1 Tipografia (dual-serif system)

| Fonte | Uso | Nota |
|---|---|---|
| **Newsreader** (opsz 6..72) | Narrativa/leitura — home do membro, item, cohort, retro, triage, perfil do membro. | Google Fonts. Optical sizing. Voz de jornal digital. |
| **Source Serif 4** (opsz 8..60) | Ferramenta densa — plan editor, cycle page, acervo, AI usage. | Google Fonts. Tabular-nums ativo. Voz Bloomberg/terminal. |
| **Inter** (400–700) | Todo UI chrome — botões, pills, labels, nav, meta. | Google Fonts. |
| **IBM Plex Mono** (400/600) | Números pequenos, horas, eyebrow mono, IDs. | Google Fonts. |

Carregadas via `<link>` em `layout.tsx`. **Nunca** usar `@import url()` (bloqueia dev server do Next.js).

### 2.2 Paleta

```
--paper         #FAFAF7   fundo principal, creme warm
--paper-warm    #EFEEE8   fundo de seção/card secundário
--surface       #FFFFFF   card, input bg
--ink           #1A1A1A   texto principal, botão primário
--ink-soft      #44403C   texto secundário
--ink-mute      #78716C   meta, eyebrow
--ink-faint     #A8A29E   placeholder, desabilitado
--rule          #E5E4DF   divisores, bordas
--accent        #C45D3A   terracota — rationale da IA, destaque editorial (parcimônia)
```

**Outcome tokens (disciplina: dot 6-10px ou border-left 3px, NUNCA fundo inteiro):**
```
--done-easy     #065F46   verde profundo
--done-hard     #B45309   âmbar queimado
--doubts        #6B21A8   roxo interrogativo
--stuck         #991B1B   vinho fosco (não alarme)
--pending       #A8A29E   cinza neutro
```

**Platform colors (mantidos do spec atual):**
YouTube `#FF0000` · LeetCode `#FFA116` · Medium `#191919` · GitHub `#8B5CF6` · Article `#0D9488` · Book `#D97706`.

### 2.3 Geometria e motion

- Spacing: múltiplos de 4 (4, 8, 12, 16, 24, 32, 48, 64). Margem de seção 32.
- Radius: cards 12, inputs 8, pills 999, imagens 8.
- Elevação: **sem box-shadow no design principal.** Diferença vem de fundo (`paper → paper-warm → surface`) + borda `1px rule`. Shadow só aparece em modal/focus (`0 1px 3px rgba(0,0,0,0.06)`).
- Stroke padrão 1px `rule`; 1.5px pra destaque.
- Motion: Framer Motion. 150ms hover, 200ms modal/slide, 300ms page transition. Easing `[0.16, 1, 0.3, 1]`.
- Ícones: `lucide-react` stroke 1.5. **Proibido emoji.**

### 2.4 Componentes primitivos

- **Button primary** — `bg: ink`, `color: paper`, pill, sem uppercase.
- **Button ghost** — border `1px ink`, bg transparente.
- **Pill** — uppercase 9px, weight 700, bg `ink` color `paper`. Variante inversa `paper-warm`.
- **Card** — `bg: surface`, border `1px rule`, radius 12. Header com eyebrow mono + h3.
- **List row** — vertical padding 12, divisor `border-bottom: 1px rule`, tempo mono.
- **Outcome picker** — 5 estados horizontais (Pending / Done easy / Done hard / Doubts / Stuck); labels expandidas no UI (`Nailed it`, `Got it (hard)`, `Had doubts`, `Stuck`, `Not yet`); dot colorido + label; selected vira `bg: ink`, `color: paper`.

---

## 3. Arquitetura do produto

### 3.1 Shells e route groups

- **`(member)`** — topbar flutuante translúcida: `Today · Cohort · Calendar · avatar`. Mobile vira bottom tab bar.
- **`(admin)`** — sidebar fixa esquerda: `Triage · Cohort · Plans · Library · Cycles · AI`.
- Route groups atuais (app) e (member) são consolidados: **admin sempre em `(admin)`, membro sempre em `(member)`**, sem sobreposição.

### 3.2 Rotas

**Member:**
- `/login`, `/privacy`
- `/me/onboarding` — disponibilidade + timezone + WhatsApp phone (1ª vez)
- `/me` — home diária (peça central)
- `/me/plan` — semana em lista agrupada por dia
- `/me/item/[id]` — tela de foco do item
- `/me/cohort` — feed ambiente + ranking (ranking visível só se `Cycle.rankingVisibleToMembers = true`)
- `/me/retro` — form do retrô (aberto sex 18h → dom 23:59)
- `/me/settings` — disponibilidade, Google, privacidade, phone

**Admin:**
- `/admin` — triagem (home)
- `/admin/cycle/[id]` — cycle page (grid + heatmap + classes)
- `/admin/cycle/[id]/classes/[classId]` — modal ou página de attendance
- `/admin/member/[id]` — detalhe com tabs (Timeline, Retros, Diagnose, Notes)
- `/admin/member/[id]/plan/[planId]` — **plan editor 3-panel**
- `/admin/library` — acervo + topic management
- `/admin/cycles` — lista + criar ciclo
- `/admin/ai-usage` — custo IA

**Público:**
- `/` — landing atual (mantida sem mudanças visuais)
- `/privacy` — política

### 3.3 Fluxos críticos

**Fluxo M1 (membro, diário):** abre `/me` → hero mostra "Up next · in 23m" ou "Now" → clica → `/me/item/[id]` → `Open on LeetCode ↗` → estuda fora → volta → marca outcome → reflexão opcional → save → volta pra home, próximo item aparece.

**Fluxo A1 (admin, domingo):** abre `/admin` → triagem mostra alertas (ex: "3 plans pending") → `start draft →` → `/admin/member/X/plan/new` (ou planId existente) → panel 1 mostra contexto (outcomes, retro, topic coverage) → panel 2 gera draft IA com rationale → panel 3 compõe (drag/drop, search inline) → `Publish & schedule` → scheduler lê free/busy → cria eventos no Calendar com `ICS ID:` embedded → WhatsApp opcional → toast sucesso.

---

## 4. Experiência do membro (detalhes por tela)

### 4.1 `/me` — Home diária

**Composição desktop (grid 12-col):**

- **Col 1-8 (main):** hero "Up next" + divider + `Today` (lista com horário mono + outcome dot + título) + divider + dias seguintes (Amanhã, Sex, Sab+Dom — vazios aparecem explicitamente).
- **Col 9-12 (sidebar):** streak card (número Newsreader grande + 7 dots dos últimos 7 dias) + `Cohort activity` feed (5 linhas, polling 60s) + link `See cohort →`.

**Estados do hero:**
- Now: eyebrow `Wed, Apr 16 · now`, CTAs `Start · Postpone 30m · Skip`.
- Up next: eyebrow `Up next · in 23m`.
- Running late: eyebrow `Running late · was at 19:00`, picker primed.
- Free day: `Free day · next Thu 09:00`.
- All done: `All done · next tomorrow 09:00`.

**Streak regra:** 1 `done_easy` OU `done_hard` num dia conta. `doubts`/`stuck` não contam. Zera com 2 dias consecutivos sem outcome positivo.

**Feed ambiente:** types `finished · started · got stuck · had doubts · joined the week · posted retro`. Reflexão textual **nunca** vai pro feed — só ação + item. Clicar numa linha abre o item em modo read-only.

**Mobile:** stack vertical. Feed ambiente move pra `/me/cohort` (not visible on home mobile). Streak colapsa em badge pequena no topbar.

**Dados:** `GET /me/home` retorna `{ hero: Item|null, today: Item[], days: { label, items }[], streak: {current, days7}, feed: Event[] }` num único request.

### 4.2 `/me/plan` — Semana em lista

Mesma lista da home, mas sem hero. Útil quando o membro quer ver contexto da semana inteira. Dias vazios aparecem. Navegação entre semanas (passada/atual; futura bloqueada).

### 4.3 `/me/item/[id]` — Item individual

Layout focado, sem sidebar.

**Composição:**
- Eyebrow mono `Module 04 of 08 · Binary Search`
- H1 Newsreader 40 — título do item (2 linhas se necessário)
- Meta mono — `LeetCode · 45 min · scheduled today 19:00`
- **CTA hero full-width** — `Open on LeetCode →` (abre em nova aba)
- Descrição do `LibraryItem`
- **Seção "Previous feedback"** se `carriedFromItemId` populado — mostra reflexão antiga + outcome antigo como bloquote literalmente. Serve de contexto do progresso.
- **Outcome picker** — 5 pills horizontais
- **Textarea reflexão** (placeholder pt-BR: *"Escreve em pt-BR se quiser — é sua nota"*) aparece ao escolher outcome ≠ `Not yet`
- Botão `Save outcome` habilitado com outcome escolhido

**Estados da tela:**
- **Pending & horário futuro:** CTA mostra `Open on LeetCode → · starts 19:00`; picker disabled com texto `Available at 19:00` (lockout temporal simples, sem tracking de "opened").
- **Pending & horário passou:** picker habilitado.
- **Done/doubts/stuck:** hero vira `✓ Marked as {outcome} · Apr 14`. Outcome + reflexão aparecem bloqueados; botão `Edit` libera edição (magazine: não esconde, deixa revisitar).
- **Stuck:** banner inferior *"David was notified · talk to him when you can"*. Sem drama.

**Dados:** `GET /me/item/:id` retorna `{ libraryItem, planItem, carriedFrom?: PreviousFeedback }`. `PATCH /me/item/:id/outcome` body `{ outcome, reflection? }`. Quando `outcome === 'stuck'`, backend dispara alerta admin.

### 4.4 `/me/cohort` — Cohort Page

**Layout 2-col (col 1-7 + col 8-12):**
- Col 1-7: `ACTIVITY` — feed ambiente completo, últimas 24h, infinite scroll.
- Col 8-12: `THIS WEEK` ranking — 12 linhas ordenadas por % da semana (reset dominical). Card do próprio usuário destacado com `bg: paper-warm` + border `1px ink`. Sem pódio. `Past weeks →` drawer opcional com as últimas 4 semanas.

**Ranking é condicional:** se `Cycle.rankingVisibleToMembers = false` (default), endpoint omite o campo `ranking` e frontend vira single-column — feed full width. **Nada indica** que o ranking existe enquanto tá off.

**Mobile:** tabs `Activity | Rank` no topo.

**Dados:** `GET /me/cohort` retorna `{ feed: Event[], ranking?: MemberRank[], weekEnds: date }`.

### 4.5 `/me/retro` — Retrô semanal

**Janela:** aberto sex 18h local → dom 23:59. Badge `Retro open` na topbar durante a janela.

**Composição:**
- Eyebrow `WEEK 04 RETRO`
- H1 `How was this week?`
- Subtitle `Your notes help shape next week's plan`
- 3 textareas:
  - `WHAT CLICKED` — placeholder pt-BR *"o que fluiu, destravou, te animou"*
  - `WHAT GOT STUCK` — *"o que travou, confundiu ou foi chato"*
  - `NEXT WEEK, I WANT` — *"o que você pediria pro admin"*
- Botão `Submit retro`

**Comportamento:**
- Não obrigatório, mas persistente (banner fica até a próxima sexta se não preenchido).
- 2 retros consecutivos puladas → alerta `SKIPPED_RETROS` no admin triage.
- Editável até dom 23:59; depois vira read-only.
- Membro **não vê retros de outros**. Só admin no panel 1 do plan editor.

**Dados:** `GET /me/retro/current` (null se fora da janela ou nenhum plan ativo); `POST /me/retro` body `{ whatClicked, whatStuck, nextWeekWish }`.

### 4.6 `/me/settings` — Configuração

- Disponibilidade semanal (minutos/dia) + `preferredSessionMinutes` (mantido do spec atual)
- **WhatsApp phone** (novo — formato E.164, ex: `+5511999887766`)
- Target track (opcional dropdown)
- Google account status + reconnect CTA
- Privacidade + aceite timestamp

---

## 5. Experiência do admin (detalhes por tela)

### 5.1 `/admin` — Triage Home

**Composição:**
- Eyebrow mono `Sun, Apr 14`
- H1 Newsreader `Good morning, Davi`
- Subtitle `N things need your attention today`
- Alertas agrupados por severidade: `Urgent` (vinho), `Needs attention` (âmbar), `Scheduled` (cinza). Cada alerta tem border-left 3px da cor da severidade, conteúdo (quem + o que + detalhes + timestamp), e 1-2 ações inline.
- Divider.
- `THE COHORT TODAY` strip horizontal com 12 avatars + status dots.
- `CURRENT CYCLE` linha: `2026.1 · week 4 of 12 · 3 days until week ends`.

**Tipos de alerta (todos computados on-the-fly):**

| Tipo | Severidade | Regra |
|---|---|---|
| `STUCK_RECENT` | Urgent | Item `outcome = STUCK` nas últimas 48h |
| `DISAPPEARED` | Urgent | 0 outcomes ≠ PENDING nas últimas 72h + tem eventos vencidos |
| `CALENDAR_BROKEN` | Urgent | OAuth expirado / refresh token inválido |
| `STUCK_REPEATEDLY` | Needs attention | 2+ items com STUCK na semana atual |
| `FINISHED_EARLY` | Needs attention | 100% da semana + ≥2 dias restantes |
| `SKIPPED_RETROS` | Needs attention | 2 retros consecutivos sem submit |
| `PLAN_PENDING` | Scheduled | Semana atual termina em ≤3 dias e não há plan DRAFT/PUBLISHED pra próxima |

**Ações disponíveis nos alertas:**
- `whatsapp ↗` — abre `https://wa.me/{phone}?text={pre-filled}` em nova aba; texto canned por tipo, editável.
- `note 1:1 →` — drawer com textarea, salva em `AdminNote`.
- `bump next plan →` — navega pro editor da próxima semana com hint.
- `start draft →` — navega pro editor 3-panel.
- `see member →` — `/admin/member/[id]`.
- `× dismiss` — snooze por 24h (`DismissedAlert`).

**Quando sem alertas:** `You're all caught up.` + cohort strip + stat linha (`12 active · 47% avg this week · 3 in streak > 7d`). Elegante, sem celebrar.

**Dados:** `GET /admin/triage` retorna `{ alerts: Alert[], cohortStrip: MemberSummary[], cycleInfo: {...} }`. `POST /admin/alerts/dismiss` body `{ type, targetId }`.

### 5.2 `/admin/cycle/[id]` — Cycle Page

**Composição (Source Serif 4):**
- Header: `Cycle 2026.1 · Active · 12 members · week 4 of 12 · 3 days until week ends`
- Toggle inline: `Cohort ranking: [ ○ hidden ]` (flipa `Cycle.rankingVisibleToMembers` em tempo real)
- Filtro: `Track filter: [ All tracks ▾ ]`
- Section `MEMBERS` — grid 4 colunas. Card por membro: avatar, nome, track, % semanal, alert dot (vermelho se tem alerta urgente). Click vai pro detalhe.
- Section `COHORT HEATMAP · LAST 6 WEEKS` — GitHub contribution-graph style: linhas = membros, colunas = semanas, intensidade = % de `done_easy|done_hard` da semana.
- Section `CLASSES` — lista de `ClassSession` (passadas + agendadas) + botão `+ Schedule class`. Click aula → modal com attendance em batch.

### 5.3 `/admin/member/[id]` — Member Detail

**Header:** avatar, nome, track, cycle position, ações side (`Create plan for next week →`, `WhatsApp ↗`, `Export data`).

**Topic coverage heatmap** no topo (cycle-wide, este membro).

**Tabs:**
- `Timeline` — outcomes + reflexões por item, linha do tempo reverse-chrono.
- `Retros` — lista de retrôs submetidos (click expande).
- `Diagnose` — markdown IA (24h cache, botão `↻ Regenerate`).
- `Notes` — `AdminNote`s editáveis (notes do admin para si mesmo).

### 5.4 `/admin/member/[id]/plan/[planId]` — Plan Editor 3-panel

**Layout desktop-only (min 1280px):**

Grid 3 colunas (col 1-4 / 5-8 / 9-12), cada panel scroll independente.

**Panel 1 (LEFT) · CONTEXT (read-only):**
- Title: nome + track + cycle position
- `LAST WEEK (N) OUTCOMES` — grid 2x3 com dot colorido + label + número tabular
- `CARRY-OVER CANDIDATES` — checkboxes com items STUCK/DOUBTS/PENDING da semana anterior. Marcados por default (admin desmarca se quiser dropar). Os selecionados aparecem no panel 2 como "Carried over" pré-adicionados.
- `RETRO · SUBMITTED FRI ...` — 3 blockquotes (whatClicked / whatStuck / nextWeekWish).
- `TOPIC COVERAGE · THIS CYCLE` — mini-heatmap 6-col, labels curtas (`arrays`, `dp`, `graph`, etc) + hint textual ("DP + greedy + graphs são os mais atrasados").
- `AI DIAGNOSE ▸` — expandable markdown.

**Panel 2 (CENTER) · AI DRAFT (GPT-5.4-mini):**
- Title + subtitle com summary (ex: "6 items · 280 min · DP-focused practice")
- `AI badge` com sparkle terracota.
- `Narrative` italic Source Serif 4 — resumo da IA sobre a semana.
- Botão `⟲ Regenerate with brief` — abre modal com textarea pro admin passar contexto adicional (`Ex: foca mais em hard, tá faltando velocidade`).
- `SUGGESTED ITEMS (N)` — cards brancos com border `1px rule` (ou âmbar+bg `paper-warm` se `carried over`). Cada card:
  - Order number (Source Serif)
  - Pill `carried over` se for
  - Título (Source Serif 16)
  - Meta pills (platform, topic, time)
  - **Rationale** em bloco `border-left 2px accent` (terracota): `WHY: [1-2 linhas explicando por que ESTE item pra ESTE membro AGORA]`
  - Botão `Add to plan →` — move pro panel 3, some daqui.
- `OR CONSIDER` — 3 alternates collapsed; click expand.

**Panel 3 (RIGHT) · THE PLAN (editable):**
- Title + meta (`Week 5 · Apr 21 — Apr 27 · N items · M min`)
- **Budget badge** — check rápido no cliente: soma `estimatedMinutes` vs `availableMinutes` da semana (`MemberAvailability`). Verde se ≤80%, âmbar 80-100%, vermelho >100%. Label inline: `Fits availability · 165 / 240 min (69%)`. É **pré-visualização superficial** — o check real de overflow acontece no publish (scheduler lê free/busy do Calendar e pode rejeitar mesmo estando verde aqui, se a janela de tempo real estiver cheia).
- Lista de items com drag-handle (`⋮⋮`), order, título, meta mono (`LEETCODE · 45M · CARRIED OVER`), botão `×` remove.
- `+ Add from library — type to search…` — typeahead inline com 200ms debounce. Filtros auto (track do membro + topic inferido). Click adiciona com `order: lastOrder+1`.
- `ADMIN NOTES · PRIVATE` — textarea.
- `PUBLICATION` section com checkboxes:
  - `Create Google Calendar events (with ICS ID)`
  - `Send WhatsApp notification to member`
- Header buttons: `Save draft` (ghost) + `Publish & schedule` (primary).

**Publish flow:**
1. Backend roda scheduler (greedy chunker + free/busy de verdade).
2. Se overflow → modal `Plan doesn't fit {name}'s availability. Overflow: N items (M min). [Adjust] [Force publish]`.
3. Se OK → `WeeklyPlan` vira `PUBLISHED`; scheduler cria eventos no Calendar com descrição contendo `ICS ID: <planId>/<itemId>`; WhatsApp dispara se checked; toast sucesso.

**IA prompt enhanced:** Claude/GPT recebe member track, últimas 4 semanas (outcomes + reflexões), topic coverage %, retro atual, brief opcional. Tool calling `search_library(query, filters)` finalmente implementado como o spec original previu.

**Dados:** `GET /admin/member/:id/plan-context?week=2026-W17`, `POST /admin/ai/draft-plan`, `POST /admin/library/search` (typeahead), `POST /admin/members/:id/plans`, `PATCH /plans/:id`, `POST /plans/:id/publish`.

### 5.5 `/admin/library` — Library

- Lista com filtros: track, topic, format, difficulty, minutes.
- Busca híbrida (tsvector + pgvector) no topo — typeahead 200ms.
- **Topic management** (botão `Manage topics →`): CRUD simples de topic strings + `order` pra display no heatmap.
- Botão `+ New item` → modal com 2 tabs:
  - `Manual` — form completo.
  - `Import URL` — cola link → backend extrai meta tags → preenche campos → admin revisa → save.
- Row: `title · topic · tracks · format · difficulty · minutes · createdAt · [edit] [delete]`.

### 5.6 `/admin/cycles` — Cycles List

- Tabela simples: nome, status, start/end, members count, weeks elapsed, progress avg.
- `+ New cycle` → form básico (nome, datas, membros iniciais — busca por email Inteli).
- `Archive` em cada row.

### 5.7 `/admin/ai-usage` — AI Cost

- Tabela: week · purpose (`draft-plan`, `brief-plan`, `diagnose`) · tokens in/out · usd cost.
- Summary no topo: custo da semana, custo do mês, custo do ciclo.
- Line chart (Source Serif 4) de custo por semana.

---

## 6. IA — integração

### 6.1 Providers

- **LLM:** GPT-5.4-mini via `OpenAiChatProvider` (`apps/api/src/common/openai/openai-chat.provider.ts`). Mantido.
- **Embeddings:** `text-embedding-3-small` via mesmo cliente. Mantido.
- **Anthropic removido da intenção** — spec original dizia Claude pra reasoning, mas código nunca implementou; alinha com realidade.

### 6.2 Use cases

| Use case | Onde renderiza | Mudança |
|---|---|---|
| `DraftPlanUseCase` | Panel 2 do plan editor | **Tool calling implementado** (`search_library`); prompt enhanced com retro + outcomes + topic coverage + track + carry-over selecionado. |
| `BriefPlanUseCase` | Modal "Regenerate with brief" | Recebe `brief` adicional; reusa mesmo flow. |
| `DiagnoseUseCase` | Panel 1 expandable + `/admin/member/:id` tab | Cache 24h mantido. |
| `ChatContextUseCase` | **Cortado do MVP** | Código mantido em `apps/api/src/ai/chat.*` mas sem UI exposta. V1.1 se houver demanda. |

### 6.3 Observabilidade

Cada chamada grava `AiGeneration { userId?, purpose, model, promptTokens, responseTokens, costUsd, metadata, createdAt }`. Rendered em `/admin/ai-usage`.

---

## 7. Domínio revisado

### 7.1 Mudanças em resumo

| Mudança | Motivo |
|---|---|
| `WeeklyPlanItem.outcome: ItemOutcome` substitui `status + stuck + difficultyRating` | 3 campos descoordenados → 1 enum (`PENDING`, `DONE_EASY`, `DONE_HARD`, `DOUBTS`, `STUCK`). Alinha UI e schema. |
| `StudySession` **removido** | Sessions eram entidade de progresso paralela ao item — confundia. Calendar vira source-of-truth via `ICS ID:` embedded na descrição. |
| `Topic` table adicionada | Taxonomia controlada pro admin (`arrays`, `dp`, `graphs`...). Usada no heatmap de cobertura e no prompt da IA. |
| `Track` enum adicionado (em `CycleMembership`) | Goal-agnostic — BIG_TECH, CONSULTING_TECH, COMPETITIVE_PROGRAMMING, STARTUP, OTHER. Membro pode trocar entre ciclos. |
| `LibraryItem.tracks: Track[]` | Item filtrável por track. Vazio = serve todos. |
| `WeeklyRetro` table adicionada | Retrô semanal estruturado, insumo pro admin. |
| `AdminNote` table adicionada | Notas privadas do admin sobre membros. |
| `DismissedAlert` table adicionada | Snooze de alertas por 24h. |
| `Cycle.rankingVisibleToMembers: Boolean` default `false` | Toggle de ranking visível a membros (gaming prevention). |
| `User.whatsappPhone: String?` E.164 | WhatsApp real em vez de fallback pra email. |
| `WeeklyPlanItem.carriedFromItemId: String?` | Liga item carregado à versão da semana anterior. |
| `WeeklyPlanItem.reflection` mantido | Reflexão por-item em pt-BR, do membro. |

### 7.2 Schema Prisma (final)

```prisma
enum Role { ADMIN MEMBER }
enum CycleStatus { ACTIVE ARCHIVED }
enum Track { BIG_TECH CONSULTING_TECH COMPETITIVE_PROGRAMMING STARTUP OTHER }
enum ItemFormat { VIDEO ARTICLE BOOK PROBLEM OTHER }
enum ItemDifficulty { EASY MEDIUM HARD }
enum WeeklyPlanStatus { DRAFT PUBLISHED COMPLETED ARCHIVED }
enum ItemOutcome { PENDING DONE_EASY DONE_HARD DOUBTS STUCK }
enum AttendanceStatus { PRESENT ABSENT LATE }
enum AlertType {
  STUCK_RECENT
  DISAPPEARED
  STUCK_REPEATEDLY
  FINISHED_EARLY
  SKIPPED_RETROS
  PLAN_PENDING
  CALENDAR_BROKEN
}

model User {
  id                   String   @id @default(cuid())
  email                String   @unique
  name                 String
  pictureUrl           String?
  role                 Role     @default(MEMBER)
  whatsappPhone        String?  // E.164
  privacyAcceptedAt    DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  googleAccount        GoogleAccount?
  availability         MemberAvailability?
  memberships          CycleMembership[]
  weeklyPlans          WeeklyPlan[]
  retros               WeeklyRetro[]
  attendance           ClassAttendance[]
  adminNotesAuthored   AdminNote[] @relation("author")
  adminNotesAbout      AdminNote[] @relation("about")
  refreshTokens        RefreshToken[]
  dismissedAlerts      DismissedAlert[]
}

model Cycle {
  id                        String      @id @default(cuid())
  name                      String      @unique
  startsAt                  DateTime
  endsAt                    DateTime
  status                    CycleStatus @default(ACTIVE)
  rankingVisibleToMembers   Boolean     @default(false)
  createdAt                 DateTime    @default(now())

  memberships CycleMembership[]
  classes     ClassSession[]
  weeklyPlans WeeklyPlan[]
  retros      WeeklyRetro[]
}

model CycleMembership {
  id       String   @id @default(cuid())
  userId   String
  cycleId  String
  track    Track?
  joinedAt DateTime @default(now())
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle    Cycle    @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  @@unique([userId, cycleId])
}

model MemberAvailability {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  mondayMinutes           Int      @default(0)
  tuesdayMinutes          Int      @default(0)
  wednesdayMinutes        Int      @default(0)
  thursdayMinutes         Int      @default(0)
  fridayMinutes           Int      @default(0)
  saturdayMinutes         Int      @default(0)
  sundayMinutes           Int      @default(0)
  preferredSessionMinutes Int      @default(60)
  timezone                String   @default("America/Sao_Paulo")
  updatedAt               DateTime @updatedAt
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Topic {
  id        String   @id @default(cuid())
  slug      String   @unique     // ex: "dp-intro"
  label     String               // ex: "Dynamic Programming — Intro"
  order     Int      @default(0) // display order no heatmap
  createdAt DateTime @default(now())
  items     LibraryItem[]
}

model LibraryItem {
  id               String     @id @default(cuid())
  title            String
  url              String?
  description      String?
  format           ItemFormat
  difficulty       ItemDifficulty
  estimatedMinutes Int
  topicId          String?
  tracks           Track[]    @default([])
  source           String?
  tags             String[]
  embedding        Unsupported("vector(1536)")?
  searchVector     Unsupported("tsvector")?
  createdById      String
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  topic     Topic?           @relation(fields: [topicId], references: [id])
  planItems WeeklyPlanItem[]
  @@index([format])
  @@index([difficulty])
  @@index([topicId])
}

model WeeklyPlan {
  id          String           @id @default(cuid())
  userId      String
  cycleId     String
  weekStart   DateTime
  weekEnd     DateTime
  status      WeeklyPlanStatus @default(DRAFT)
  adminNotes  String?
  createdAt   DateTime         @default(now())
  publishedAt DateTime?

  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle Cycle            @relation(fields: [cycleId], references: [id])
  items WeeklyPlanItem[]
  @@index([userId, weekStart])
}

model WeeklyPlanItem {
  id                String       @id @default(cuid())
  weeklyPlanId      String
  libraryItemId     String
  order             Int
  outcome           ItemOutcome  @default(PENDING)
  reflection        String?
  completedAt       DateTime?
  carriedFromItemId String?

  weeklyPlan    WeeklyPlan      @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)
  libraryItem   LibraryItem     @relation(fields: [libraryItemId], references: [id])
  carriedFrom   WeeklyPlanItem? @relation("carry", fields: [carriedFromItemId], references: [id])
  carriedTo     WeeklyPlanItem[] @relation("carry")
  @@unique([weeklyPlanId, order])
}

model WeeklyRetro {
  id           String   @id @default(cuid())
  userId       String
  cycleId      String
  weekStart    DateTime
  whatClicked  String?
  whatStuck    String?
  nextWeekWish String?
  submittedAt  DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle Cycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  @@unique([userId, weekStart])
  @@index([cycleId, weekStart])
}

model AdminNote {
  id        String   @id @default(cuid())
  aboutId   String
  authorId  String
  text      String
  createdAt DateTime @default(now())

  about  User @relation("about",  fields: [aboutId],  references: [id], onDelete: Cascade)
  author User @relation("author", fields: [authorId], references: [id])
  @@index([aboutId])
}

model DismissedAlert {
  id          String    @id @default(cuid())
  userId      String
  alertType   AlertType
  targetId    String
  dismissedAt DateTime  @default(now())
  expiresAt   DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, expiresAt])
}

model GoogleAccount { /* inalterado */ }
model RefreshToken { /* inalterado */ }
model ClassSession { /* inalterado */ }
model ClassAttendance { /* inalterado */ }
model AiGeneration { /* inalterado */ }
model WhatsappLog { /* inalterado */ }

// StudySession REMOVIDO
```

### 7.3 pgvector + tsvector

Continuam managed via raw SQL em migrations, mesmo formato atual. Trigger de `search_vector` mantido.

---

## 8. Backend API

### 8.1 Adicionados

| Método | Path | Descrição |
|---|---|---|
| `GET` | `/me/home` | Agrega hero + today + days + streak + feed num request |
| `GET` | `/me/cohort` | Feed ambiente + ranking condicional ao flag do ciclo |
| `GET` | `/me/retro/current` | Retrô atual se janela aberta |
| `POST` | `/me/retro` | Submit retrô |
| `GET` | `/admin/triage` | Alertas computados + cohort strip + cycle info |
| `POST` | `/admin/alerts/dismiss` | Snooze alerta 24h |
| `GET` | `/admin/member/:id/plan-context` | Contexto do panel 1 |
| `GET` | `/admin/member/:id/timeline` | Outcomes + reflexões por item |
| `GET` | `/admin/member/:id/retros` | Retrôs do membro |
| `GET` | `/admin/member/:id/notes` | AdminNotes |
| `POST` | `/admin/member/:id/notes` | Criar nota |
| `GET/POST/PATCH/DELETE` | `/admin/topics` | CRUD topics |
| `PATCH` | `/cycles/:id` | Inclui toggle `rankingVisibleToMembers` |

### 8.2 Modificados

- `POST /plans/:id/publish` — scheduler agora lê Google Calendar free/busy de verdade (fix do bug em `publication.service.ts`); eventos criados com `ICS ID: <planId>/<itemId>` na descrição.
- `POST /plans/:id/items/:itemId/done` e `/stuck` → **substituídos por** `PATCH /plans/:id/items/:itemId/outcome` body `{ outcome, reflection? }`.
- `POST /ai/draft-plan` — prompt enhanced, tool calling `search_library` implementado.

### 8.3 Removidos

- `/sessions/*` — entidade desapareceu.
- `GET /me/today` — nunca chegou a existir; `/me/home` cobre.
- `GET /me/week` — substituído por `/me/home` e `/me/plan` (endpoint reusa parte da mesma query).

### 8.4 Crons

- `reminders.cron.ts` **reescrito**: a cada minuto, lê Google Calendar de cada `User` com `whatsappPhone` não-null, filtra eventos com descrição começando em `ICS ID:`, janela `now+9m` a `now+11m`, manda WhatsApp. Sem consulta a `StudySession` (não existe mais).
- `whatsapp-purge.cron.ts` **novo**: 1x/dia, deleta `WhatsappLog` com `sentAt < now - 90d`.
- `retro-reminder.cron.ts` **novo**: sex 18h local por timezone, marca retrô como aberto (estado computed; endpoint `/me/retro/current` usa relógio).

---

## 9. Frontend — kill list · keep list

### 9.1 Matar inteiro

**Frontend:**
- `apps/web/components/member/map-3d/**` — 21 arquivos, 3D abandonado.
- `apps/web/components/member/map-2d/**` — trilha 2D.
- `apps/web/components/member/world-select.tsx`, `plan-dock.tsx`, `stats-sidebar.tsx`, `stats-banner-mobile.tsx`, `map-viewport.tsx`, `bottom-tab-bar.tsx` (atual), `no-cycle-screen.tsx`.
- `apps/web/app/dev/map-3d/**`.
- `apps/web/app/(app)/me/**` (estava em shell errado — migra pra `(member)`).
- `apps/web/components/ai/context-chat.tsx` — chat cortado do MVP.
- `apps/web/app/test-modal/**` (teste dev, não faz parte do produto).

**Backend:**
- `apps/api/src/scheduler/study-session.*` (se existir como arquivo separado) — entidade removida.
- `apps/api/src/ai/chat.*` — não importado/exposto; mantido em pasta separada `_deferred/` ou deletado.

### 9.2 Manter intacto

**Backend:**
- `apps/api/src/auth/**`, `common/**`, `library/**`, `google-calendar/**`.
- `apps/api/src/ai/draft-plan.service.ts`, `brief-plan.service.ts`, `diagnose.service.ts` — ajustes no prompt e tool calling, não rewrite.

**Frontend:**
- `apps/web/app/page.tsx` (landing pública) + `apps/web/components/landing/**`.
- `apps/web/app/privacy/page.tsx`.
- `apps/web/app/auth/callback/page.tsx`, `apps/web/app/login/page.tsx`.

### 9.3 Manter com ajuste

- `apps/api/src/scheduler/scheduler.service.ts` — algoritmo greedy preserva; `publication.service.ts` passa free/busy real.
- `apps/api/src/weekly-plans/**` — troca `status+stuck+rating` por `outcome`; adiciona lógica de `carriedFromItemId`.
- `apps/api/src/availability/**` — coleta `whatsappPhone`.
- `apps/api/src/notifications/reminders.cron.ts` — reescrito pra parser ICS ID.
- `apps/web/tailwind.config.ts` — tokens novos, fontes novas, paleta.
- `apps/web/app/layout.tsx` — `<link>` das 4 fontes.
- `CLAUDE.md` — atualizar regra "pt-BR everywhere" → "UI em inglês, user content em pt-BR"; documentar dual-serif system.

---

## 10. Implementação — phasing em 4 PRs

Cada PR é shippable (nenhum deixa a plataforma quebrada).

### PR 1 · Domain + kill list (~1 semana)

- Prisma migration consolidada:
  - Criar `Topic`, `WeeklyRetro`, `AdminNote`, `DismissedAlert` tables.
  - Adicionar `User.whatsappPhone`, `Cycle.rankingVisibleToMembers`, `CycleMembership.track`, `LibraryItem.topicId`, `LibraryItem.tracks`.
  - Migrar `WeeklyPlanItem`: criar `outcome ItemOutcome`, popular a partir de `status+stuck+rating`, drop os 3 campos antigos.
  - Adicionar `WeeklyPlanItem.carriedFromItemId`.
  - Drop `StudySession` table.
- Backend: atualizar services pra novo outcome, remover refs a StudySession.
- Kill frontend dead code (ver §9.1).
- **Deploy:** plataforma em staging parcialmente visível (UI velha, schema novo). Não prod ainda.

### PR 2 · Design system + Member experience (~2 semanas)

- Tailwind config: tokens, 4 fontes (Newsreader, Source Serif 4, Inter, IBM Plex Mono) via Google Fonts `<link>`.
- Novo shell `(member)` + topbar flutuante + bottom tab (mobile).
- Telas: `/me`, `/me/plan`, `/me/item/[id]`, `/me/cohort`, `/me/retro`, `/me/settings`, `/me/onboarding`.
- Endpoints: `/me/home`, `/me/cohort`, `/me/retro/*`.
- Playwright baseline visual (desktop + mobile) das 6 telas.
- **Deploy prod:** membros ganham experiência nova completa. Admin ainda tem UI velha.

### PR 3 · Admin experience (~2 semanas)

- Novo shell `(admin)` + sidebar.
- Telas: `/admin`, `/admin/cycle/[id]`, `/admin/member/[id]`, `/admin/library`, `/admin/cycles`, `/admin/ai-usage`.
- **Plan editor 3-panel** (`/admin/member/[id]/plan/[planId]`) — Source Serif 4, search inline, budget badge, carry-over checkboxes.
- Scheduler fix: `publication.service.ts` passa free/busy real pro scheduler; eventos criados com `ICS ID:` embedded.
- Reminders cron reescrito (parser ICS ID do Calendar).
- Topic CRUD UI.
- Endpoints: `/admin/triage`, `/admin/alerts/dismiss`, `/admin/member/:id/plan-context`, `/admin/member/:id/timeline|retros|notes`, `/admin/topics`, `PATCH /cycles/:id` com toggle.
- **Deploy prod:** sistema completo. Admin tem ferramenta de trabalho funcional.

### PR 4 · IA depth + polish (~1 semana)

- Tool calling `search_library` na DraftPlan.
- BriefPlan modal + DiagnoseUseCase no panel 1 + member detail.
- Retro window computation.
- Alert computation afinado (critérios finos, testes de edge cases).
- Playwright e2e dos fluxos críticos (F-M1, F-A1 descritos em §3.3).
- WhatsApp purge cron.
- README atualizado.
- **Deploy prod:** v1.0.

**Total: ~6 semanas se serial. ~4 semanas se PRs 2 e 3 em paralelo (overlap baixo).**

---

## 11. Fora de escopo

- **Chat IA contextual** (admin-side) — código preservado, UI não exposta; se houver demanda, v1.1.
- **Toggle "modo leve" pro membro** (localStorage) — não relevante pois 3D foi removido.
- **Sons, animações celebratórias** — design magazine não grita; sem confete, sem badges.
- **Mobile do admin** — admin é desktop-only por design; mobile admin é item futuro.
- **Multi-admin** — só existe 1 admin (Diretor Educacional); sem sistema de permissão inter-admin.
- **Notificações push web** — WhatsApp + calendar são suficientes pro MVP.
- **Timer de estudo live** — avaliado e rejeitado (fricção > benefício).
- **Busca full-text nos retrôs** — v1.1 se admin precisar.
- **Exportação avançada de ciclo** (PDF) — endpoint existe, UI simples é suficiente.

---

## 12. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| **ICS ID parse quebrar se admin apagar evento no Calendar manualmente** | Cron lida com graceful: se `ICS ID:` faltar em evento, ignora e não manda reminder. Tolerância total. |
| **Scheduler com free/busy novo pode overflow mais** (porque agora respeita compromissos reais) | Plan editor mostra budget badge âmbar/vermelho antes do publish. Admin vê antes de enfiar um plano impossível. |
| **Membro muda phone, não atualiza settings, reminders falham silenciosamente** | Alert `CALENDAR_BROKEN` ganha variante `WHATSAPP_BROKEN` se >3 reminders falham em sequência pro mesmo user. |
| **IA gera rationale genérico** | Prompt força citar 1 dado concreto (outcome específico ou frase do retrô). Playwright mock test valida. |
| **Outcome enum migration corrompe dados existentes** | Sem usuários atuais, migration é destrutiva OK. Caso contrário seria backfill condicional. |
| **Dual-serif inflaciona bundle** | 4 fontes × 2 variable axes = ~180KB. Aceitável pra magazine polish; alternativa seria subsetting mas não vale complexidade no MVP. |

---

## 13. Observabilidade e qualidade

- **Logs:** pino → stdout → Docker logs (mantido).
- **Sentry:** free tier pra erros; redaction de campos sensíveis (reflexões, retrôs, notes, tokens) via `LogCleanerInterceptor`.
- **Playwright visual baseline:** 6 telas membro + 6 telas admin × (desktop + mobile onde aplicável) = ~18-24 snapshots.
- **Playwright e2e:** F-M1 (membro daily loop) + F-A1 (admin Sunday ritual) + autenticação.
- **Testes unit (jest):** lógica de alert computation, outcome enum transitions, budget calculation, carry-over selection, ICS ID parsing.

---

## 14. Apêndice · referências

- Spec original: `docs/superpowers/specs/2026-04-11-ics-select-design.md` — design da plataforma.
- Specs arquivados (direções exploradas):
  - `2026-04-12-design-system.md`, `2026-04-12-admin-redesign.md`, `2026-04-12-landing-page.md`, `2026-04-12-member-experience-redesign.md`.
  - `2026-04-16-member-map-3d-redesign-design.md` — 3D map (cortado).
- Sketches visuais desta sessão: `.superpowers/brainstorm/54910-1776385449/content/`.

**Próximo passo:** gerar plano de implementação detalhado (invocar skill `writing-plans`).
