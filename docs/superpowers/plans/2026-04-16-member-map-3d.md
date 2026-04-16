# Member Map 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `/map` do membro por um mapa 3D top-down estilo Overcooked com carrinho dirigível, Plan Dock persistente pra trocar entre planos semanais, e fallback 2D para mobile/sem-WebGL. Spec: `docs/superpowers/specs/2026-04-16-member-map-3d-redesign-design.md`.

**Architecture:** React Three Fiber (R3F) + drei + zustand, carregados via `next/dynamic` só em desktop ≥1024px. O componente `MapViewport` decide entre `<Map2D>` (existente, renomeado) e `<Map3D>` (novo). `PlanDock` compartilhado consome `/me/plans` e troca o plano carregado via `useQuery(['plan', id])` batendo em `/plans/:id` (endpoint já existente).

**Tech Stack:** Next.js 15 App Router, React 18, TanStack Query 5, HeroUI 2, Tailwind 3, Framer Motion 11, three@0.160, @react-three/fiber@8, @react-three/drei@9, zustand@4.

**Important context:**
- O web package não tem framework de unit tests (nem vitest nem jest). A verificação para o código web é: `pnpm --filter @ics-select/web typecheck` + inspeção manual no dev server (`pnpm dev` + http://localhost:3000/map após login). Somente o backend usa jest (e aqui o backend não muda).
- Fontshare (Satoshi) já está no layout. Indigo `#4F46E5`, Coral `#F97316`, Creme `#FAFAF7` são os tokens do design system.
- HeroUI depende de um path específico no Tailwind `content` (ver CLAUDE.md) — não mexer.
- Cada fase abaixo fecha um PR independente. A Fase 1 sozinha já corrige o bug atual (plano não-ativo vazio) e pode ser deployed sem o 3D pronto.

---

## File structure final

**Criar:**
- `apps/web/components/member/map-2d/` (diretório) — com todos os arquivos movidos de `components/member/`
- `apps/web/components/member/map-3d/` (diretório) — novo
- `apps/web/components/member/map-viewport.tsx` — switcher
- `apps/web/components/member/plan-dock.tsx` — dock lateral/horizontal
- `apps/web/lib/capabilities.ts` — `hasWebGL()`, `shouldUse3D()`
- `apps/web/lib/queries/plan.ts` — hook `usePlan(id)`

**Modificar:**
- `apps/web/app/(member)/map/page.tsx` — orquestra MapViewport + PlanDock
- `apps/web/package.json` — deps novas (fase 2+)

**Deletar:**
- `apps/web/components/member/world-select.tsx`
- `apps/web/components/member/world-card.tsx`

**Arquivos movidos (fase 1):**
- `components/member/node-map.tsx` → `components/member/map-2d/node-map.tsx`
- `components/member/map-node.tsx` → `components/member/map-2d/map-node.tsx`
- `components/member/map-path.tsx` → `components/member/map-2d/map-path.tsx`
- `components/member/map-decorations.tsx` → `components/member/map-2d/map-decorations.tsx`
- `components/member/node-hover-card.tsx` → `components/member/map-2d/node-hover-card.tsx`
- `components/member/node-expanded-card.tsx` → `components/member/map-2d/node-expanded-card.tsx`
- `components/member/platform-colors.ts` → `components/member/map-2d/platform-colors.ts`

---

# Fase 1 — Refactor 2D + Plan Dock + MapViewport

**Fecha um PR por si só.** Corrige o bug existente em `map/page.tsx:98` (plano não-ativo renderiza vazio) através do novo fluxo de dados do `PlanDock` + `usePlan`, e deixa a base pronta pro 3D.

### Task 1.1: Criar diretório `map-2d/` e mover arquivos

**Files:**
- Mover 7 arquivos existentes para `apps/web/components/member/map-2d/`

- [ ] **Step 1:** Criar o diretório

```bash
mkdir -p /Users/daviduarte/development/personal/ics-select/apps/web/components/member/map-2d
```

- [ ] **Step 2:** Mover arquivos (preserva git history com `git mv`)

```bash
cd /Users/daviduarte/development/personal/ics-select
git mv apps/web/components/member/node-map.tsx apps/web/components/member/map-2d/node-map.tsx
git mv apps/web/components/member/map-node.tsx apps/web/components/member/map-2d/map-node.tsx
git mv apps/web/components/member/map-path.tsx apps/web/components/member/map-2d/map-path.tsx
git mv apps/web/components/member/map-decorations.tsx apps/web/components/member/map-2d/map-decorations.tsx
git mv apps/web/components/member/node-hover-card.tsx apps/web/components/member/map-2d/node-hover-card.tsx
git mv apps/web/components/member/node-expanded-card.tsx apps/web/components/member/map-2d/node-expanded-card.tsx
git mv apps/web/components/member/platform-colors.ts apps/web/components/member/map-2d/platform-colors.ts
```

- [ ] **Step 3:** Atualizar imports dentro de `map-2d/` (irmãos agora estão no mesmo dir, a relative `./` já cobre — mas pode haver casos `../`)

Os arquivos movidos importam entre si via `./map-node`, `./map-path`, etc. Como estão todos no mesmo novo diretório, nenhum import precisa mudar. Confirme com:

```bash
grep -rn "from '\.\./" apps/web/components/member/map-2d/
```

Esperado: zero matches que quebrariam. Se algum import usar `../../lib/...`, deve virar `../../../lib/...` (subiu um nível). Ajustar ad-hoc.

- [ ] **Step 4:** Atualizar o único consumidor externo — `apps/web/app/(member)/map/page.tsx`

Encontrar `import { NodeMap } from '../../../components/member/node-map';` e trocar pra `'../../../components/member/map-2d/node-map';`. Idem qualquer outro import desses arquivos. (Só esse um consumidor no codebase — conferimos com grep.)

```bash
grep -rn "components/member/\(node-map\|map-node\|map-path\|map-decorations\|node-hover-card\|node-expanded-card\|platform-colors\)" apps/web/ --include="*.tsx" --include="*.ts" | grep -v map-2d/
```

Esperado: zero matches (todos os imports já aponam pra `map-2d/` após o Step 4). Consertar manualmente qualquer ocorrência restante.

- [ ] **Step 5:** Verificar typecheck

```bash
cd /Users/daviduarte/development/personal/ics-select
pnpm --filter @ics-select/web typecheck
```

Esperado: exit 0, zero erros.

- [ ] **Step 6:** Commit

```bash
git add -A
git commit -m "refactor(web): move member map files to map-2d/ subfolder

Prep work for introducing the 3D map alongside the existing 2D one.
No behavior change.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Criar `lib/capabilities.ts`

**Files:**
- Create: `apps/web/lib/capabilities.ts`

- [ ] **Step 1:** Escrever o módulo

```ts
// apps/web/lib/capabilities.ts

export function hasWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

export function shouldUse3DMap(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < 1024) return false;
  if (localStorage.getItem('ics:map3d') === 'off') return false;
  return hasWebGL();
}
```

- [ ] **Step 2:** Typecheck

```bash
pnpm --filter @ics-select/web typecheck
```

Esperado: exit 0.

- [ ] **Step 3:** Smoke test manual (opcional — apenas se quiser verificar antes de commit)

Com `pnpm --filter @ics-select/web dev` rodando, abrir http://localhost:3000 e no console:

```js
const { hasWebGL, shouldUse3DMap } = await import('/lib/capabilities.ts'); // não funciona via console
```

Não dá pra importar direto — só verificar via uso no MapViewport (Task 1.4). Pode pular.

- [ ] **Step 4:** Commit

```bash
git add apps/web/lib/capabilities.ts
git commit -m "feat(web): add capabilities helper for WebGL detection

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3: Criar hook `usePlan(id)`

Consome `GET /plans/:id` (endpoint já existente). Usado pelo MapViewport pra buscar o plano carregado quando não é o ativo.

**Files:**
- Create: `apps/web/lib/queries/plan.ts`

- [ ] **Step 1:** Escrever o hook

```ts
// apps/web/lib/queries/plan.ts
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type PlanItem = {
  id: string;
  status: 'PENDING' | 'DONE';
  stuck: boolean;
  completionStatus?: 'DONE' | 'STUCK' | 'DOUBTS' | null;
  feedback?: string | null;
  order: number;
  libraryItem: {
    id: string;
    title: string;
    description?: string | null;
    estimatedMinutes: number;
    url: string | null;
    format: string;
  };
  sessions: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
};

export type Plan = {
  id: string;
  status: string;
  weekStart: string;
  weekEnd: string;
  userId: string;
  cycleId: string;
  items: PlanItem[];
};

export function usePlan(id: string | null) {
  return useQuery({
    queryKey: ['plan', id],
    queryFn: () => apiFetch<Plan>(`/plans/${id}`),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function usePrefetchPlan() {
  const qc = useQueryClient();
  return (id: string) =>
    qc.prefetchQuery({
      queryKey: ['plan', id],
      queryFn: () => apiFetch<Plan>(`/plans/${id}`),
      staleTime: 30_000,
    });
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/lib/queries/plan.ts
git commit -m "feat(web): add usePlan/usePrefetchPlan query hooks

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.4: Criar `MapViewport` (switcher 2D/3D; por ora só 2D)

O switcher decide 2D vs 3D. Nesta fase sempre retorna 2D — prepara o terreno pra Fase 2 plugar o 3D trocando uma ramificação.

**Files:**
- Create: `apps/web/components/member/map-viewport.tsx`

- [ ] **Step 1:** Escrever o componente

```tsx
// apps/web/components/member/map-viewport.tsx
'use client';

import { useEffect, useState } from 'react';
import { shouldUse3DMap } from '../../lib/capabilities';
import { NodeMap } from './map-2d/node-map';
import type { Plan } from '../../lib/queries/plan';

interface MapViewportProps {
  plan: Plan;
}

export function MapViewport({ plan }: MapViewportProps) {
  const [use3D, setUse3D] = useState(false);

  useEffect(() => {
    setUse3D(shouldUse3DMap());
    const onResize = () => setUse3D(shouldUse3DMap());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Fase 1: 3D ainda não existe — sempre cai no 2D.
  if (use3D) {
    // placeholder; será substituído pelo dynamic import em Task 2.3
    return <NodeMap planId={plan.id} items={plan.items} />;
  }
  return <NodeMap planId={plan.id} items={plan.items} />;
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-viewport.tsx
git commit -m "feat(web): introduce MapViewport 2D/3D switcher (2D-only for now)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.5: Criar `PlanDock`

Dock lateral com tiles por plano. Substitui o `WorldSelect`.

**Files:**
- Create: `apps/web/components/member/plan-dock.tsx`

- [ ] **Step 1:** Escrever o componente

```tsx
// apps/web/components/member/plan-dock.tsx
'use client';

import { useMemo } from 'react';
import { usePrefetchPlan } from '../../lib/queries/plan';

export type PlanSummary = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  cycle: { name: string };
  items: Array<{ id: string; status: string }>;
};

interface PlanDockProps {
  plans: PlanSummary[];
  loadedPlanId: string | null;
  activePlanId: string | null;
  onSelect: (planId: string) => void;
  orientation?: 'vertical' | 'horizontal';
}

function statusOf(plan: PlanSummary, activePlanId: string | null): 'done' | 'active' | 'upcoming' | 'available' {
  const now = Date.now();
  const start = new Date(plan.weekStart).getTime();
  if (start > now) return 'upcoming';
  if (plan.id === activePlanId) return 'active';
  const done = plan.items.filter((i) => i.status === 'DONE').length;
  if (done === plan.items.length && plan.items.length > 0) return 'done';
  return 'available';
}

export function PlanDock({
  plans, loadedPlanId, activePlanId, onSelect, orientation = 'vertical',
}: PlanDockProps) {
  const prefetch = usePrefetchPlan();

  const sorted = useMemo(
    () => [...plans].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    [plans],
  );

  const numberByPlan = useMemo(() => {
    const map = new Map<string, number>();
    const byCycle = new Map<string, PlanSummary[]>();
    for (const p of sorted) {
      const arr = byCycle.get(p.cycle.name) ?? [];
      arr.push(p);
      byCycle.set(p.cycle.name, arr);
    }
    for (const [, arr] of byCycle) arr.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [sorted]);

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={
        isVertical
          ? 'fixed left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2'
          : 'w-full overflow-x-auto py-2 flex gap-2 snap-x'
      }
    >
      {isVertical && (
        <div className="text-[9px] font-bold text-foreground-muted tracking-widest uppercase text-center mb-1">
          Mundos
        </div>
      )}
      {sorted.map((p) => {
        const s = statusOf(p, activePlanId);
        const isLoaded = p.id === loadedPlanId;
        const done = p.items.filter((i) => i.status === 'DONE').length;
        const total = p.items.length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        const weekNum = numberByPlan.get(p.id) ?? 0;
        const clickable = s !== 'upcoming';

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => clickable && onSelect(p.id)}
            onMouseEnter={() => clickable && prefetch(p.id)}
            disabled={!clickable}
            className={[
              'w-[76px] min-w-[76px] rounded-xl px-[6px] py-2 text-center transition-all snap-center',
              'bg-white/90 backdrop-blur shadow-sm border-2',
              isLoaded ? 'border-brand scale-[1.04] translate-x-[6px] shadow-glow-primary' : 'border-transparent',
              clickable && !isLoaded ? 'hover:translate-x-1 hover:shadow-md cursor-pointer' : '',
              s === 'upcoming' ? 'opacity-55 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <div className="text-[10px] font-semibold text-foreground-muted">Semana</div>
            <div className={[
              'text-[13px] font-extrabold mt-0.5',
              s === 'done' && !isLoaded ? 'text-success' : '',
              isLoaded ? 'text-brand' : '',
              s === 'upcoming' ? 'text-foreground-muted' : 'text-foreground',
            ].join(' ')}>{weekNum}</div>
            <div className="h-1 bg-stone-200 rounded-full mt-1.5 overflow-hidden">
              <div
                className={['h-full rounded-full transition-all', isLoaded ? 'bg-brand' : 'bg-success'].join(' ')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className={[
              'text-[9px] mt-1 font-semibold tracking-wide',
              isLoaded ? 'text-brand' : s === 'done' ? 'text-success' : 'text-foreground-muted',
            ].join(' ')}>
              {s === 'done' ? 'Concluído' : s === 'active' ? 'Atual' : s === 'upcoming' ? 'Em breve' : 'Disponível'}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/plan-dock.tsx
git commit -m "feat(web): add PlanDock component (replaces WorldSelect)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.6: Reescrever `/map/page.tsx` usando MapViewport + PlanDock

Substitui `view === 'worlds'` + `WorldSelect`. Corrige o bug `displayPlan = null` quando o plano selecionado não é o ativo.

**Files:**
- Modify: `apps/web/app/(member)/map/page.tsx`

- [ ] **Step 1:** Reescrever o page (código completo):

```tsx
// apps/web/app/(member)/map/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addToast } from '@heroui/react';
import { CalendarPlus, Map as MapIcon } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';
import { MapViewport } from '../../../components/member/map-viewport';
import { PlanDock, type PlanSummary } from '../../../components/member/plan-dock';
import { StatsSidebar } from '../../../components/member/stats-sidebar';
import { StatsBannerMobile } from '../../../components/member/stats-banner-mobile';
import { usePlan, type Plan } from '../../../lib/queries/plan';

function formatDateRange(weekStart: string, weekEnd: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `${fmt.format(new Date(weekStart))} a ${fmt.format(new Date(weekEnd))}`;
  } catch {
    return '';
  }
}

export default function MapPage() {
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: weekPlans, isLoading: loadingWeek } = useQuery({
    queryKey: ['me-week'],
    queryFn: () => apiFetch<Plan[]>('/me/week'),
  });

  const { data: allPlans } = useQuery({
    queryKey: ['me-plans'],
    queryFn: () => apiFetch<PlanSummary[]>('/me/plans'),
  });

  const activePlanId = weekPlans?.[0]?.id ?? null;

  // Inicializa loadedPlanId com o plano ativo, mas sem forçar override se o usuário já trocou
  useEffect(() => {
    if (loadedPlanId === null && activePlanId !== null) {
      setLoadedPlanId(activePlanId);
    }
  }, [activePlanId, loadedPlanId]);

  const isLoadedActive = loadedPlanId === activePlanId;
  const { data: loadedPlanFull } = usePlan(isLoadedActive ? null : loadedPlanId);
  const displayPlan: Plan | undefined = isLoadedActive ? weekPlans?.[0] : loadedPlanFull;

  const autoSchedule = useMutation({
    mutationFn: (planId: string) =>
      apiFetch<{ sessionsCreated: number; overflow: Array<unknown> }>(
        `/plans/${planId}/auto-schedule`,
        { method: 'POST' },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['me-week'] });
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      addToast({
        title: 'Sessões agendadas',
        description: `${data.sessionsCreated} sessão${data.sessionsCreated === 1 ? '' : 'ões'} criada${data.sessionsCreated === 1 ? '' : 's'} na sua agenda.`,
        color: 'success',
      });
    },
    onError: (err: Error) => {
      addToast({ title: 'Erro ao alocar', description: err.message, color: 'danger' });
    },
  });

  if (loadingWeek) {
    return <p className="text-sm text-foreground-muted p-8">Carregando seu mapa...</p>;
  }

  if (!activePlanId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <MapIcon className="h-16 w-16 text-foreground-subtle mb-4" />
        <h2 className="text-lg font-bold text-foreground">Nenhum plano ativo</h2>
        <p className="text-sm text-foreground-muted mt-2">
          Aguarde o administrador publicar o próximo plano semanal.
        </p>
      </div>
    );
  }

  if (!displayPlan) {
    return <p className="text-sm text-foreground-muted p-8">Carregando mundo...</p>;
  }

  const done = displayPlan.items.filter((i) => i.status === 'DONE').length;
  const total = displayPlan.items.length;
  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(displayPlan.weekEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--map-bg-start))] to-[hsl(var(--map-bg-end))]">
      <StatsBannerMobile done={done} total={total} daysRemaining={daysRemaining} streak={0} />

      {/* Vertical dock — desktop */}
      {allPlans && <div className="hidden lg:block">
        <PlanDock
          plans={allPlans}
          loadedPlanId={loadedPlanId}
          activePlanId={activePlanId}
          onSelect={setLoadedPlanId}
          orientation="vertical"
        />
      </div>}

      <div className="flex gap-6 px-4 lg:pl-28 lg:pr-8 py-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-foreground">Mapa de Estudo</h1>
              <p className="text-sm text-foreground-muted">
                {formatDateRange(displayPlan.weekStart, displayPlan.weekEnd)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => autoSchedule.mutate(displayPlan.id)}
              disabled={autoSchedule.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-primary"
            >
              <CalendarPlus className="h-4 w-4" />
              {autoSchedule.isPending ? 'Alocando...' : 'Alocar Automaticamente'}
            </button>
          </div>

          {/* Horizontal dock — mobile */}
          {allPlans && <div className="lg:hidden mb-4">
            <PlanDock
              plans={allPlans}
              loadedPlanId={loadedPlanId}
              activePlanId={activePlanId}
              onSelect={setLoadedPlanId}
              orientation="horizontal"
            />
          </div>}

          <MapViewport plan={displayPlan} />
        </div>
        <StatsSidebar done={done} total={total} daysRemaining={daysRemaining} streak={0} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Typecheck

```bash
pnpm --filter @ics-select/web typecheck
```

Esperado: exit 0.

- [ ] **Step 3:** Smoke manual

Iniciar dev: `pnpm --filter @ics-select/web dev`. Logar e acessar `/map`. Checar:
- Mapa 2D renderiza normalmente (igual antes).
- Dock esquerdo aparece em desktop com os planos.
- Clicar em um plano concluído no dock troca a visualização (antes mostrava tela vazia — bug corrigido).
- Plano ativo volta ao clicar no tile correspondente.

- [ ] **Step 4:** Commit

```bash
git add apps/web/app/\(member\)/map/page.tsx
git commit -m "fix(web): rewrite /map page using MapViewport + PlanDock

Corrige bug em que selecionar um plano não-ativo no WorldSelect
renderizava tela vazia (displayPlan = null). Agora usePlan busca o
shape completo via GET /plans/:id quando o plano não é o ativo.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.7: Remover `WorldSelect` e `WorldCard`

**Files:**
- Delete: `apps/web/components/member/world-select.tsx`
- Delete: `apps/web/components/member/world-card.tsx`

- [ ] **Step 1:** Conferir que não há mais consumidores

```bash
grep -rn "WorldSelect\|WorldCard\|world-select\|world-card" apps/web/ --include="*.tsx" --include="*.ts"
```

Esperado: zero matches. Se algum aparecer, consertar antes de remover.

- [ ] **Step 2:** Remover

```bash
git rm apps/web/components/member/world-select.tsx apps/web/components/member/world-card.tsx
```

- [ ] **Step 3:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git commit -m "chore(web): remove obsolete WorldSelect/WorldCard components

Substituídos pelo PlanDock em Task 1.5–1.6.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**Checkpoint Fase 1:** Dev server em `/map` deve mostrar o dock lateral, permitir trocar entre planos (incluindo plannos passados sem tela vazia). 2D visualmente inalterado. PR fechável aqui.

---

# Fase 2 — 3D Foundation

Adiciona R3F, Canvas, terreno, lights, câmera ortográfica + loading. MapViewport passa a servir o 3D quando `shouldUse3DMap()` retorna true.

### Task 2.1: Instalar dependências 3D

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml` (gerado)

- [ ] **Step 1:** Adicionar deps

```bash
cd /Users/daviduarte/development/personal/ics-select
pnpm add -w --filter @ics-select/web three@^0.160.0 @react-three/fiber@^8.17.0 @react-three/drei@^9.114.0 zustand@^4.5.0
pnpm add -w --filter @ics-select/web --save-dev @types/three@^0.160.0
```

- [ ] **Step 2:** Conferir que `pnpm install` completou sem warnings críticos e que `pnpm --filter @ics-select/web typecheck` ainda passa.

```bash
pnpm --filter @ics-select/web typecheck
```

Esperado: exit 0.

- [ ] **Step 3:** Commit

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add three, @react-three/fiber, drei, zustand

Fundação para o mapa 3D do membro.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.2: Criar `scene-store.ts` (zustand)

**Files:**
- Create: `apps/web/components/member/map-3d/scene-store.ts`

- [ ] **Step 1:** Criar diretório

```bash
mkdir -p apps/web/components/member/map-3d
```

- [ ] **Step 2:** Escrever o store

```ts
// apps/web/components/member/map-3d/scene-store.ts
import { create } from 'zustand';

export type CameraMode = 'follow' | 'focus';

export interface SceneState {
  cameraMode: CameraMode;
  focusedNodeId: string | null;
  nearestNodeId: string | null;
  keys: Record<string, boolean>;
  setMode: (mode: CameraMode) => void;
  setFocusedNode: (id: string | null) => void;
  setNearestNode: (id: string | null) => void;
  setKey: (key: string, pressed: boolean) => void;
  reset: () => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  cameraMode: 'follow',
  focusedNodeId: null,
  nearestNodeId: null,
  keys: {},
  setMode: (mode) => set({ cameraMode: mode }),
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  setNearestNode: (id) => set({ nearestNodeId: id }),
  setKey: (key, pressed) =>
    set((s) => ({ keys: { ...s.keys, [key.toLowerCase()]: pressed } })),
  reset: () => set({ cameraMode: 'follow', focusedNodeId: null, nearestNodeId: null, keys: {} }),
}));
```

- [ ] **Step 3:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/scene-store.ts
git commit -m "feat(web): add zustand scene store for map-3d

Estado compartilhado: modo câmera, node em foco, node mais próximo,
estado do teclado.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.3: Criar `terrain.tsx`

**Files:**
- Create: `apps/web/components/member/map-3d/terrain.tsx`

- [ ] **Step 1:** Escrever o componente

```tsx
// apps/web/components/member/map-3d/terrain.tsx
'use client';

import { useMemo } from 'react';
import { PlaneGeometry } from 'three';

export function heightAt(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  const base = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 1.8;
  const ridge = Math.sin((x + z) * 0.04) * 0.7;
  const rim = d > 80 ? (d - 80) * 0.18 : 0;
  return base + ridge + rim;
}

export function Terrain() {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(400, 400, 120, 120);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, heightAt(pos.getX(i), pos.getY(i)));
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color="#6EE7B7" flatShading roughness={0.95} />
    </mesh>
  );
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/terrain.tsx
git commit -m "feat(web/map-3d): add Terrain component with heightAt helper

Plane 400x400 warped com função analítica. Exportada pra ser reusada
por nodes/path/car/props que precisam da altura do chão.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.4: Criar `camera-rig.tsx`

**Files:**
- Create: `apps/web/components/member/map-3d/camera-rig.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/camera-rig.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useSceneStore } from './scene-store';

const CAM_OFFSET_FOLLOW = new Vector3(0, 70, 55);
const CAM_OFFSET_FOCUS = new Vector3(-12, 30, 18);

interface CameraRigProps {
  carPositionRef: React.MutableRefObject<Vector3>;
  nodePositions: Map<string, Vector3>;
}

export function CameraRig({ carPositionRef, nodePositions }: CameraRigProps) {
  const { camera, size } = useThree();
  const target = useRef(new Vector3(0, 0, 0));
  const mode = useSceneStore((s) => s.cameraMode);
  const focusedId = useSceneStore((s) => s.focusedNodeId);

  useEffect(() => {
    const frustum = 50;
    const aspect = size.width / size.height;
    if ('isOrthographicCamera' in camera && (camera as unknown as { isOrthographicCamera: boolean }).isOrthographicCamera) {
      (camera as unknown as { left: number; right: number; top: number; bottom: number; updateProjectionMatrix: () => void }).left = -frustum * aspect;
      (camera as unknown as { left: number; right: number; top: number; bottom: number; updateProjectionMatrix: () => void }).right = frustum * aspect;
      (camera as unknown as { left: number; right: number; top: number; bottom: number; updateProjectionMatrix: () => void }).top = frustum;
      (camera as unknown as { left: number; right: number; top: number; bottom: number; updateProjectionMatrix: () => void }).bottom = -frustum;
      (camera as unknown as { left: number; right: number; top: number; bottom: number; updateProjectionMatrix: () => void }).updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  useFrame(() => {
    if (mode === 'follow') {
      target.current.lerp(carPositionRef.current, 0.08);
      camera.position.copy(target.current).add(CAM_OFFSET_FOLLOW);
      camera.lookAt(target.current);
    } else if (mode === 'focus' && focusedId) {
      const nodePos = nodePositions.get(focusedId);
      if (nodePos) {
        target.current.lerp(nodePos, 0.1);
        const desired = nodePos.clone().add(CAM_OFFSET_FOCUS);
        camera.position.lerp(desired, 0.1);
        camera.lookAt(nodePos);
      }
    }
  });

  return null;
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/camera-rig.tsx
git commit -m "feat(web/map-3d): add CameraRig with follow/focus modes

Ortho projection atualizada on resize; soft follow do carro; zoom
cinematográfico no node em foco com offset que libera o lado direito
pro focus card DOM.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.5: Criar `scene.tsx` (Canvas + cena estática + câmera)

**Files:**
- Create: `apps/web/components/member/map-3d/scene.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/scene.tsx
'use client';

import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { Vector3, Color, Fog } from 'three';
import { Terrain } from './terrain';
import { CameraRig } from './camera-rig';
import type { Plan } from '../../../lib/queries/plan';

interface SceneProps {
  plan: Plan;
}

export function Scene({ plan }: SceneProps) {
  const carPositionRef = useRef(new Vector3(0, 0, 0));
  // Posições dos nodes serão populadas em Fase 3. Por ora, Map vazio.
  const nodePositionsRef = useRef(new Map<string, Vector3>());

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onCreated={({ scene }) => {
        scene.background = new Color('#FEE9D2');
        scene.fog = new Fog('#FDBA74', 100, 220);
      }}
    >
      <OrthographicCamera makeDefault position={[0, 70, 55]} near={0.1} far={400} />
      <CameraRig carPositionRef={carPositionRef} nodePositions={nodePositionsRef.current} />

      {/* Lights */}
      <directionalLight
        position={[60, 90, 30]}
        intensity={1.35}
        color="#FFE4B5"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-camera-far={250}
        shadow-bias={-0.0003}
      />
      <ambientLight color="#FFF5E6" intensity={0.55} />
      <hemisphereLight color="#FDBA74" groundColor="#34D399" intensity={0.45} />

      <Suspense fallback={null}>
        <Terrain />
      </Suspense>
    </Canvas>
  );
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/scene.tsx
git commit -m "feat(web/map-3d): add Scene root component with Canvas + camera + lights

Bg creme + fog coral. Ortho camera. Three lights (directional/ambient/
hemisphere). Terrain plugado. Car/nodes/props virão nas próximas fases.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.6: Criar `index.tsx` (entry Map3D)

**Files:**
- Create: `apps/web/components/member/map-3d/index.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/index.tsx
'use client';

import { useEffect } from 'react';
import { Scene } from './scene';
import { useSceneStore } from './scene-store';
import type { Plan } from '../../../lib/queries/plan';

interface Map3DProps {
  plan: Plan;
}

export default function Map3D({ plan }: Map3DProps) {
  const reset = useSceneStore((s) => s.reset);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  return (
    <div className="fixed inset-0 z-0 bg-[#FEE9D2]">
      <Scene plan={plan} />
    </div>
  );
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/index.tsx
git commit -m "feat(web/map-3d): add Map3D entry component (lazy target)

Full-viewport fixed container envolvendo a Scene. Reset do store no
unmount.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.7: Plugar `Map3D` no `MapViewport` via dynamic import

**Files:**
- Modify: `apps/web/components/member/map-viewport.tsx`

- [ ] **Step 1:** Substituir pelo código completo

```tsx
// apps/web/components/member/map-viewport.tsx
'use client';

import { Suspense, lazy, useEffect, useState } from 'react';
import { shouldUse3DMap } from '../../lib/capabilities';
import { NodeMap } from './map-2d/node-map';
import type { Plan } from '../../lib/queries/plan';

const Map3D = lazy(() => import('./map-3d'));

interface MapViewportProps {
  plan: Plan;
}

export function MapViewport({ plan }: MapViewportProps) {
  const [use3D, setUse3D] = useState(false);

  useEffect(() => {
    setUse3D(shouldUse3DMap());
    const onResize = () => setUse3D(shouldUse3DMap());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (use3D) {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh] text-sm text-foreground-muted">
            Carregando mundo 3D…
          </div>
        }
      >
        <Map3D plan={plan} />
      </Suspense>
    );
  }
  return <NodeMap planId={plan.id} items={plan.items} />;
}
```

- [ ] **Step 2:** Typecheck

```bash
pnpm --filter @ics-select/web typecheck
```

Esperado: exit 0.

- [ ] **Step 3:** Smoke manual em desktop (≥1024px)

`pnpm --filter @ics-select/web dev`. Abrir `/map`. Deve carregar o Canvas + terreno verde + fog coral. Ainda sem carro, sem nodes — só o cenário base. Se `localStorage.setItem('ics:map3d', 'off')` e reload, cai no 2D.

- [ ] **Step 4:** Commit

```bash
git add apps/web/components/member/map-viewport.tsx
git commit -m "feat(web): wire Map3D into MapViewport via lazy import

3D carrega só em desktop ≥1024px com WebGL e sem o toggle ics:map3d=off.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**Checkpoint Fase 2:** Mapa 3D renderiza em `/map` com terreno e luzes. Nada interativo ainda. PR fechável.

---

# Fase 3 — Path + Nodes

### Task 3.1: Criar `path.tsx` (ribbon spline)

**Files:**
- Create: `apps/web/components/member/map-3d/path.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/path.tsx
'use client';

import { useMemo } from 'react';
import { BufferGeometry, BufferAttribute, CatmullRomCurve3, DoubleSide, Vector3 } from 'three';
import { heightAt } from './terrain';

const PATH_POINTS_TEMPLATE = [
  [-65,  55], [-35, 45], [-10, 28], [ 20, 12],
  [ 42, -8], [ 28, -38], [ -5, -52], [-38, -48],
  [-55, -30], [-65, 0], [-60, 30], [-70, 55],
];

export function usePathPoints(count: number): Vector3[] {
  return useMemo(() => {
    const pts = PATH_POINTS_TEMPLATE.slice(0, Math.max(2, count)).map(([x, z]) => {
      const v = new Vector3(x, 0, z);
      v.y = heightAt(x, z) + 0.18;
      return v;
    });
    return pts;
  }, [count]);
}

interface PathProps {
  points: Vector3[];
}

export function Path({ points }: PathProps) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.4);
    const segs = 280;
    const width = 3;
    const verts: number[] = [];
    const uvs: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPoint(t);
      p.y = heightAt(p.x, p.z) + 0.14;
      const tg = curve.getTangent(t);
      const n = new Vector3(-tg.z, 0, tg.x).normalize();
      const L = p.clone().addScaledVector(n,  width);
      const R = p.clone().addScaledVector(n, -width);
      verts.push(L.x, L.y, L.z, R.x, R.y, R.z);
      uvs.push(0, t, 1, t);
    }
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
    g.setAttribute('uv',       new BufferAttribute(new Float32Array(uvs), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [points]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#FBBF24" roughness={0.7} side={DoubleSide} />
    </mesh>
  );
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/path.tsx
git commit -m "feat(web/map-3d): add Path ribbon following Catmull-Rom spline

Lê até 12 pontos predefinidos. Hook usePathPoints(count) adapta ao
número real de nodes do plano. Height do terreno é amostrada para o
ribbon aderir à topografia.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.2: Criar `node-mesh.tsx` (hex individual)

**Files:**
- Create: `apps/web/components/member/map-3d/node-mesh.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/node-mesh.tsx
'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, CircleGeometry, ExtrudeGeometry, Shape, SpriteMaterial, Vector3, Group, Mesh } from 'three';

export type NodeVisualStatus = 'done' | 'active' | 'pending';

const R = 2.2;

const COLORS: Record<NodeVisualStatus, { body: string; edge: string; emi: string; ei: number }> = {
  done:    { body: '#10B981', edge: '#065F46', emi: '#065F46', ei: 0.15 },
  active:  { body: '#6366F1', edge: '#3730A3', emi: '#4F46E5', ei: 0.55 },
  pending: { body: '#D6D3D1', edge: '#78716C', emi: '#000000', ei: 0 },
};

function buildHexShape(): Shape {
  const s = new Shape();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 2;
    const x = Math.cos(a) * R;
    const y = Math.sin(a) * R;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function buildLabelTexture(status: NodeVisualStatus, number: number): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = status === 'pending' ? '#57534E' : 'white';
  ctx.font = 'bold 84px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (status === 'done') {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(36, 66);
    ctx.lineTo(58, 90);
    ctx.lineTo(94, 40);
    ctx.stroke();
  } else {
    ctx.fillText(String(number), 64, 70);
  }
  const t = new CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

interface NodeMeshProps {
  position: Vector3;
  status: NodeVisualStatus;
  number: number;
  isNearest: boolean;
}

export function NodeMesh({ position, status, number, isNearest }: NodeMeshProps) {
  const groupRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const baseY = position.y + 1.2;

  const hexShape = useMemo(() => buildHexShape(), []);
  const bodyGeo = useMemo(() => {
    const g = new ExtrudeGeometry(hexShape, {
      depth: 1.4, bevelEnabled: true, bevelSize: 0.22, bevelThickness: 0.22, bevelSegments: 2,
    });
    g.translate(0, 0, -0.7);
    return g;
  }, [hexShape]);
  const ringGeo = useMemo(() => new ExtrudeGeometry(hexShape, { depth: 0.5, bevelEnabled: false }), [hexShape]);
  const glowGeo = useMemo(() => new CircleGeometry(5, 32), []);

  const labelMaterial = useMemo(() => {
    const tex = buildLabelTexture(status, number);
    return new SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  }, [status, number]);

  const c = COLORS[status];

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = performance.now() * 0.001;
    if (status === 'active') {
      groupRef.current.position.y = baseY + Math.sin(t * 2) * 0.25;
      if (glowRef.current) {
        const s = 1 + Math.sin(t * 2.5) * 0.15;
        glowRef.current.scale.setScalar(s);
        const mat = glowRef.current.material as { opacity: number };
        mat.opacity = 0.22 + Math.abs(Math.sin(t * 2.5)) * 0.18;
      }
    } else if (status === 'done') {
      groupRef.current.rotation.y = Math.sin(t * 0.4 + number) * 0.04;
    }
    const scaleTarget = isNearest ? 1.15 : 1;
    const current = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(current + (scaleTarget - current) * Math.min(1, delta * 10));
  });

  return (
    <group ref={groupRef} position={[position.x, baseY, position.z]}>
      {/* Body */}
      <mesh geometry={bodyGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial
          color={c.body}
          emissive={c.emi}
          emissiveIntensity={c.ei}
          metalness={0.3}
          roughness={0.4}
          flatShading
        />
      </mesh>
      {/* Ring (edge darker) */}
      <mesh
        geometry={ringGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.35, 0]}
        scale={[1.12, 1.12, 1]}
        castShadow
      >
        <meshStandardMaterial color={c.edge} flatShading />
      </mesh>
      {/* Label sprite */}
      <sprite material={labelMaterial} scale={[2.8, 2.8, 1]} position={[0, 1, 0]} />
      {/* Glow for active */}
      {status === 'active' && (
        <mesh ref={glowRef} geometry={glowGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.65, 0]}>
          <meshBasicMaterial color="#6366F1" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/node-mesh.tsx
git commit -m "feat(web/map-3d): add NodeMesh component with done/active/pending

Hex prism extrudado + ring escuro + sprite label (check para done,
número para active/pending). Animação de flutuação no active, rotação
sutil no done, escala up no nearest.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.3: Criar `nodes.tsx` (layout de nodes do plano)

**Files:**
- Create: `apps/web/components/member/map-3d/nodes.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/nodes.tsx
'use client';

import { useMemo, useEffect } from 'react';
import { Vector3 } from 'three';
import { NodeMesh, type NodeVisualStatus } from './node-mesh';
import { usePathPoints } from './path';
import { useSceneStore } from './scene-store';
import type { PlanItem } from '../../../lib/queries/plan';

function statusOf(item: PlanItem, index: number, items: PlanItem[]): NodeVisualStatus {
  if (item.status === 'DONE') return 'done';
  const firstPending = items.findIndex((i) => i.status === 'PENDING');
  if (firstPending === index) return 'active';
  return 'pending';
}

interface NodesProps {
  items: PlanItem[];
  onPositions?: (map: Map<string, Vector3>) => void;
}

export function Nodes({ items, onPositions }: NodesProps) {
  const ordered = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);
  const points = usePathPoints(ordered.length);
  const nearestId = useSceneStore((s) => s.nearestNodeId);

  const positions = useMemo(() => {
    const map = new Map<string, Vector3>();
    ordered.forEach((it, i) => {
      if (points[i]) map.set(it.id, points[i].clone().setY(points[i].y + 1.2));
    });
    return map;
  }, [ordered, points]);

  useEffect(() => {
    onPositions?.(positions);
  }, [positions, onPositions]);

  return (
    <>
      {ordered.map((item, i) => {
        const p = points[i];
        if (!p) return null;
        return (
          <NodeMesh
            key={item.id}
            position={p}
            status={statusOf(item, i, ordered)}
            number={i + 1}
            isNearest={item.id === nearestId}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 2:** Plugar Path + Nodes em `scene.tsx`

```tsx
// Edit apps/web/components/member/map-3d/scene.tsx
// Add imports:
import { Path, usePathPoints } from './path';
import { Nodes } from './nodes';
// Inside the Suspense, after <Terrain />:
<PathAndNodes plan={plan} nodePositionsRef={nodePositionsRef} />
```

E extrair um helper `PathAndNodes` dentro do mesmo arquivo (embaixo de `Scene`):

```tsx
function PathAndNodes({ plan, nodePositionsRef }: { plan: Plan; nodePositionsRef: React.MutableRefObject<Map<string, Vector3>> }) {
  const points = usePathPoints(plan.items.length);
  return (
    <>
      <Path points={points} />
      <Nodes items={plan.items} onPositions={(m) => { nodePositionsRef.current = m; }} />
    </>
  );
}
```

- [ ] **Step 3:** Typecheck + smoke manual

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web dev
```

Em `/map` (desktop), deve ver terreno + caminho amarelo em S + nodes hex indicando progresso. Sem interação ainda.

- [ ] **Step 4:** Commit

```bash
git add apps/web/components/member/map-3d/nodes.tsx apps/web/components/member/map-3d/scene.tsx
git commit -m "feat(web/map-3d): render plan nodes + path in the 3D scene

Nodes posicionados por order ao longo do spline; status visual
derivado do PlanItem.status + firstPending heurística.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**Checkpoint Fase 3:** Mapa 3D mostra terreno + path + nodes corretos do plano carregado. Trocar plano no Plan Dock deve atualizar os nodes.

---

# Fase 4 — Car + Controls

### Task 4.1: Criar `input.ts` (hook de teclado)

**Files:**
- Create: `apps/web/components/member/map-3d/input.ts`

- [ ] **Step 1:** Escrever

```ts
// apps/web/components/member/map-3d/input.ts
'use client';

import { useEffect } from 'react';
import { useSceneStore } from './scene-store';

export function useKeyboard() {
  const setKey = useSceneStore((s) => s.setKey);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Previne scroll da página com setas
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      setKey(e.key, true);
    };
    const up = (e: KeyboardEvent) => setKey(e.key, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setKey]);
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/input.ts
git commit -m "feat(web/map-3d): add useKeyboard hook piping keys into scene store

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.2: Criar `car.tsx` (modelo + controller)

**Files:**
- Create: `apps/web/components/member/map-3d/car.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/car.tsx
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Vector3 } from 'three';
import { heightAt } from './terrain';
import { useSceneStore } from './scene-store';

const MAX_SPEED = 24;
const ACCEL = 44;
const FRICTION = 14;
const WORLD_RADIUS = 140;

interface CarProps {
  positionRef: React.MutableRefObject<Vector3>;
  spawnPosition: Vector3;
}

export function Car({ positionRef, spawnPosition }: CarProps) {
  const groupRef = useRef<Group>(null);
  const wheelsRef = useRef<Mesh[]>([]);
  const state = useRef({ speed: 0, angle: 0 });
  const initialized = useRef(false);
  const mode = useSceneStore((s) => s.cameraMode);

  if (!initialized.current) {
    positionRef.current.copy(spawnPosition);
    initialized.current = true;
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const keys = useSceneStore.getState().keys;

    if (mode === 'follow') {
      let dx = 0, dz = 0;
      if (keys['w'] || keys['arrowup'])    dz -= 1;
      if (keys['s'] || keys['arrowdown'])  dz += 1;
      if (keys['a'] || keys['arrowleft'])  dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;
      const mag = Math.hypot(dx, dz);
      if (mag > 0) {
        dx /= mag; dz /= mag;
        state.current.speed = Math.min(MAX_SPEED, state.current.speed + ACCEL * dt);
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - state.current.angle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        state.current.angle += diff * Math.min(1, dt * 8);
        positionRef.current.x += dx * state.current.speed * dt;
        positionRef.current.z += dz * state.current.speed * dt;
      } else {
        state.current.speed = Math.max(0, state.current.speed - FRICTION * dt);
      }
      positionRef.current.y = heightAt(positionRef.current.x, positionRef.current.z) + 0.5;
      const d = Math.hypot(positionRef.current.x, positionRef.current.z);
      if (d > WORLD_RADIUS) {
        positionRef.current.x *= WORLD_RADIUS / d;
        positionRef.current.z *= WORLD_RADIUS / d;
        state.current.speed = 0;
      }
    }

    groupRef.current.position.copy(positionRef.current);
    groupRef.current.rotation.y = state.current.angle;
    wheelsRef.current.forEach((w) => { if (w) w.rotation.x += state.current.speed * dt * 2; });
  });

  const addWheel = (el: Mesh | null, i: number) => {
    if (el) wheelsRef.current[i] = el;
  };

  return (
    <group ref={groupRef}>
      {/* body */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[2, 0.7, 3]} />
        <meshStandardMaterial color="#4F46E5" flatShading metalness={0.4} roughness={0.4} />
      </mesh>
      {/* cab */}
      <mesh position={[0, 1.5, -0.2]} castShadow>
        <boxGeometry args={[1.6, 0.7, 1.5]} />
        <meshStandardMaterial color="#F97316" flatShading />
      </mesh>
      {/* nose */}
      <mesh position={[0, 0.9, 1.7]}>
        <boxGeometry args={[1.4, 0.4, 0.5]} />
        <meshStandardMaterial color="#F97316" flatShading />
      </mesh>
      {/* wheels */}
      {([ [-1.1, 0.5, 1], [1.1, 0.5, 1], [-1.1, 0.5, -1], [1.1, 0.5, -1] ] as const).map(([x, y, z], i) => (
        <mesh key={i} ref={(el) => addWheel(el, i)} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.4, 10]} />
          <meshStandardMaterial color="#1F2937" flatShading />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 2:** Plugar `<Car>` no `scene.tsx`

Modificar `scene.tsx` adicionando o import e uso:

```tsx
// imports
import { Car } from './car';
import { useKeyboard } from './input';
// ...

// No componente Scene, antes do return, computar spawn:
function computeSpawn(plan: Plan): Vector3 {
  const firstPending = plan.items.findIndex((i) => i.status === 'PENDING');
  const idx = firstPending >= 0 ? firstPending : 0;
  // Usar o mesmo template do path — import usePathPoints para manter consistência
  // Spawn = ponto N do path + offset (4, 0, 4)
  const points = [
    [-65,  55], [-35, 45], [-10, 28], [ 20, 12],
    [ 42, -8], [ 28, -38], [ -5, -52], [-38, -48],
    [-55, -30], [-65, 0], [-60, 30], [-70, 55],
  ];
  const [x, z] = points[idx] ?? points[0];
  const sx = x + 4, sz = z + 4;
  return new Vector3(sx, heightAt(sx, sz) + 0.5, sz);
}
```

Adicionar antes do Canvas um hook:

```tsx
export function Scene({ plan }: SceneProps) {
  useKeyboard();
  const carPositionRef = useRef(new Vector3(0, 0, 0));
  const nodePositionsRef = useRef(new Map<string, Vector3>());
  const spawn = useMemo(() => computeSpawn(plan), [plan]);
  // ... resto igual, mas no Suspense:
  <Suspense fallback={null}>
    <Terrain />
    <PathAndNodes plan={plan} nodePositionsRef={nodePositionsRef} />
    <Car positionRef={carPositionRef} spawnPosition={spawn} />
  </Suspense>
  // ...
}
```

Lembre de importar `heightAt`, `useMemo`, `Vector3`.

- [ ] **Step 3:** Typecheck + smoke manual

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web dev
```

Em `/map`, dirigir o carro com WASD. Câmera deve seguir suavemente. Não deve sair do raio 140.

- [ ] **Step 4:** Commit

```bash
git add apps/web/components/member/map-3d/car.tsx apps/web/components/member/map-3d/scene.tsx
git commit -m "feat(web/map-3d): add driveable car with directional WASD input

Kinematic controller direcional (screen-space). Aceleração/fricção
sensíveis. Y amarra à heightAt. Spawn offset do primeiro pendente.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**Checkpoint Fase 4:** Você dirige o carrinho pelo mapa 3D. Câmera segue. Sem focus ainda.

---

# Fase 5 — Focus mode + Feedback

### Task 5.1: Criar `hud.tsx` (HUD topo + prompt)

**Files:**
- Create: `apps/web/components/member/map-3d/hud.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/hud.tsx
'use client';

import { useSceneStore } from './scene-store';
import type { Plan } from '../../../lib/queries/plan';

interface HudProps {
  plan: Plan;
}

function formatRange(start: string, end: string): string {
  try {
    const f = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${f.format(new Date(start))} — ${f.format(new Date(end))}`;
  } catch { return ''; }
}

export function Hud({ plan }: HudProps) {
  const nearestId = useSceneStore((s) => s.nearestNodeId);
  const mode = useSceneStore((s) => s.cameraMode);
  const done = plan.items.filter((i) => i.status === 'DONE').length;

  return (
    <>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur rounded-xl px-4 py-2 shadow pointer-events-none text-center">
        <div className="text-sm font-bold text-foreground">Mapa de Estudo</div>
        <div className="text-[11px] text-foreground-muted">
          {formatRange(plan.weekStart, plan.weekEnd)} · {done}/{plan.items.length} nodes
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur rounded-full px-4 py-2 shadow pointer-events-none text-[11px] text-foreground-secondary">
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">W</kbd>
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">A</kbd>
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">S</kbd>
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">D</kbd>
        {' '}dirigir ·{' '}
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">E</kbd>
        {' '}entrar node ·{' '}
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">Esc</kbd>
        {' '}sair
      </div>

      {nearestId && mode === 'follow' && (
        <div className="fixed top-[38%] left-1/2 -translate-x-1/2 z-30 bg-brand/95 backdrop-blur rounded-full px-4 py-2.5 text-white font-bold text-sm shadow-lg pointer-events-none">
          Pressione{' '}
          <kbd className="bg-white text-brand px-2 py-0.5 rounded font-bold mx-1">E</kbd>
          {' '}para iniciar
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2:** Plugar HUD em `Map3D` (index.tsx)

```tsx
// apps/web/components/member/map-3d/index.tsx — acrescentar
import { Hud } from './hud';
// No return, depois de Scene:
<Hud plan={plan} />
```

- [ ] **Step 3:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/hud.tsx apps/web/components/member/map-3d/index.tsx
git commit -m "feat(web/map-3d): add HUD with title, control hints, and prompt

Prompt 'Pressione E' aparece quando nearestId está definido e modo é
follow.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.2: Implementar proximity detection no `Car`

**Files:**
- Modify: `apps/web/components/member/map-3d/car.tsx`

- [ ] **Step 1:** Adicionar prop `nodePositionsRef` (ref, não snapshot) e loop de proximidade

Modificar a signature:

```tsx
interface CarProps {
  positionRef: React.MutableRefObject<Vector3>;
  spawnPosition: Vector3;
  nodePositionsRef: React.MutableRefObject<Map<string, Vector3>>;
}

export function Car({ positionRef, spawnPosition, nodePositionsRef }: CarProps) {
  // ... top-level igual
  const setNearest = useSceneStore((s) => s.setNearestNode);

  useFrame((_, delta) => {
    // ... código existente do movimento

    // Depois do movimento, calcular nearest — leia sempre o Map mais recente
    const nodes = nodePositionsRef.current;
    let minD = Infinity;
    let minId: string | null = null;
    for (const [id, pos] of nodes) {
      const d = Math.hypot(pos.x - positionRef.current.x, pos.z - positionRef.current.z);
      if (d < minD) { minD = d; minId = id; }
    }
    if (minD < 5 && minId && mode === 'follow') {
      setNearest(minId);
    } else {
      setNearest(null);
    }
  });
  // ...
}
```

E atualizar o uso em `scene.tsx`:

```tsx
<Car positionRef={carPositionRef} spawnPosition={spawn} nodePositionsRef={nodePositionsRef} />
```

**Por quê ref e não Map:** o `Nodes` componente substitui o Map em `.current` a cada mudança de plano (`nodePositionsRef.current = newMap`). Se passássemos a snapshot do Map como prop, o `useFrame` do Car manteria closure sobre o Map velho e deixaria de detectar os nodes do novo plano.

- [ ] **Step 2:** Typecheck + smoke manual

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web dev
```

Dirigir até um node. "Pressione E" deve aparecer.

- [ ] **Step 3:** Commit

```bash
git add apps/web/components/member/map-3d/car.tsx apps/web/components/member/map-3d/scene.tsx
git commit -m "feat(web/map-3d): proximity detection sets nearestNodeId in store

Raio 5. Menor distância 2D (x/z). Só em modo follow.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.3: Criar `focus-card.tsx` (card DOM de foco)

**Files:**
- Create: `apps/web/components/member/map-3d/focus-card.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/focus-card.tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addToast } from '@heroui/react';
import { ExternalLink, Check, HelpCircle, X as XIcon } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';
import type { PlanItem } from '../../../lib/queries/plan';

interface FocusCardProps {
  planId: string;
  item: PlanItem;
  onClose: () => void;
}

const FORMATS: Record<string, string> = {
  VIDEO: 'Vídeo', ARTICLE: 'Artigo', BOOK: 'Livro', PROBLEM: 'Problema', CODE: 'Código', OTHER: 'Material',
};

export function FocusCard({ planId, item, onClose }: FocusCardProps) {
  const qc = useQueryClient();

  const mutate = useMutation({
    mutationFn: (completionStatus: 'DONE' | 'STUCK' | 'DOUBTS') =>
      apiFetch(`/plans/${planId}/items/${item.id}/done`, {
        method: 'POST',
        body: JSON.stringify({ completionStatus, feedback: '' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-week'] });
      qc.invalidateQueries({ queryKey: ['me-plans'] });
      qc.invalidateQueries({ queryKey: ['plan'] });
      addToast({ title: 'Anotado!', color: 'success' });
      onClose();
    },
    onError: (e: Error) => addToast({ title: 'Erro', description: e.message, color: 'danger' }),
  });

  return (
    <div
      className="fixed right-6 top-1/2 -translate-y-1/2 z-40 w-[360px] bg-white rounded-2xl p-5 shadow-2xl"
      role="dialog"
      aria-label="Detalhes do node"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 text-stone-400 hover:text-stone-700 text-xs"
        aria-label="Fechar"
      >
        Esc
      </button>
      <span className="inline-block bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-2.5">
        {FORMATS[item.libraryItem.format] ?? 'Material'} · {item.libraryItem.estimatedMinutes}min
      </span>
      <h3 className="text-lg font-bold text-foreground leading-snug">{item.libraryItem.title}</h3>
      {item.libraryItem.description && (
        <p className="text-[13px] text-foreground-secondary mt-2 leading-relaxed">
          {item.libraryItem.description}
        </p>
      )}
      {item.libraryItem.url && (
        <a
          href={item.libraryItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand font-semibold mt-3 hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Abrir material
        </a>
      )}
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => mutate.mutate('DONE')}
          disabled={mutate.isPending}
          className="flex-1 bg-success text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Consegui
        </button>
        <button
          type="button"
          onClick={() => mutate.mutate('STUCK')}
          disabled={mutate.isPending}
          className="flex-1 bg-amber-100 text-amber-800 rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <XIcon className="h-3.5 w-3.5" /> Travei
        </button>
        <button
          type="button"
          onClick={() => mutate.mutate('DOUBTS')}
          disabled={mutate.isPending}
          className="flex-1 bg-red-100 text-red-800 rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <HelpCircle className="h-3.5 w-3.5" /> Dúvidas
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/focus-card.tsx
git commit -m "feat(web/map-3d): add FocusCard with feedback buttons

Reusa o endpoint POST /plans/:planId/items/:itemId/done com os 3
completionStatus. Invalida queries após success.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.4: Handler de `E` + `Esc` no `index.tsx` + mostrar FocusCard

**Files:**
- Modify: `apps/web/components/member/map-3d/index.tsx`

- [ ] **Step 1:** Reescrever

```tsx
// apps/web/components/member/map-3d/index.tsx
'use client';

import { useEffect, useMemo } from 'react';
import { Scene } from './scene';
import { useSceneStore } from './scene-store';
import { Hud } from './hud';
import { FocusCard } from './focus-card';
import type { Plan } from '../../../lib/queries/plan';

interface Map3DProps { plan: Plan; }

export default function Map3D({ plan }: Map3DProps) {
  const reset = useSceneStore((s) => s.reset);
  const nearestId = useSceneStore((s) => s.nearestNodeId);
  const focusedId = useSceneStore((s) => s.focusedNodeId);
  const setMode = useSceneStore((s) => s.setMode);
  const setFocusedNode = useSceneStore((s) => s.setFocusedNode);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const store = useSceneStore.getState();
      if (k === 'e' && store.nearestNodeId && store.cameraMode === 'follow') {
        setFocusedNode(store.nearestNodeId);
        setMode('focus');
      } else if (k === 'escape' && store.cameraMode === 'focus') {
        setFocusedNode(null);
        setMode('follow');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode, setFocusedNode]);

  const focusedItem = useMemo(
    () => plan.items.find((i) => i.id === focusedId) ?? null,
    [plan.items, focusedId],
  );

  return (
    <div className="fixed inset-0 z-0 bg-[#FEE9D2]">
      <Scene plan={plan} />
      <Hud plan={plan} />
      {focusedItem && (
        <FocusCard
          planId={plan.id}
          item={focusedItem}
          onClose={() => { setFocusedNode(null); setMode('follow'); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2:** Typecheck + smoke manual

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web dev
```

Dirigir até um node, apertar `E`. Câmera deve zoom-in, card aparecer à direita. Clicar em "Consegui" fecha e atualiza o node visualmente. `Esc` fecha sem feedback.

- [ ] **Step 3:** Commit

```bash
git add apps/web/components/member/map-3d/index.tsx
git commit -m "feat(web/map-3d): wire E/Esc for focus mode + show FocusCard

Fluxo completo: dirigir → proximidade → E → câmera zoom + card DOM →
feedback → fecha → mesh atualiza via invalidação de queries.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**Checkpoint Fase 5:** Loop completo funciona — dirigir, entrar num node, dar feedback. Ciclo fechado.

---

# Fase 6 — Props (árvores, montanhas, cristais, nuvens, sol)

### Task 6.1: Criar `props.tsx` com todas as decorações

**Files:**
- Create: `apps/web/components/member/map-3d/props.tsx`

- [ ] **Step 1:** Escrever

```tsx
// apps/web/components/member/map-3d/props.tsx
'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, InstancedMesh, Matrix4, Euler, Quaternion, Group } from 'three';
import { heightAt } from './terrain';

const CRYSTAL_COLORS = ['#8B5CF6', '#F97316', '#FBBF24', '#EC4899', '#4F46E5'];
const MOUNTAIN_COLORS = ['#F97316', '#EA580C', '#FB923C'];

function hashRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function samplePositions(count: number, minR: number, maxR: number, avoid: Array<[number, number]>, minAvoid: number, seed: number): Array<{ x: number; z: number; s: number }> {
  const rand = hashRandom(seed);
  const out: Array<{ x: number; z: number; s: number }> = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 10) {
    attempts++;
    const a = rand() * Math.PI * 2;
    const r = minR + rand() * (maxR - minR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const tooClose = avoid.some(([ax, az]) => Math.hypot(ax - x, az - z) < minAvoid);
    if (tooClose) continue;
    out.push({ x, z, s: 0.6 + rand() * 0.8 });
  }
  return out;
}

const PATH_AVOID: Array<[number, number]> = [
  [-65, 55], [-35, 45], [-10, 28], [20, 12],
  [42, -8], [28, -38], [-5, -52], [-38, -48],
];

export function Trees() {
  const positions = useMemo(() => samplePositions(140, 18, 128, PATH_AVOID, 8, 1), []);
  return (
    <group>
      {positions.map((p, i) => {
        const y = heightAt(p.x, p.z);
        return (
          <group key={i} position={[p.x, y, p.z]} scale={[p.s, p.s, p.s]}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <cylinderGeometry args={[0.35, 0.45, 1.8, 6]} />
              <meshStandardMaterial color="#78350F" flatShading />
            </mesh>
            <mesh position={[0, 3.1, 0]} castShadow>
              <coneGeometry args={[1.7, 3.4, 6]} />
              <meshStandardMaterial color="#065F46" flatShading />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Mountains() {
  const items = useMemo(() => ([
    { x: -120, z: -70, h: 32, c: MOUNTAIN_COLORS[0] },
    { x:  110, z: -90, h: 38, c: MOUNTAIN_COLORS[1] },
    { x: -130, z:  40, h: 28, c: MOUNTAIN_COLORS[2] },
    { x:  125, z:  60, h: 30, c: MOUNTAIN_COLORS[0] },
    { x:   80, z: -10, h: 22, c: MOUNTAIN_COLORS[2] },
    { x:  -90, z:  90, h: 26, c: MOUNTAIN_COLORS[1] },
  ]), []);
  return (
    <>
      {items.map((m, i) => (
        <mesh key={i} position={[m.x, heightAt(m.x, m.z) + m.h / 2, m.z]} castShadow>
          <coneGeometry args={[m.h * 0.7, m.h, 5]} />
          <meshStandardMaterial color={m.c} flatShading />
        </mesh>
      ))}
    </>
  );
}

export function Crystals() {
  const positions = useMemo(() => samplePositions(18, 20, 105, PATH_AVOID, 6, 2), []);
  const refs = useRef<Array<{ mesh: Group | null; phase: number; baseY: number }>>([]);

  useFrame(() => {
    const t = performance.now() * 0.001;
    refs.current.forEach((r, i) => {
      if (!r.mesh) return;
      r.mesh.position.y = r.baseY + Math.sin(t * 1.2 + r.phase) * 0.3;
      r.mesh.rotation.y = t * 0.5 + i;
    });
  });

  return (
    <>
      {positions.map((p, i) => {
        const baseY = heightAt(p.x, p.z) + 2.2;
        const color = CRYSTAL_COLORS[i % CRYSTAL_COLORS.length];
        const phase = (i * 0.7) % (Math.PI * 2);
        return (
          <group
            key={i}
            position={[p.x, baseY, p.z]}
            ref={(el) => { refs.current[i] = { mesh: el, phase, baseY }; }}
          >
            <mesh castShadow>
              <octahedronGeometry args={[1.1]} />
              <meshStandardMaterial color={color} flatShading metalness={0.3} roughness={0.3} emissive={color} emissiveIntensity={0.35} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export function Clouds() {
  const clouds = useMemo(() => {
    const out: Array<{ x: number; y: number; z: number; parts: Array<[number, number, number, number]> }> = [];
    const rand = hashRandom(7);
    for (let i = 0; i < 6; i++) {
      const parts: Array<[number, number, number, number]> = [];
      for (let j = 0; j < 5; j++) parts.push([j * 1.8 - 3, rand() * 0.6, rand() * 0.6, 2 + rand()]);
      out.push({ x: -80 + i * 32, y: 34 + rand() * 4, z: -60 + rand() * 120, parts });
    }
    return out;
  }, []);
  const groupRefs = useRef<Array<Group | null>>([]);

  useFrame(() => {
    const t = performance.now() * 0.001;
    groupRefs.current.forEach((g, i) => {
      if (!g) return;
      const base = clouds[i]?.x ?? 0;
      g.position.x = base + ((t * 0.9 * (i + 1)) % 220);
      if (g.position.x > 140) g.position.x -= 280;
    });
  });

  return (
    <>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} ref={(el) => { groupRefs.current[i] = el; }}>
          {c.parts.map(([dx, dy, dz, r], j) => (
            <mesh key={j} position={[dx, dy, dz]}>
              <sphereGeometry args={[r, 8, 8]} />
              <meshStandardMaterial color="white" flatShading roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

export function Sun() {
  return (
    <mesh position={[80, 75, -70]}>
      <sphereGeometry args={[6, 24, 24]} />
      <meshBasicMaterial color="#FEF3C7" />
    </mesh>
  );
}
```

- [ ] **Step 2:** Plugar em `scene.tsx` dentro do Suspense

```tsx
import { Trees, Mountains, Crystals, Clouds, Sun } from './props';
// ...
<Suspense fallback={null}>
  <Terrain />
  <Trees />
  <Mountains />
  <Crystals />
  <Clouds />
  <Sun />
  <PathAndNodes plan={plan} nodePositionsRef={nodePositionsRef} />
  <Car positionRef={carPositionRef} spawnPosition={spawn} nodePositionsRef={nodePositionsRef} />
</Suspense>
```

- [ ] **Step 3:** Typecheck + smoke manual

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web dev
```

Cena deve ficar cheia de árvores, montanhas, cristais flutuando, nuvens passando, sol no canto.

- [ ] **Step 4:** Commit

```bash
git add apps/web/components/member/map-3d/props.tsx apps/web/components/member/map-3d/scene.tsx
git commit -m "feat(web/map-3d): add decoration props (trees, mountains, crystals, clouds, sun)

Posições determinísticas via PRNG seeded para evitar re-layout a cada
render. Crystals flutuam; clouds navegam.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**Checkpoint Fase 6:** Mundo 3D visualmente completo.

---

# Fase 7 — Polish, A11y, Perf

### Task 7.1: Loading overlay + fallback em erro de WebGL

**Files:**
- Modify: `apps/web/components/member/map-3d/index.tsx`

- [ ] **Step 1:** Adicionar listener de `webglcontextlost` + overlay de loading + fallback

```tsx
// apps/web/components/member/map-3d/index.tsx — adicionar ao componente Map3D
import { useState } from 'react';
import { NodeMap } from '../map-2d/node-map';
// ...
export default function Map3D({ plan }: Map3DProps) {
  const [glError, setGlError] = useState(false);
  // ... resto igual

  useEffect(() => {
    const onLost = () => setGlError(true);
    const canvas = document.querySelector('canvas');
    canvas?.addEventListener('webglcontextlost', onLost);
    return () => canvas?.removeEventListener('webglcontextlost', onLost);
  }, []);

  if (glError) {
    return (
      <div>
        <div className="bg-amber-50 text-amber-900 text-sm p-3 rounded-lg mb-3 border border-amber-200">
          Algo deu errado com o WebGL — voltando para o mapa simples.
        </div>
        <NodeMap planId={plan.id} items={plan.items} />
      </div>
    );
  }

  // ... resto do render igual
}
```

- [ ] **Step 2:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/index.tsx
git commit -m "feat(web/map-3d): fallback to 2D on webglcontextlost

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7.2: `prefers-reduced-motion`

**Files:**
- Modify: `apps/web/components/member/map-3d/node-mesh.tsx`
- Modify: `apps/web/components/member/map-3d/props.tsx`

- [ ] **Step 1:** Criar hook de detecção

Adicionar ao `apps/web/lib/capabilities.ts`:

```ts
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
```

- [ ] **Step 2:** Usar no `node-mesh.tsx`

Antes do `useFrame`:

```tsx
import { prefersReducedMotion } from '../../../lib/capabilities';
// ...
const reduced = useMemo(() => prefersReducedMotion(), []);

useFrame((_, delta) => {
  if (reduced) {
    // Apenas o active pulsa de leve; resto estático
    if (status === 'active' && groupRef.current) {
      const t = performance.now() * 0.001;
      groupRef.current.position.y = baseY + Math.sin(t * 2) * 0.1;
    }
    return;
  }
  // ... código original
});
```

- [ ] **Step 3:** Usar no `props.tsx` nos hooks de Crystals/Clouds (skip o useFrame quando reduced).

- [ ] **Step 4:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/lib/capabilities.ts apps/web/components/member/map-3d/node-mesh.tsx apps/web/components/member/map-3d/props.tsx
git commit -m "feat(web/map-3d): respect prefers-reduced-motion

Desativa animações ociosas; ativo ainda sutilmente pulsa como
affordance.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7.3: Canvas aria-label + lista offscreen de nodes

**Files:**
- Modify: `apps/web/components/member/map-3d/scene.tsx`
- Modify: `apps/web/components/member/map-3d/index.tsx`

- [ ] **Step 1:** Adicionar aria-label no `<Canvas>`

No `scene.tsx`, passar `aria-label="Mapa 3D de estudo — use WASD para mover o carrinho"` no `<Canvas>`:

```tsx
<Canvas
  shadows
  dpr={[1, 2]}
  gl={{ antialias: true }}
  aria-label="Mapa 3D de estudo — use WASD para mover o carrinho, E para entrar em um node"
  {...}
>
```

- [ ] **Step 2:** Adicionar lista offscreen no `index.tsx`

```tsx
// No return, dentro do container fixed:
<ul
  className="sr-only"
  aria-label="Lista de nodes do plano (alternativa acessível ao mapa 3D)"
>
  {plan.items.map((item, i) => (
    <li key={item.id}>
      Node {i + 1}: {item.libraryItem.title} — {item.status === 'DONE' ? 'concluído' : 'pendente'}
      {item.libraryItem.url && <a href={item.libraryItem.url} target="_blank" rel="noopener noreferrer"> (abrir material)</a>}
    </li>
  ))}
</ul>
```

- [ ] **Step 3:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/scene.tsx apps/web/components/member/map-3d/index.tsx
git commit -m "feat(web/map-3d): a11y — aria-label no canvas + offscreen nodes list

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7.4: FPS monitor com toast de fallback

**Files:**
- Create: `apps/web/components/member/map-3d/fps-monitor.tsx`
- Modify: `apps/web/components/member/map-3d/index.tsx`

- [ ] **Step 1:** Escrever monitor

```tsx
// apps/web/components/member/map-3d/fps-monitor.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { addToast } from '@heroui/react';

export function FpsMonitor({ onFallback }: { onFallback: () => void }) {
  const samples = useRef<number[]>([]);
  const warnedRef = useRef(false);

  useFrame((_, delta) => {
    if (warnedRef.current) return;
    samples.current.push(1 / Math.max(delta, 0.001));
    if (samples.current.length > 180) samples.current.shift();
    if (samples.current.length >= 180) {
      const avg = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;
      if (avg < 30) {
        warnedRef.current = true;
        addToast({
          title: 'Desempenho baixo',
          description: 'Quer desativar o mapa 3D?',
          color: 'warning',
          // HeroUI addToast não suporta ações custom em todas versões; se não houver,
          // oferecer instrução curta. Ajustar aqui se a API for diferente.
        });
        // Escolha automática: oferece o fallback via callback; caller decide.
        setTimeout(() => onFallback(), 2000);
      }
    }
  });
  return null;
}
```

- [ ] **Step 2:** Plugar em `index.tsx`

```tsx
// dentro do Scene... não — FpsMonitor usa useFrame então precisa estar em Canvas
// Então plugar dentro de scene.tsx, não em index.
```

Em `scene.tsx`, dentro do Canvas, adicionar:

```tsx
import { FpsMonitor } from './fps-monitor';
// ...
<FpsMonitor onFallback={() => {
  localStorage.setItem('ics:map3d', 'off');
  window.location.reload();
}} />
```

- [ ] **Step 3:** Typecheck + commit

```bash
pnpm --filter @ics-select/web typecheck
git add apps/web/components/member/map-3d/fps-monitor.tsx apps/web/components/member/map-3d/scene.tsx
git commit -m "feat(web/map-3d): FPS monitor auto-suggests fallback on sustained low FPS

Se FPS médio < 30 por 3 segundos, toasteia o usuário e recarrega no
modo 2D.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7.5: Verificação final de bundle

**Files:** nenhum — apenas instrumentação manual

- [ ] **Step 1:** Rodar build de produção

```bash
pnpm --filter @ics-select/web build
```

- [ ] **Step 2:** Inspecionar output de `.next/static/chunks/` — o chunk contendo `three` deve aparecer separado (lazy), não no chunk principal da página. Se o mapa 3D aparecer no bundle inicial, verificar que `React.lazy(() => import('./map-3d'))` não está sendo sobrescrito por alguma re-exportação.

- [ ] **Step 3:** Commit (nenhuma mudança de código esperada; se houver algum ajuste, incluir)

---

## Validação final

Após todas as fases, checklist manual antes de merge:

- [ ] `/map` em desktop (1440×900, Chrome) renderiza 3D em < 2s após login.
- [ ] Dirigir com WASD e chegar em cada node do plano ativo em até 15 segundos.
- [ ] Pressionar E com carrinho em cima de um node abre focus card, com dados corretos do material.
- [ ] Consegui/Travei/Dúvidas fecha o card e atualiza o node visualmente (done vira verde).
- [ ] Plan Dock à esquerda mostra todos os planos; clicar num passado carrega os nodes daquele plano. Voltar ao ativo restaura.
- [ ] Mobile (375×667 DevTools) renderiza mapa 2D (sem bundle 3D no Network tab).
- [ ] `localStorage.setItem('ics:map3d','off')` + reload cai no 2D em desktop.
- [ ] Cena respeita `prefers-reduced-motion` (mudar no DevTools Rendering tab).
- [ ] Screen reader (VoiceOver/Cmd+F5) lê a lista offscreen de nodes.
- [ ] `pnpm --filter @ics-select/web typecheck` passa.
- [ ] `pnpm build` do monorepo passa.

---

## Rollout

- **Deploy escalonado**: fase 1 pode ir pra main sozinha (fix do bug + dock). Fases 2-7 em branch `feature/map-3d`, merge único após Fase 7.
- **Feature flag leve**: se após Fase 6 você quiser conservador, defaultar `shouldUse3DMap()` para `false` em produção e usar `localStorage.ics:map3d=on` como opt-in até ganhar confiança.

---

## Self-review do plan

**Spec coverage:**
- §2.1 Desktop 3D: tasks 2.* + 3.* + 4.* + 5.* + 6.* ✓
- §2.2 Mobile fallback: tasks 1.2, 1.4, 2.7 ✓
- §2.3 Toggle leve: task 1.2 + 2.7 (respeita localStorage) ✓
- §3.* Arquitetura: task 2.2 (store), 1.3 (usePlan), estrutura criada em 1.1/2.2 ✓
- §4 Backend: nenhuma task — spec afirma zero mudanças ✓
- §5 Visual: tasks 3.2, 4.2, 6.1 cobrem hex/carro/props ✓
- §6 Interação: tasks 5.2/5.3/5.4 cobrem proximity/E/focus card ✓
- §7 Perf: tasks 7.4, 2.1 (bundle via lazy), 7.5 (check) ✓
- §8 A11y: tasks 7.2, 7.3 ✓
- §9 Testes: web não tem infra de teste; validação manual documentada ao final de cada fase ✓ (limitação reconhecida)
- §10 Milestones: 7 fases, 1-2 tasks por milestone da spec ✓

**Scope check:** sete fases independentes, cada uma ≈ 1 PR. Cada fase deixa o app em estado deployável.

**Ambiguidades tratadas:** usePathPoints compartilhada entre Path e Nodes (mesma fonte de posições → evita drift). scene-store centraliza estado volátil. computeSpawn localizado em scene.tsx (não exporta um terceiro módulo só pra ele).

**Limitação conhecida:** não há testes automatizados no web package. Risco parcialmente mitigado por TypeScript strict + smoke manual obrigatório no fim de cada fase. Se isso incomodar no futuro, adicionar vitest é tarefa separada.
