# Draft Plan — Ladder Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the soft "ordem pedagógica" rule in `DraftPlanService` with a pre-computed ladder block (solid/focus/locked per topic) and explicit prompt rules so the AI defaults to ladder discipline with admin brief as override.

**Architecture:** Single-file change to `apps/api/src/ai/draft-plan.service.ts`. Add a pure `computeLadder()` function and a `renderLadderBlock()` helper. Wire them into `run()` by fetching topics once via Prisma, computing the ladder against existing `topicCoverage`, and replacing the current `coverageBlock` string. Replace the relevant lines in the system prompt.

**Tech Stack:** NestJS 10, Prisma 5, Jest. No new deps. No DB migration. No new files.

**Spec:** `docs/superpowers/specs/2026-05-04-draft-plan-ladder-discipline-design.md`.

---

## File Structure

- **Modify:** `apps/api/src/ai/draft-plan.service.ts`
  - Add exported constant `LADDER_SOLID_THRESHOLD`.
  - Add exported types `LadderStatus`, `LadderEntry`.
  - Add exported pure functions `computeLadder()` and `renderLadderBlock()`.
  - Modify `DraftPlanService.run()` to fetch topics, compute ladder, swap `coverageBlock` for `ladderBlock`.
  - Modify the `system` template literal to replace the soft pedagogical rule with explicit LADDER DISCIPLINE + OVERRIDE blocks.
- **Modify:** `apps/api/src/ai/draft-plan.service.spec.ts`
  - Add `topic` mock to `makePrisma()` helper.
  - Add a `describe('computeLadder')` block with 5 unit cases.
  - Add a `describe('renderLadderBlock')` block with 3 cases.
  - Add 1 integration test that asserts the user prompt contains `LADDER STATUS`.
  - Add 1 unit test that asserts the system prompt contains the new rule blocks.

Files that change together → both stay in `apps/api/src/ai/`.

---

## Task 1: `computeLadder` pure function with full unit coverage

Implements the eligibility classifier. Pure function, easy to test. Lives in the same file as the service to keep AI-related logic colocated, but exported so tests can hit it directly.

**Files:**
- Modify: `apps/api/src/ai/draft-plan.service.ts` (add exports near the top, after `WEEK_MS`)
- Test: `apps/api/src/ai/draft-plan.service.spec.ts` (add new `describe` at the top of the file)

- [ ] **Step 1: Add the new test cases**

Add at the **end** of `apps/api/src/ai/draft-plan.service.spec.ts` (before the final closing line, but after the existing `describe('DraftPlanService', ...)` block):

```ts
import { computeLadder, LADDER_SOLID_THRESHOLD } from './draft-plan.service';

describe('computeLadder', () => {
  const TOPICS = [
    { slug: 'foundations', label: 'Foundations', order: -1 },
    { slug: 'array', label: 'Array', order: 0 },
    { slug: 'lists', label: 'Lists', order: 1 },
    { slug: 'tree', label: 'Tree', order: 2 },
  ];

  it('focus = lowest-order topic when coverage is empty', () => {
    const ladder = computeLadder(TOPICS, new Map());
    expect(ladder.map((e) => [e.slug, e.status])).toEqual([
      ['foundations', 'focus'],
      ['array', 'locked'],
      ['lists', 'locked'],
      ['tree', 'locked'],
    ]);
    expect(ladder[0]!.done).toBe(0);
  });

  it('foundations sólido (3 done) → focus moves to array', () => {
    const coverage = new Map([
      ['Foundations', { planned: 5, done: LADDER_SOLID_THRESHOLD }],
      ['Array', { planned: 1, done: 1 }],
    ]);
    const ladder = computeLadder(TOPICS, coverage);
    expect(ladder.map((e) => [e.slug, e.status])).toEqual([
      ['foundations', 'solid'],
      ['array', 'focus'],
      ['lists', 'locked'],
      ['tree', 'locked'],
    ]);
    expect(ladder[1]!.done).toBe(1);
    expect(ladder[1]!.planned).toBe(1);
  });

  it('multiple sólidos in a row → focus skips ahead', () => {
    const coverage = new Map([
      ['Foundations', { planned: 5, done: 5 }],
      ['Array', { planned: 5, done: 5 }],
      ['Lists', { planned: 5, done: 5 }],
    ]);
    const ladder = computeLadder(TOPICS, coverage);
    expect(ladder.map((e) => [e.slug, e.status])).toEqual([
      ['foundations', 'solid'],
      ['array', 'solid'],
      ['lists', 'solid'],
      ['tree', 'focus'],
    ]);
  });

  it('all topics sólidos → last topic becomes focus', () => {
    const coverage = new Map(
      TOPICS.map((t) => [t.label, { planned: 5, done: 5 }]),
    );
    const ladder = computeLadder(TOPICS, coverage);
    expect(ladder.at(-1)!.status).toBe('focus');
    expect(ladder.slice(0, -1).every((e) => e.status === 'solid')).toBe(true);
  });

  it('topic without coverage entry counts as done=0', () => {
    const coverage = new Map([
      ['Foundations', { planned: 5, done: 5 }],
      // Array has no entry at all
    ]);
    const ladder = computeLadder(TOPICS, coverage);
    expect(ladder[1]).toMatchObject({ slug: 'array', done: 0, planned: 0, status: 'focus' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec`

Expected: FAIL with `Cannot find name 'computeLadder'` / `Cannot find name 'LADDER_SOLID_THRESHOLD'` (TypeScript compile error in jest).

- [ ] **Step 3: Implement `computeLadder` and exports**

Open `apps/api/src/ai/draft-plan.service.ts`. Find the line `const WEEK_MS = 7 * 24 * 60 * 60 * 1000;` and **add directly after it**:

```ts
export const LADDER_SOLID_THRESHOLD = 3;

export type LadderStatus = 'solid' | 'focus' | 'locked';

export type LadderEntry = {
  order: number;
  slug: string;
  label: string;
  done: number;
  planned: number;
  status: LadderStatus;
};

/**
 * Classify each topic as 'solid' (≥LADDER_SOLID_THRESHOLD DONE), 'focus'
 * (the first topic in order that's not yet sólido), or 'locked' (everything
 * after the focus). If every topic is sólido, the last topic becomes focus.
 *
 * Coverage map is keyed by topic LABEL (matches the existing topicCoverage
 * shape in DraftPlanService.run).
 */
export function computeLadder(
  topics: Array<{ slug: string; label: string; order: number }>,
  coverage: Map<string, { planned: number; done: number }>,
): LadderEntry[] {
  const sorted = [...topics].sort((a, b) => a.order - b.order);
  const result: LadderEntry[] = [];
  let foundFocus = false;

  for (const t of sorted) {
    const counts = coverage.get(t.label) ?? { planned: 0, done: 0 };
    let status: LadderStatus;
    if (foundFocus) {
      status = 'locked';
    } else if (counts.done < LADDER_SOLID_THRESHOLD) {
      status = 'focus';
      foundFocus = true;
    } else {
      status = 'solid';
    }
    result.push({
      order: t.order,
      slug: t.slug,
      label: t.label,
      done: counts.done,
      planned: counts.planned,
      status,
    });
  }

  // Edge case: every topic is sólido. Promote the last entry to focus.
  if (!foundFocus && result.length > 0) {
    result[result.length - 1]!.status = 'focus';
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec`

Expected: PASS for all 5 `computeLadder` cases.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/draft-plan.service.ts apps/api/src/ai/draft-plan.service.spec.ts
git commit -m "feat(ai/draft-plan): add computeLadder pure function

Classifies topics as solid/focus/locked based on DONE_* counts vs the
LADDER_SOLID_THRESHOLD (3). First not-yet-solid topic in order becomes
focus, everything after is locked. Pure function, fully unit-tested."
```

---

## Task 2: `renderLadderBlock` helper

Renders the ladder array into the user-prompt string. Compact: shows all sólidos, the focus highlighted, the next 2 locked for context, then aggregates the rest.

**Files:**
- Modify: `apps/api/src/ai/draft-plan.service.ts` (add export below `computeLadder`)
- Test: `apps/api/src/ai/draft-plan.service.spec.ts` (add new describe block)

- [ ] **Step 1: Add tests for `renderLadderBlock`**

Add at the end of `apps/api/src/ai/draft-plan.service.spec.ts`, after the `describe('computeLadder', …)` block. Update the import line at the top of the file to also import `renderLadderBlock`:

```ts
import { computeLadder, LADDER_SOLID_THRESHOLD, renderLadderBlock } from './draft-plan.service';
```

Then add:

```ts
describe('renderLadderBlock', () => {
  it('renders header, sólidos, focus, 2 locked, and aggregate when many topics', () => {
    const ladder = [
      { order: -1, slug: 'foundations', label: 'Foundations', done: 5, planned: 5, status: 'solid' as const },
      { order: 0, slug: 'array', label: 'Array', done: 1, planned: 4, status: 'focus' as const },
      { order: 1, slug: 'lists', label: 'Lists', done: 0, planned: 0, status: 'locked' as const },
      { order: 2, slug: 'tree', label: 'Tree', done: 2, planned: 4, status: 'locked' as const },
      { order: 3, slug: 'trie', label: 'Trie', done: 0, planned: 0, status: 'locked' as const },
      { order: 4, slug: 'heap', label: 'Heap', done: 0, planned: 0, status: 'locked' as const },
      { order: 5, slug: 'graph', label: 'Graph', done: 0, planned: 0, status: 'locked' as const },
    ];
    const out = renderLadderBlock(ladder);
    expect(out).toContain('LADDER STATUS (cobertura mínima = 3 DONE_* por tópico):');
    expect(out).toContain('[#-1] Foundations: 5 DONE ✓ sólido');
    expect(out).toContain('[#0]  Array: 1 DONE ✗ insuficiente — FOCO ATUAL');
    expect(out).toContain('[#1]  Lists: 0 DONE — bloqueado');
    expect(out).toContain('[#2]  Tree: 2 DONE — bloqueado');
    // 3 lockeds remain after the first 2 → "+ 3 outros tópicos bloqueados"
    expect(out).toContain('+ 3 outros tópicos bloqueados (trie, heap, graph)');
  });

  it('omits aggregate line when ≤2 locked topics', () => {
    const ladder = [
      { order: 0, slug: 'array', label: 'Array', done: 0, planned: 0, status: 'focus' as const },
      { order: 1, slug: 'lists', label: 'Lists', done: 0, planned: 0, status: 'locked' as const },
    ];
    const out = renderLadderBlock(ladder);
    expect(out).toContain('[#1]  Lists: 0 DONE — bloqueado');
    expect(out).not.toMatch(/outros tópicos bloqueados/);
  });

  it('handles empty ladder with explicit fallback message', () => {
    const out = renderLadderBlock([]);
    expect(out).toBe('LADDER STATUS (cobertura mínima = 3 DONE_* por tópico):\n(sem dados)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec`

Expected: FAIL with `Cannot find name 'renderLadderBlock'`.

- [ ] **Step 3: Implement `renderLadderBlock`**

In `apps/api/src/ai/draft-plan.service.ts`, **directly after** the `computeLadder` function, add:

```ts
/**
 * Render the ladder array into a compact prompt block. Shows every sólido,
 * the focus, the first 2 locked topics for context, and aggregates the
 * remaining locked into a "+ N outros tópicos bloqueados (slug1, slug2, slug3)"
 * line.
 */
export function renderLadderBlock(ladder: LadderEntry[]): string {
  const header = 'LADDER STATUS (cobertura mínima = 3 DONE_* por tópico):';
  if (ladder.length === 0) return `${header}\n(sem dados)`;

  // Pad order prefix so columns align: [#-1] vs [#0] vs [#13].
  const maxOrderLen = Math.max(...ladder.map((e) => String(e.order).length));
  const orderTag = (n: number): string => {
    const raw = `[#${n}]`;
    const target = `[#${'X'.repeat(maxOrderLen)}]`.length;
    return raw.padEnd(target, ' ');
  };

  const lines: string[] = [header];
  const lockedQueue: LadderEntry[] = [];

  for (const e of ladder) {
    if (e.status === 'solid') {
      lines.push(`${orderTag(e.order)} ${e.label}: ${e.done} DONE ✓ sólido`);
    } else if (e.status === 'focus') {
      lines.push(
        `${orderTag(e.order)} ${e.label}: ${e.done} DONE ✗ insuficiente — FOCO ATUAL`,
      );
    } else {
      lockedQueue.push(e);
    }
  }

  const visibleLocked = lockedQueue.slice(0, 2);
  for (const e of visibleLocked) {
    lines.push(`${orderTag(e.order)} ${e.label}: ${e.done} DONE — bloqueado`);
  }

  const remaining = lockedQueue.slice(2);
  if (remaining.length > 0) {
    const sample = remaining
      .slice(0, 3)
      .map((e) => e.slug)
      .join(', ');
    lines.push(`+ ${remaining.length} outros tópicos bloqueados (${sample})`);
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec`

Expected: PASS for all 3 `renderLadderBlock` cases.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/draft-plan.service.ts apps/api/src/ai/draft-plan.service.spec.ts
git commit -m "feat(ai/draft-plan): add renderLadderBlock helper

Compact prompt block that shows every sólido, the FOCO ATUAL, the next
2 locked topics, and aggregates the remaining as '+ N outros tópicos
bloqueados (slug1, slug2, slug3)'."
```

---

## Task 3: Wire ladder into `run()` — replace `coverageBlock`

This is the integration step. Fetch topics once, compute the ladder, render the block, swap it into the prompt sections. The existing `topicCoverage` Map is reused as-is.

**Files:**
- Modify: `apps/api/src/ai/draft-plan.service.ts:120-160` (coverage section) and `:213-242` (block construction).
- Modify: `apps/api/src/ai/draft-plan.service.spec.ts` (add topic mock + 1 integration test).

- [ ] **Step 1: Update `makePrisma` helper to mock `topic.findMany`**

In `apps/api/src/ai/draft-plan.service.spec.ts`, find the `makePrisma` function and add a `topic` field to the `base` object. Replace the existing `base = { … }` block with:

```ts
const base = {
  cycleMembership: {
    findFirst: jest.fn(async () => ({
      track: 'BIG_TECH',
      cycleId: 'c1',
      cycle: { id: 'c1', status: 'ACTIVE' },
      user: { id: 'u1', name: 'Davi' },
    })),
  },
  user: { findUnique: jest.fn(async () => ({ id: 'u1', name: 'Davi' })) },
  topic: {
    findMany: jest.fn(async () => [
      { slug: 'foundations', label: 'Foundations', order: -1 },
      { slug: 'array', label: 'Array', order: 0 },
      { slug: 'lists', label: 'Lists', order: 1 },
      { slug: 'tree', label: 'Tree', order: 2 },
    ]),
  },
  weeklyPlan: {
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async () => null),
    count: jest.fn(async () => 0),
  },
  weeklyPlanItem: {
    findMany: jest.fn(async () => []),
    groupBy: jest.fn(async () => []),
  },
  weeklyRetro: { findFirst: jest.fn(async () => null) },
};
```

- [ ] **Step 2: Add the integration test**

Add at the end of the existing `describe('DraftPlanService', …)` block (last test, before its closing `})`):

```ts
it('includes LADDER STATUS block driven by topic coverage', async () => {
  const prisma = makePrisma({
    weeklyPlan: {
      findMany: jest.fn(async () => [
        // 3 DONE on Foundations → sólido
        {
          id: 'p-1',
          weekStart: new Date('2026-04-13'),
          items: [
            { outcome: 'DONE_HARD', libraryItem: { topics: [{ topic: { label: 'Foundations' } }] } },
            { outcome: 'DONE_EASY', libraryItem: { topics: [{ topic: { label: 'Foundations' } }] } },
            { outcome: 'DONE_EASY', libraryItem: { topics: [{ topic: { label: 'Foundations' } }] } },
            // 1 DONE on Array → focus must move to Array
            { outcome: 'DONE_EASY', libraryItem: { topics: [{ topic: { label: 'Array' } }] } },
          ],
        },
      ]),
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => 1),
    },
  });
  const chat = makeChat();
  chat.callJsonWithTools.mockResolvedValueOnce({
    data: { items: [], alternates: [], narrative: '', totalMinutes: 0 },
    usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
    toolCalls: [],
  });
  const svc = new DraftPlanService(
    chat as any,
    makeLibrary() as any,
    prisma as any,
    makeUsage() as any,
  );
  await svc.run({ memberId: 'u1', weekStart: WEEK_START, weekEnd: WEEK_END });
  const prompt = (chat.callJsonWithTools.mock.calls[0]![0] as any).messages[0]
    .content as string;

  expect(prompt).toMatch(/LADDER STATUS \(cobertura mínima = 3 DONE_\* por tópico\):/);
  expect(prompt).toMatch(/Foundations: 3 DONE ✓ sólido/);
  expect(prompt).toMatch(/Array: 1 DONE ✗ insuficiente — FOCO ATUAL/);
  expect(prompt).toMatch(/Lists: 0 DONE — bloqueado/);
  // The old coverage block must be gone
  expect(prompt).not.toMatch(/COBERTURA DE TÓPICOS \(ciclo atual\):/);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec`

Expected: FAIL on the new integration test (the `LADDER STATUS` regex will not match — current prompt still has `COBERTURA DE TÓPICOS`).

- [ ] **Step 4: Wire the ladder into `run()`**

Open `apps/api/src/ai/draft-plan.service.ts`. Find the section starting at `// 5) Topic coverage:` (around line 118). The existing `topicCoverage` computation stays. **Right after** the `topicCoverage` for-loop ends (the closing `}` after `topicCoverage.set(label, cur);`), and **before** `// 6) Items already sitting in the draft for this exact week`, add:

```ts
    // 5b) Ladder: classify topics as solid/focus/locked. Pre-computed so
    //     the AI doesn't have to reason about Topic.order on its own.
    const topicsForLadder = await this.prisma.topic.findMany({
      orderBy: { order: 'asc' },
      select: { slug: true, label: true, order: true },
    });
    const ladder = computeLadder(topicsForLadder, topicCoverage);
    const ladderBlock = renderLadderBlock(ladder);
```

Then find the existing `coverageBlock` construction (around line 232-242):

```ts
    const coverageLines: string[] = [];
    for (const [label, counts] of topicCoverage.entries()) {
      const pct =
        counts.planned === 0 ? 0 : Math.round((counts.done / counts.planned) * 100);
      coverageLines.push(
        `- ${label}: ${counts.done}/${counts.planned} concluídos (${pct}%)`,
      );
    }
    const coverageBlock =
      `COBERTURA DE TÓPICOS (ciclo atual):\n` +
      (coverageLines.length > 0 ? coverageLines.join('\n') : '(sem dados)');
```

**Delete** that whole block. Then find `promptSections` (around line 329):

```ts
    const promptSections = [
      memberLine,
      statsLine,
      outcomesBlock,
      retroBlock,
      coverageBlock,
      currentPlanBlock,
      carryOverBlock,
      carryOverResolvedBlock,
      briefBlock,
    ].filter((s): s is string => Boolean(s));
```

Replace `coverageBlock` with `ladderBlock`:

```ts
    const promptSections = [
      memberLine,
      statsLine,
      outcomesBlock,
      retroBlock,
      ladderBlock,
      currentPlanBlock,
      carryOverBlock,
      carryOverResolvedBlock,
      briefBlock,
    ].filter((s): s is string => Boolean(s));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec`

Expected: PASS for the new integration test AND all 5 pre-existing `DraftPlanService` tests (none of them assert the old `COBERTURA DE TÓPICOS` line, so they continue to pass).

If a pre-existing test fails because it referenced `COBERTURA DE TÓPICOS`, search for it: `grep -n "COBERTURA" apps/api/src/ai/draft-plan.service.spec.ts`. There should be no matches.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai/draft-plan.service.ts apps/api/src/ai/draft-plan.service.spec.ts
git commit -m "feat(ai/draft-plan): replace coverage block with ladder block

Fetch topics ordered by Topic.order, classify via computeLadder, render
via renderLadderBlock. Replaces the flat 'COBERTURA DE TÓPICOS' string
that gave the AI labels with no ladder position."
```

---

## Task 4: Update system prompt rules

Replace the soft `Ordem pedagógica` line with explicit `LADDER DISCIPLINE` + `OVERRIDE (brief do admin)` blocks.

**Files:**
- Modify: `apps/api/src/ai/draft-plan.service.ts:293-327` (the `system` template literal).
- Modify: `apps/api/src/ai/draft-plan.service.spec.ts` (add a unit test asserting the system prompt).

- [ ] **Step 1: Add a test asserting the new rules in the system prompt**

Add to `apps/api/src/ai/draft-plan.service.spec.ts` at the end of the `describe('DraftPlanService', …)` block:

```ts
it('system prompt contains LADDER DISCIPLINE and brief OVERRIDE blocks', async () => {
  const chat = makeChat();
  chat.callJsonWithTools.mockResolvedValueOnce({
    data: { items: [], alternates: [], narrative: '', totalMinutes: 0 },
    usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
    toolCalls: [],
  });
  const svc = new DraftPlanService(
    chat as any,
    makeLibrary() as any,
    makePrisma() as any,
    makeUsage() as any,
  );
  await svc.run({ memberId: 'u1', weekStart: WEEK_START, weekEnd: WEEK_END });
  const system = (chat.callJsonWithTools.mock.calls[0]![0] as any).system as string;

  expect(system).toMatch(/LADDER DISCIPLINE \(default\):/);
  expect(system).toMatch(/Sugira itens APENAS do tópico marcado FOCO ATUAL/);
  expect(system).toMatch(/Não sugira itens de tópicos "bloqueados"/);
  expect(system).toMatch(/Reflexões individuais são sinal de DIFICULDADE/);
  expect(system).toMatch(/OVERRIDE \(brief do admin\):/);
  expect(system).toMatch(/siga o brief/);
  // Old soft rule must be gone
  expect(system).not.toMatch(/Ordem pedagógica: fundamentos antes de avançado/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec`

Expected: FAIL on the new test (the new strings don't exist in the system prompt yet, and the old `Ordem pedagógica` line still does).

- [ ] **Step 3: Update the system prompt**

In `apps/api/src/ai/draft-plan.service.ts`, find the `const system = …` template literal. The current `Regras:` section is:

```ts
Regras:
- Não invente IDs. Use apenas IDs retornados por search_library ou os do bloco
  CARRY-OVER RESOLVIDO.
- Carry-overs DEVEM aparecer em "items" se o admin os marcou.
- Ordem pedagógica: fundamentos antes de avançado, médio antes de difícil.
- "alternates" tem até 3 itens extras.
- "rationale" liga o item ao contexto (ex: gap do ciclo, padrão da reflexão, nível).
- Se search_library trouxer poucos resultados pra uma query, amplia (remove filtros
  ou deixa query em branco) — NÃO desista e NÃO invente IDs.
- Se o bloco "ITENS JÁ NO PLANO ATUAL" tiver itens, inclua-os em "items" antes
  de sugerir complementos; não duplique.
- Se o track for COMPETITIVE_PROGRAMMING, o plano DEVE incluir no mínimo
  2 itens com format=PROBLEM (LeetCode practice). Pra outras tracks, equilibra
  teaching (VIDEO/ARTICLE/BOOK) com practice (PROBLEM) — pelo menos 1 PROBLEM
  por semana quando o tópico tiver problems disponíveis.`;
```

Replace the single line `- Ordem pedagógica: fundamentos antes de avançado, médio antes de difícil.` with:

```
LADDER DISCIPLINE (default):
- O bloco LADDER STATUS pré-computa o foco da semana. Sugira itens APENAS
  do tópico marcado FOCO ATUAL e dos tópicos sólidos (estes pra revisão leve).
- Não sugira itens de tópicos "bloqueados". A base não está madura.
- Reflexões individuais são sinal de DIFICULDADE dentro do tópico atual,
  não de mudança de foco. Insegurança no FOCO ATUAL → itens mais fáceis no
  MESMO tópico. Insegurança num bloqueado → recue pro foco.

OVERRIDE (brief do admin):
- Se BRIEF DO ADMIN explicitamente pedir tópico bloqueado, siga o brief.
  Admin tem contexto que a IA não tem.
- Mencione no \`narrative\` que está seguindo o brief contra a ladder.

Outras regras:
```

So the final structure becomes: `Regras:` → 4 bullets (não inventar IDs / carry-overs / alternates / rationale) → blank line → `LADDER DISCIPLINE` block → blank line → `OVERRIDE` block → blank line → `Outras regras:` → remaining 3 bullets (search_library fallback / current plan dedupe / track-based PROBLEM count).

The exact final template literal:

```ts
    const system = `Você é o copiloto do Diretor Educacional do ICS Select. Monte um plano semanal de 4-7 itens
para o membro, considerando:
- o track do membro
- as últimas 4 semanas de resultados (outcomes + reflexões)
- o retrô mais recente (se houver)
- a cobertura de tópicos do ciclo
- carry-overs que o admin já marcou
- brief opcional do admin

Use a ferramenta \`search_library\` pra encontrar candidatos no acervo — chame várias vezes
com queries ou filtros diferentes pra diversificar tópicos/formatos. Depois de reunir 4-7
bons candidatos, responda APENAS com JSON válido:

{
  "items": [{"libraryItemId": "<id>", "order": <int>, "rationale": "1-2 frases em pt-BR"}],
  "alternates": [{"libraryItemId": "<id>", "rationale": "..."}],
  "narrative": "1 parágrafo curto em pt-BR resumindo o foco da semana",
  "totalMinutes": <sum of estimatedMinutes>
}

Regras:
- Não invente IDs. Use apenas IDs retornados por search_library ou os do bloco
  CARRY-OVER RESOLVIDO.
- Carry-overs DEVEM aparecer em "items" se o admin os marcou.
- "alternates" tem até 3 itens extras.
- "rationale" liga o item ao contexto (ex: gap do ciclo, padrão da reflexão, nível).

LADDER DISCIPLINE (default):
- O bloco LADDER STATUS pré-computa o foco da semana. Sugira itens APENAS
  do tópico marcado FOCO ATUAL e dos tópicos sólidos (estes pra revisão leve).
- Não sugira itens de tópicos "bloqueados". A base não está madura.
- Reflexões individuais são sinal de DIFICULDADE dentro do tópico atual,
  não de mudança de foco. Insegurança no FOCO ATUAL → itens mais fáceis no
  MESMO tópico. Insegurança num bloqueado → recue pro foco.

OVERRIDE (brief do admin):
- Se BRIEF DO ADMIN explicitamente pedir tópico bloqueado, siga o brief.
  Admin tem contexto que a IA não tem.
- Mencione no \`narrative\` que está seguindo o brief contra a ladder.

Outras regras:
- Se search_library trouxer poucos resultados pra uma query, amplia (remove filtros
  ou deixa query em branco) — NÃO desista e NÃO invente IDs.
- Se o bloco "ITENS JÁ NO PLANO ATUAL" tiver itens, inclua-os em "items" antes
  de sugerir complementos; não duplique.
- Se o track for COMPETITIVE_PROGRAMMING, o plano DEVE incluir no mínimo
  2 itens com format=PROBLEM (LeetCode practice). Pra outras tracks, equilibra
  teaching (VIDEO/ARTICLE/BOOK) com practice (PROBLEM) — pelo menos 1 PROBLEM
  por semana quando o tópico tiver problems disponíveis.`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec`

Expected: PASS for all tests including the new `system prompt contains LADDER DISCIPLINE…` test.

- [ ] **Step 5: Run full API test suite as a regression check**

Run: `pnpm --filter @ics-select/api test`

Expected: all tests PASS. If any other AI-related test (`brief-plan`, `diagnose`, `chat`) breaks, those are out-of-scope changes and indicate the spec was wrong — STOP and report rather than touching them.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai/draft-plan.service.ts apps/api/src/ai/draft-plan.service.spec.ts
git commit -m "feat(ai/draft-plan): explicit LADDER DISCIPLINE + brief OVERRIDE in system prompt

Replace the soft 'Ordem pedagógica' line with two explicit blocks: ladder
discipline (default — only FOCO ATUAL + solid topics, never locked) and
brief override (admin can break the ladder when they explicitly call for
a blocked topic). Reflections are reframed as a difficulty signal within
a topic, not a focus signal."
```

---

## Self-Review

**Spec coverage:**
- ✅ Single-file change (Tasks 1-4 all in `draft-plan.service.ts`).
- ✅ `LADDER_SOLID_THRESHOLD = 3` constant — Task 1.
- ✅ `computeLadder` algorithm with all 5 spec cases — Task 1.
- ✅ Coverage label-keying preserved — `coverage.get(t.label)` in Task 1 implementation.
- ✅ `renderLadderBlock` shows solids + focus + 2 locked + aggregate — Task 2.
- ✅ Empty ladder fallback — Task 2 ("(sem dados)").
- ✅ Wire into `run()`, fetch topics ordered ASC — Task 3.
- ✅ Replace `coverageBlock` with `ladderBlock` in `promptSections` — Task 3.
- ✅ System prompt LADDER DISCIPLINE + OVERRIDE blocks — Task 4.
- ✅ Other regras (carry-overs, IDs, COMPETITIVE_PROGRAMMING) preserved — Task 4 final template literal.
- ✅ Out of scope (Topic.order fix, brief-plan/diagnose/chat) — flagged in spec, not in any task.

**Placeholder scan:** No TBDs, no "fill in details", no "similar to Task N". Every code block is concrete.

**Type consistency:** `LadderEntry` shape used identically across Tasks 1-3. `LadderStatus` union (`'solid' | 'focus' | 'locked'`) consistent. `coverage` Map signature (`Map<string, { planned: number; done: number }>`) matches existing code in `draft-plan.service.ts:139`.
