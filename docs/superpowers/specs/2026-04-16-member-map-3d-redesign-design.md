# Member Map Redesign — Mundo 3D Top-Down (Overcooked + Bruno Simon)

**Data:** 2026-04-16
**Escopo:** Substituir a tela `/map` do membro por um mapa 3D top-down estilo Overcooked, com carrinho dirigível, nodes hexagonais posicionados no mundo, e troca de planos via dock persistente. Mobile e desktop estreito mantêm o mapa 2D atual como fallback. O redesign é puramente frontend + um endpoint novo no backend.

---

## 1. Objetivos e não-objetivos

### Objetivos

- Transformar `/map` numa experiência imersiva estilo mini-diorama Overcooked, mantendo a semântica atual (plano semanal → nodes → feedback).
- Permitir que o membro troque rapidamente entre qualquer plano do seu histórico (incluindo planos passados de ciclos anteriores), abrindo sempre no plano ativo por padrão.
- Corrigir o bug atual em que selecionar um mundo não-ativo renderiza uma tela vazia (`map/page.tsx:98`).
- Manter 100% da lógica de feedback (Consegui/Travei/Tive dúvidas) e dos endpoints existentes.

### Não-objetivos

- Mudanças no admin, em ciclos, no scheduler, ou na IA.
- Gamificação nova além do visual (sem XP, sem achievements, sem leaderboard).
- Multiplayer, física realista, sons, ou conteúdo procedural por plano.
- Sequência obrigatória de nodes — qualquer node continua marcável a qualquer momento.

---

## 2. Experiência do usuário

### 2.1 Desktop (≥ 1024px, WebGL disponível) — **Mapa 3D**

A tela `/map` carrega um mundo 3D full-viewport com:

- **Câmera ortográfica top-down inclinada** (~50° no eixo X, fixa). Nunca gira; faz _soft follow_ do carrinho (lerp factor 0.08) para manter o carro enquadrado sem "perseguir" violentamente.
- **Terreno ondulado** (plane 400×400 com função de altura `heightAt(x, z)`), colorido em verde warm com flat shading.
- **Path amarelo** (ribbon extrudado ao longo de um Catmull-Rom spline) conectando os N nodes do plano atual.
- **Nodes hexagonais** posicionados nos pontos do spline. Três estados:
  - **Done**: hex verde com borda escura, ícone ✓ em sprite. Oscila em Y levemente.
  - **Active** (= primeiro pendente por `order`, ou `null` se todos concluídos): hex indigo `#6366F1` com emissive 0.55, disco de glow embaixo pulsando, flutua mais forte. Badge com o número do node.
  - **Pending** (não é o ativo mas ainda não concluído): hex cinza frio com borda mais escura, emissive 0, badge com número. Todos pendentes são clicáveis — não há bloqueio sequencial, o "next pending" só recebe destaque visual.
- **Carrinho** kart low-poly (indigo/coral, body+cab+nose+4 rodas+bandeira) spawnado com um offset de (+4, +4) do primeiro node pendente ao carregar. Se o plano não tem pendentes, spawn no primeiro node (done mais antigo). Rodas giram proporcional à velocidade.
- **Decoração**: ~140 árvores de tamanhos aleatórios (fora do path, cones sobre cilindros), ~6 montanhas cônicas em coral/laranja nas bordas, ~18 cristais octaédricos flutuando com emissive, ~6 nuvens cruzando o céu, um sol visual no canto. Sombras suaves via `PCFSoftShadowMap` com shadow camera de 280 unidades.
- **Céu** via `scene.background` creme + `Fog` coral para desvanecer o horizonte distante.

#### Controles

| Input | Ação |
|---|---|
| `W` / `↑` | Mover para cima (Z−) |
| `S` / `↓` | Mover para baixo (Z+) |
| `A` / `←` | Mover para esquerda (X−) |
| `D` / `→` | Mover para direita (X+) |
| `E` | Entrar no node mais próximo (raio 5 unidades) — apenas se estiver em modo follow |
| `Esc` | Sair do modo focus de volta ao follow |

Movimento é **direcional (não tank-style)**: W/A/S/D definem um vetor em _screen space_. O carro acelera suave (`accel = 40`, `maxSpeed = 24`), desacelera por fricção (`16`) e rotaciona o modelo para apontar na direção do vetor com lerp angular. Velocidade é clampada por um raio mundo de 140 unidades.

#### Modo focus

Ao apertar `E` com um node elegível:

1. Câmera transita de _follow_ para _focus_: interpola `position` para `node + offset(-12, 30, 18)` e `target` para o node (lerp 0.1 por frame).
2. Input do carrinho fica bloqueado.
3. Um **card DOM** (`position: fixed; right: 24px`) desliza entrando da direita com:
   - Badge de plataforma + duração estimada.
   - Título e descrição do `libraryItem`.
   - Link externo para o material.
   - Três botões: **Consegui** (verde), **Travei** (amarelo), **Tive dúvidas** (vermelho coral).
4. Cliques nos botões chamam o mesmo endpoint de hoje (`PATCH /items/:itemId/completion` — usa a mutation existente). Após sucesso, fecha o card, volta para _follow_, atualiza o node no React state → o mesh reidrata para `done`.
5. `Esc` fecha sem feedback.

#### Plan Dock (dock lateral persistente)

Substitui o `WorldSelect` atual. Fica à esquerda, sempre visível, vertical:

- Header "Mundos" minúsculo.
- Um tile por plano semanal do membro (ordenado cronologicamente por `weekStart` ascendente). Cada tile mostra:
  - "Semana" + número (ordinal dentro do ciclo).
  - Barra de progresso fina (% de items `DONE`).
  - Status: "Concluído", "Atual", "Em breve" (planos com `weekStart > hoje`), "Disponível" (planos com `publishedAt` mas que não são o ativo nem totalmente concluídos).
- Tile **carregado no momento** (= o que o mapa 3D/2D está exibindo) cresce 4%, ganha borda indigo + box-shadow glow, desloca 6px pra direita. Este é um estado visual diferente de "status = Atual": o usuário pode estar visualizando uma Semana 2 concluída enquanto a Semana 3 continua sendo a "Atual" (etiqueta). A etiqueta descreve a realidade temporal; o destaque descreve o que está na tela.
- Tile hover → desliza 4px à direita + sombra.
- Clique em qualquer tile não-ativo:
  1. Dispara mutation de "carregamento": fade 300ms com overlay `Carregando Semana N…`.
  2. React Query busca `GET /me/plans/:id` (novo endpoint), prefetch na hover também.
  3. Com a resposta, `SceneManager` chama `loadPlanData(plan)` — troca os nodes/path no cenário (mantém terreno, car, decoração).
  4. Atualiza HUD do topo com nome do mundo + range de datas + ciclo.
- Tile de plano **futuro** (weekStart > hoje) fica `opacity: 0.55` e não é clicável.
- Planos de ciclos passados também aparecem (sem filtro por ciclo ativo) — se hoje o membro está na `Turma 2026.2` semana 3, ainda vê Turma 2026.1 inteira no dock. Identificação por semana é chronological; o nome do ciclo aparece como subtítulo do tile maior (ativo).

#### HUD topo (centrado)

Pill `rgba(255,255,255,0.9)` com backdrop-blur:

- Linha 1: "Mundo · Semana N (atual)" ou "Mundo · Semana N".
- Linha 2: range de datas + "X/Y nodes · Turma Z".

#### Barra de controles (centrada, inferior)

Pill fina com teclas: `W A S D` dirigir · `E` entrar node · `Esc` sair.

#### Ergonomia visual

- Zoom inicial: `frustumSize = 50` na `OrthographicCamera` (os demos usam 55; 50 dá leve aproximação conforme feedback do usuário).
- Tween de driving: mais "pé leve" que os demos (`accel = 44`, `friction = 14`, resposta angular mais rápida). O ajuste fino fica pra fase de polish.

### 2.2 Mobile / viewport estreito / sem WebGL — **Mapa 2D (fallback)**

O componente `MapViewport` faz detecção no mount:

```ts
const use3D = window.innerWidth >= 1024
  && hasWebGL()
  && localStorage.getItem('ics:map3d') !== 'off';
```

- **`hasWebGL()`**: cria um canvas temporário e tenta obter contexto `webgl2` ou `webgl`, retornando booleano.
- Em caso negativo, renderiza `<Map2D>` — que é o componente atual (`node-map.tsx` + `map-node.tsx` + `map-path.tsx` + `map-decorations.tsx`), renomeado e movido para `components/member/map-2d/`. Nada muda visualmente no fallback.
- O `WorldSelect` atual e o state `view === 'worlds'` são removidos da rota; o dock de planos substitui. No 2D, o dock fica horizontal no topo (scroll horizontal), ainda com os mesmos tiles.

### 2.3 Toggle "Modo leve" (desktop)

Por ora, só a chave `localStorage.ics:map3d = 'off'` desliga o 3D e cai no 2D — serve para QA e para o próprio usuário que abra o console. Expor um switch no menu do avatar é item futuro (ver §11).

---

## 3. Arquitetura

### 3.1 Stack escolhido

- **React Three Fiber** (`@react-three/fiber@8`) como camada declarativa sobre Three.js.
- **@react-three/drei** com imports específicos (sem barrel import) — usamos só `<OrthographicCamera>`, `<Sparkles>` se necessário. Tree-shaking mantém bundle ~80KB além do Three core.
- **three@0.160**.
- **zustand** para estado volátil da cena 3D (posição do carro, modo da câmera, node em foco) — evita re-renders caros no React tree quando são mudanças internas do loop.

Bundle total da feature: Three (150KB) + R3F (35KB) + drei seletivo (~45KB) + zustand (3KB) = ~**230KB gzip**. Carregado via `next/dynamic` com `ssr: false` — bundle só baixa em desktop elegível.

### 3.2 Estrutura de arquivos

```
apps/web/components/member/
├── map-2d/
│   ├── node-map.tsx                (mantido; renomeado de components/member/node-map.tsx)
│   ├── map-node.tsx                (mantido)
│   ├── map-path.tsx                (mantido)
│   ├── map-decorations.tsx         (mantido)
│   └── platform-colors.ts          (mantido)
├── map-3d/
│   ├── index.tsx                   — React component; carrega via dynamic import
│   ├── scene.tsx                   — <Canvas> + <Suspense> + cena completa
│   ├── scene-store.ts              — zustand store (cameraMode, carPosition, focusedNodeId)
│   ├── terrain.tsx                 — ground mesh + heightAt export
│   ├── nodes.tsx                   — renderiza nodes do plano ativo
│   ├── node-mesh.tsx               — componente único de node (hex)
│   ├── path.tsx                    — ribbon ao longo do spline
│   ├── car.tsx                     — modelo + controller
│   ├── camera-rig.tsx              — ortográfica + follow/focus
│   ├── props.tsx                   — árvores, montanhas, cristais, nuvens, sol
│   ├── focus-card.tsx              — card DOM que aparece em modo focus
│   ├── hud.tsx                     — HUD topo + controles
│   ├── input.ts                    — hook useKeyboard (mapeia keys para store)
│   └── capabilities.ts             — hasWebGL(), shouldUse3D()
├── plan-dock.tsx                   — dock lateral/topo (2D ou 3D usam o mesmo)
└── map-viewport.tsx                — switcher 2D vs 3D; ponto de entrada
```

### 3.3 Fluxo de dados

```
/map/page.tsx
  └─ TanStack Query:
     ├─ useQuery('me-plans-summary')      → Array<PlanSummary> (hoje já existe)
     └─ useQuery('me-plan', activePlanId) → PlanFull (endpoint novo)

  └─ <MapViewport>
        ├─ se use3D: <Map3D planData={plan} onItemComplete={mutation} />
        └─ senão:    <Map2D planId={plan.id} items={plan.items} />
```

- `activePlanId` (= plano atualmente carregado na viewport, distinto da "semana atual" do membro) vem de estado local do page. Inicializa com `currentPlans[0].id` de `/me/week` (plano ativo hoje; array porque a API devolve `Plan[]` mesmo tendo sempre no máximo 1 item no caso comum). Muda quando o usuário clica num tile diferente do Plan Dock.
- Prefetch na hover de tile: `queryClient.prefetchQuery(['me-plan', planId], ...)`.
- `<Map3D>` recebe `planData` como prop; seu `useEffect` detecta mudança de `planData.id` e chama `loadPlan(planData)` no scene-store → componentes de nodes/path re-renderizam, terreno/car permanecem.

### 3.4 Ciclo de vida da cena

- Canvas R3F mount: inicia render loop, carrega terrain e props estáticos.
- Carrinho é instanciado uma vez; preserva posição entre trocas de plano (mas teletransporta para perto do novo node ativo com fade).
- Nodes e path re-renderizam a cada mudança de `planData`.
- Canvas unmount (navigate away): R3F cuida do dispose automaticamente.
- WebGL context loss: listener `webglcontextlost` → renderiza fallback 2D temporariamente + toast "Algo deu errado, voltando ao mapa simples".

---

## 4. Backend

### 4.1 Novo endpoint

**`GET /me/plans/:id`** — retorna o plano semanal completo do membro autenticado.

**Controller** (`apps/api/src/weekly-plans/weekly-plans.controller.ts`):

```ts
@Get('/me/plans/:id')
async getMyPlan(@CurrentUser() user: JwtUser, @Param('id') id: string) {
  return this.weeklyPlansService.getPlanForMember(user.sub, id);
}
```

**Service** (`weekly-plans.service.ts`):

- Carrega o `WeeklyPlan` por id com `include: { items: { include: { libraryItem: true, sessions: true } }, cycle: true }`.
- Verifica ownership: `plan.userId === user.sub` ou role ADMIN. Se não, `ForbiddenException`.
- Shape de retorno idêntico ao que `/me/week` já devolve, mas só um plano (não array).

### 4.2 Nenhuma outra mudança

- `/me/plans` (summary) continua existindo e alimenta o dock de tiles.
- `PATCH /items/:itemId/completion` e rotas de auto-schedule permanecem idênticas.
- Nenhuma migration, nenhuma mudança em Prisma.

---

## 5. Design visual

### 5.1 Paleta

Herda do design system atual. O 3D usa:

| Elemento | Cor |
|---|---|
| Terreno | `#6EE7B7` (verde menta) |
| Path | `#FBBF24` (amarelo warm) |
| Node done (body) | `#10B981` emissive `#065F46` |
| Node active (body) | `#6366F1` emissive `#4F46E5` |
| Node pending (body) | `#D6D3D1` emissive `#000` |
| Montanhas | `#F97316`, `#EA580C`, `#FB923C` (variações coral) |
| Árvores (tronco / topo) | `#78350F` / `#065F46` |
| Cristais decorativos | rotação: `#8B5CF6`, `#F97316`, `#FBBF24`, `#EC4899`, `#4F46E5` |
| Céu | `#FEE9D2` (creme morno) |
| Fog | `#FDBA74`, 100→220 de distância |

### 5.2 Geometria dos nodes

Hexágono prismático via `ExtrudeGeometry` a partir de uma `Shape` hex (raio 2.2, 6 vértices), profundidade 1.4, bevel size/thickness 0.22, 2 bevelSegments. Uma `ring` abaixo 12% maior, profundidade 0.5, sem bevel, cor mais escura (edge).

**Refinamentos visuais para a fase de polish (não bloqueia implementação inicial):**

- Estudar substituir a sprite de número por texto 3D extrudado (usando `troika-three-text` ou `<Text3D>` do drei) para melhor legibilidade em ângulos rasos.
- Considerar textura/normal map sutil nas faces laterais do hex para reforçar o facetado (feedback do usuário: "nodes estão feios").
- Ícone da plataforma no topo em vez (ou além) do número — YouTube play, LeetCode square, etc.
- Rim light na aresta superior do hex (material emissive em stripes ou shader custom).

### 5.3 Carrinho

**Placeholder MVP**: kart de box geometries (body indigo, cab coral, nariz coral, 4 rodas cilíndricas dark, bandeira coral numa haste cinza). Implementável em uma tarde.

**Versão final (item separado de polish)**: contratar ou modelar um kart low-poly com personalidade — sugestões:
- Opção 1: Kart fofo tipo Overcooked com personagem visível (chef, estudante).
- Opção 2: Foguete pequeno (aderente ao tema "Big Tech / space").
- Opção 3: Mascote ICS (se houver branding futuro) num skate.

A arquitetura já suporta trocar o modelo: `<Car>` tem um slot `<CarModel>` que pode virar um `<GLTFModel url="/car.glb" />` sem tocar no controller.

### 5.4 Decorações

- Árvore: `CylinderGeometry(0.35s, 0.45s, 1.8s, 6)` (tronco) + `ConeGeometry(1.7s, 3.4s, 6)` (copa). Escala `s = 0.6 + random*0.8`.
- Montanha: `ConeGeometry(h*0.7, h, 5)`, altura 22-38.
- Cristal: `OctahedronGeometry(1.1)` com emissive 0.35, oscila Y + rotação.
- Nuvem: Grupo de 5 esferas `SphereGeometry(2+random, 8, 8)` brancas com flat shading, drift X 0.015 a 0.09 u/frame.

### 5.5 Iluminação

- `DirectionalLight('#FFE4B5', 1.35)` do alto + levemente lateral, `castShadow`, shadow map 2048² , frustum shadow 280 unidades.
- `AmbientLight('#FFF5E6', 0.55)` para não ter áreas pretas.
- `HemisphereLight('#FDBA74' céu, '#34D399' chão, 0.45)` para dar o toque warm-to-green.

---

## 6. Interação detalhada

### 6.1 Raycasting / proximidade

A detecção de node mais próximo usa **distância 2D** (x/z), não raycast:

```ts
const nearest = nodes.reduce((best, n) => {
  const d = Math.hypot(n.position.x - car.x, n.position.z - car.z);
  return d < best.d ? { node: n, d } : best;
}, { node: null, d: Infinity });

if (nearest.d < 5) {
  showPrompt(nearest.node);
}
```

Raio 5 unidades. Sem filtro de status — qualquer node (done, active, pending) pode ser "entrado" para reler o material ou trocar o feedback. Raycast só seria necessário se adicionarmos click direto no node como atalho (polish; não bloqueia).

### 6.2 Transição de câmera para focus

Mantém `useFrame` do R3F; a cada tick, se `mode === 'focus'`:

```ts
const target = focusedNode.position;
const desired = target.clone().add(new Vector3(-12, 30, 18));
camera.position.lerp(desired, 0.1);
cameraLookAt.lerp(target, 0.1);
camera.lookAt(cameraLookAt);
```

O offset `(-12, 30, 18)` deixa o node no terço esquerdo da tela, liberando o terço direito para o card DOM (o card tem width 360 + margin 24, ocupa aproximadamente 1/3 em 1280px+).

### 6.3 Feedback via React Query

Ao clicar Consegui/Travei/Tive dúvidas no focus card:

1. `useMutation` existente é disparada.
2. Optimistic update: node muda status local imediatamente (mesh re-renderiza como done) — fecha o card.
3. Em erro, revert + toast de erro HeroUI (`addToast`).

---

## 7. Performance

### 7.1 Orçamento

- **FPS alvo**: 60 em MacBook Pro 2020+, 30+ em laptops 2018-ish. Se cair abaixo de 30 por 3s sustentado, um hook (via `performance.now()` + média móvel) sugere ativar modo leve via toast: "Sua máquina está trabalhando duro. Desativar mapa 3D? [Desativar] [Continuar]".
- **Tamanho bundle 3D**: ≤ 280KB gzip (three + r3f + drei + zustand + nossos arquivos). CI check via `@next/bundle-analyzer` nas próximas iterações.
- **Tempo até cena interativa**: ≤ 1.5s em conexão boa, ≤ 3s em 4G. Loading overlay com gradient durante o bundle download + primeira render.
- **Draw calls**: alvo < 200 (contei ~120-150 na prototipagem).
- **Memória GPU**: ~50MB estimado (texturas pequenas só pras sprites de número).

### 7.2 Instancing

Árvores, cristais e nuvens podem usar `InstancedMesh` (R3F: `<instancedMesh>`) — reduz ~140 trees para 1 draw call. Fazemos isso direto na primeira implementação; é baixo custo de código.

### 7.3 Shadow map

Sombras são caras. Budget:

- Um único `DirectionalLight` casta sombra. Hemisphere/Ambient não.
- Shadow camera ortho 280 unidades de lado; shadow map 2048². Se for gargalo, reduzimos para 1024² com qualidade aceitável.

---

## 8. Acessibilidade

- **Keyboard**: todas as ações principais têm tecla (WASD, E, Esc). Plan Dock é navegável com Tab/Enter.
- **Reduced motion**: `prefers-reduced-motion: reduce` desativa animações ociosas dos nodes/cristais/nuvens (apenas o ativo ainda sutilmente pulsa, como affordance). Transição de focus vira step (sem lerp).
- **Screen reader**: Canvas tem `aria-label="Mapa 3D de estudo — use WAS D para mover o carrinho"`. Plan Dock, HUD e focus card usam HTML semântico (h2, ul/li, buttons). A lista de nodes é exposta para leitores de tela como tabela invisível (position absolute off-screen) com links equivalentes — permite leitor de tela navegar todos os nodes sem o 3D.
- **Focus ring**: card de foco do 3D tem também foco implícito no primeiro botão pra permitir Enter = Consegui.

---

## 9. Testes

### 9.1 Unit (jest)

- `capabilities.ts`: `hasWebGL()`, `shouldUse3D()` com mocks de `window` e `localStorage`.
- `scene-store.ts`: ações básicas (setCameraMode, setFocusedNode).
- `camera-rig.tsx`: calcular ponto de follow correto dado um vetor de posição do carro.

### 9.2 Integração (Playwright)

- **Existing spec**: `/map` no desktop (≥1024px) continua funcional com mocks de plano simples. Não verificamos visualmente o Three.js (não confiável em headless + WebGL). Verificamos que o canvas renderiza, HUD aparece, Plan Dock abre um plano passado.
- **Novo spec**: `/map` no mobile viewport (375×667) renderiza `Map2D` (não carrega bundle 3D). Snapshot atual do mapa 2D permanece verde.
- **Novo spec**: Toggle `ics:map3d=off` localStorage → mesmo resultado do mobile.

### 9.3 Manual

Checklist pré-merge:

- [ ] Dirigir e chegar em cada node em tempo razoável (~10-15s end-to-end do mapa).
- [ ] Feedback (Consegui) atualiza o node para done no mesmo frame do response.
- [ ] Trocar de plano no dock não faz flash preto, não leak de memória (checar `three.info.memory`).
- [ ] `/map` carrega em < 2s no Wi-Fi.

---

## 10. Plano de migração

Uma vez aprovado, a implementação segue estes marcos (detalhado no plan posterior):

1. **Backend**: endpoint `GET /me/plans/:id` + testes.
2. **Refactor 2D**: mover `node-map.tsx` e filhos para `components/member/map-2d/`. `MapViewport` switcher. Fallback toggle via localStorage.
3. **Plan Dock**: componente compartilhado 2D+3D, já plugado no switcher, substituindo `WorldSelect`.
4. **3D foundation**: R3F instalado, Canvas, terreno, lights, câmera ortográfica, loading.
5. **Car + controls**: modelo box, input keyboard, movement.
6. **Nodes + path**: rendering dos nodes a partir do plano, spline do path.
7. **Focus + feedback**: proximity, E key, card DOM, integração com mutation existente.
8. **Props + polish**: árvores, montanhas, cristais, nuvens (instanced).
9. **A11y + perf**: reduced motion, aria, bundle analyzer, FPS monitor.

Cada marco ≈ 1 PR. Marcos 1-3 são seguros pra deploy mesmo sem o 3D pronto — o switcher simplesmente sempre cai no 2D atual.

---

## 11. Itens em aberto (fora do escopo desta implementação)

- Design refinado dos nodes (texturas, ícones de plataforma, polish de emissão).
- Modelo final do carrinho (GLB customizado).
- Sons (acelerador, buzina ao chegar em node, jingle de completion).
- Variação de terreno/paleta por plano semanal (cada "mundo" visualmente distinto).
- Telemetria (PostHog/Langfuse) capturando uso do 3D vs 2D, tempo em mapa, trocas de plano, etc.
- Item no menu do avatar para toggle persistente "mapa simples" (UI no dropdown, hoje só via localStorage manual).
