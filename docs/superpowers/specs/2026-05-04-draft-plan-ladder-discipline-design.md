# Draft Plan — Ladder Discipline

**Date:** 2026-05-04
**Scope:** `apps/api/src/ai/draft-plan.service.ts`
**Owner:** Davi Duarte
**Trigger:** AI sugeriu árvores pro Cauan (calouro) baseado numa única reflexão de "insegurança em árvores", em vez de recuar pra base. O system prompt atual deixa a IA escolher livremente o foco da semana com regras genéricas.

## Problema

O `DraftPlanService` monta o user prompt passando cobertura de tópicos como labels soltos (sem `Topic.order`) e regras de ordem pedagógica vagas ("fundamentos antes de avançado"). Sem ladder explícita nem decisão pré-computada, a IA pattern-matcha na reflexão mais recente e fixa o foco no tópico mencionado, ignorando que há tópicos de `order` menor com cobertura insuficiente.

Caso real: Cauan (calouro, ~2 semanas no programa) recebeu sugestão de Trees+LeetCode 104 baseada em "última reflexão mostra insegurança", quando deveria estar fechando array/lists primeiro.

## Decisões travadas

1. **Base sólida = ≥3 itens com outcome positivo** (`DONE_EASY` ou `DONE_HARD`) por tópico.
2. **Brief do admin sempre override.** Se brief pede tópico bloqueado, IA segue o brief — admin tem contexto que a IA não tem.
3. **Sem heurística de tenure.** Calouro é o default (maioria dos membros). Veterano "desbloqueia" tópicos avançados naturalmente via DONE counts.
4. **Coverage scope = ciclo atual.** Mantém o comportamento existente de `coverageSource`.
5. **Cross-topic items contam pra todo tópico que cobrem.** Mantém comportamento existente do `topicCoverage`.

## Arquitetura

Mudança contida em **um único arquivo**: `apps/api/src/ai/draft-plan.service.ts`.

Sem migration, sem nova tabela, sem novo módulo. A coverage data já existente é suficiente — só adicionamos uma camada de classificação por cima.

## Componentes

### `computeLadder` (helper privado novo)

```ts
const LADDER_SOLID_THRESHOLD = 3;

type LadderStatus = 'solid' | 'focus' | 'locked';

type LadderEntry = {
  order: number;
  slug: string;
  label: string;
  done: number;
  planned: number;
  status: LadderStatus;
};

private computeLadder(
  topics: Array<{ slug: string; label: string; order: number }>,
  coverage: Map<string, { planned: number; done: number }>,
): LadderEntry[];
```

**Algoritmo:**
1. Iterar `topics` em `order` ascendente.
2. Para cada um: `done = coverage.get(label)?.done ?? 0`.
3. Se ainda não achou foco e `done < LADDER_SOLID_THRESHOLD`: marca `focus` e set flag.
4. Senão se flag: `locked`. Senão: `solid`.
5. Caso especial: todos `done ≥ 3` → último topic na ordem vira `focus` (top-of-ladder).

### Coverage keying — refactor pequeno

A coverage atual é keyed por `label`. Pra juntar com a lista de topics fetched fresh, mantém label-keying mas garante que o select de topics inclui `slug + order + label`. Lookup no helper usa `label`.

### `ladderBlock` (substitui `coverageBlock`)

Render compacto pra evitar 28 tópicos no prompt:

```
LADDER STATUS (cobertura mínima = 3 DONE_* por tópico):
[#-1] Foundations: 5 DONE ✓ sólido
[#0]  Array: 1 DONE ✗ insuficiente — FOCO ATUAL
[#1]  Lists: 0 DONE — bloqueado
[#2]  Tree: 2 DONE — bloqueado
+ 25 outros tópicos bloqueados (Trie, Heap, Graph, …)
```

**Regras de render:**
- Todos os `solid` aparecem (compacto).
- O `focus` aparece destacado com `— FOCO ATUAL`.
- Os primeiros **2** `locked` (na ordem) aparecem.
- Resto vira `+ N outros tópicos bloqueados (slug1, slug2, slug3, …)` (até 3 nomes).

### System prompt — trecho de regras

Substitui a linha solta `"Ordem pedagógica: fundamentos antes de avançado, médio antes de difícil."` por dois blocos:

```
LADDER DISCIPLINE (default):
- O bloco LADDER STATUS pré-computa o foco da semana.
  Sugira itens APENAS do tópico marcado FOCO ATUAL e dos tópicos sólidos
  (estes pra revisão leve).
- Não sugira itens de tópicos "bloqueados". A base não está madura.
- Reflexões individuais são sinal de DIFICULDADE dentro do tópico atual,
  não de mudança de foco. Insegurança no FOCO ATUAL → itens mais fáceis
  no MESMO tópico. Insegurança num tópico bloqueado → recue pro foco.

OVERRIDE (brief do admin):
- Se BRIEF DO ADMIN explicitamente pedir tópico bloqueado, siga o brief.
  Admin tem contexto que a IA não tem.
- Mencione no `narrative` que está seguindo o brief contra a ladder.
```

Outras regras (não inventar IDs, carry-overs DEVEM aparecer, alternates ≤3, equilíbrio teaching/practice, COMPETITIVE_PROGRAMMING ≥2 PROBLEM) ficam intactas.

## Data flow

```
PrismaService.topic.findMany({ orderBy: { order: 'asc' }})
  ↓
[topics array]
  ↓
computeLadder(topics, topicCoverage)
  ↓
[ladder array com solid/focus/locked]
  ↓
renderLadderBlock(ladder)  // helper de string
  ↓
ladderBlock string  →  promptSections.join('\n\n')
  ↓
chat.callJsonWithTools({ system: <new rules>, messages: [{ user: <prompt>}], ... })
```

## Error handling

- **Topics vazio (DB sem topics):** ladder vira array vazio, `ladderBlock` rende `LADDER STATUS:\n(sem dados)`. AI cai pra fallback de regras gerais. Não deve acontecer em prod (topics seedados).
- **Coverage com tópico não-existente:** ignora (label sem match em topics não aparece na ladder; o sistema só rende baseado nos topics fetched, garantindo consistência).
- **Threshold edge case (todos sólidos):** último topic vira focus, não há `locked`. Render mostra todos como sólidos + último como FOCO ATUAL.

## Testing

### Unit (`draft-plan.service.spec.ts`)

Novos casos pra `computeLadder` (extrair como função pura testável OU expor private via tipo):

- **caso 1:** coverage vazia → focus = topic com menor `order`, todos os outros locked.
- **caso 2:** foundations 3 DONE, array 1 DONE → solid=foundations, focus=array, locked=resto.
- **caso 3:** foundations 5 DONE, array 5 DONE, lists 5 DONE → solid=[foundations, array, lists], focus=tree.
- **caso 4:** todos os topics 3+ DONE → solid=todos menos último, focus=último.
- **caso 5:** topic sem coverage entry (planned=0) → conta como done=0, locked se outro estiver no foco.

### Integration (já existe)

`draft-plan.service.spec.ts` tem teste com Prisma mockado. Ajustar pra:
- Verificar que `ladderBlock` aparece no `userPrompt` enviado ao chat provider.
- Verificar que o block tem o formato esperado (`[#order]`, `FOCO ATUAL`, etc.).
- Não testar comportamento da IA propriamente (LLM não-determinístico) — só o input que ela recebe.

### Smoke manual

Depois do merge, rodar `draft-plan` com:
1. Membro novo (zero histórico) → narrative deve falar de foundations/array.
2. Membro com 5 DONE em foundations e 0 em array → narrative deve focar em array.
3. Brief = "essa semana foco em databases" + membro com array=0 → narrative deve mencionar override do brief.

## Out of scope

- Corrigir `Topic.order` (hashmap=13 não faz sentido). PR separado.
- Criar `.claude/skills/icsselect-prompt-design/` — esperar 1-2 fixes parecidos pra extrair pattern reutilizável.
- Outros AI use cases (`brief-plan`, `diagnose`, `chat`) — têm prompts próprios, fora de escopo.
- Reestruturar reflexões em padrão agregado (Approach C). Fica pra depois se ainda observarmos viés após este fix.
- Mudar coverage de "ciclo atual" pra "all-time". Fora de escopo, e cycle resets são raros.

## Riscos

1. **IA ignorar a ladder mesmo com instruções claras.** Mitigado pelo bloco LADDER STATUS pré-computado: a decisão chega pronta, IA só executa. Se ainda assim viés persistir, vamos pro Approach C.
2. **Threshold de 3 muito alto pra ciclos curtos.** Se um ciclo de 6 semanas só permite ~3-4 itens por tópico, exigir 3 DONE pode travar progressão. Mitigação: monitorar via cohort dashboard pós-merge; ajustar `LADDER_SOLID_THRESHOLD` se necessário (constante única).
3. **Brief override mal interpretado.** A IA pode achar que qualquer mention de tópico no brief = override. Mitigação: linguagem do prompt exige "explicitamente pedir tópico bloqueado".

## Sucesso

- Cauan (e qualquer calouro) recebe drafts focados em foundations/array/lists, não em trees ou tópicos avançados, mesmo que reflexões recentes mencionem esses tópicos.
- Veteranos com base sólida continuam recebendo drafts no tópico avançado natural.
- Briefs de admin que pedem desvio são honrados, e a narrative menciona o desvio.
