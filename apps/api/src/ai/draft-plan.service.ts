import { Injectable } from '@nestjs/common';
import { OpenAiChatProvider, DRAFT_MODEL } from '../common/openai/openai-chat.provider.js';
import { LibraryService } from '../library/library.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { resolveActiveMembership } from '../common/cycle/active-cycle.js';
import { UsageLoggerService } from './usage-logger.service.js';
import { searchLibraryTool, makeLibraryToolExecutor } from './library-tool.js';
import { WRITING_GUIDELINES_PT } from './writing-guidelines.js';
import { isPositiveOutcome } from '@ics-select/shared';
import {
  canonicalCompletions,
  countCanonicalPositive,
} from '../common/completions/canonical-completions.js';

type DraftInput = {
  memberId: string;
  weekStart: Date;
  weekEnd: Date;
  carryOverItemIds?: string[];
  briefText?: string;
};

type Draft = {
  items: Array<{ libraryItemId: string; order: number; rationale: string }>;
  alternates: Array<{ libraryItemId: string; rationale: string }>;
  narrative: string;
  totalMinutes: number;
};

const TRACK_LABELS: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consulting Tech',
  COMPETITIVE_PROGRAMMING: 'Competitive Programming',
  STARTUP: 'Startup',
  OTHER: 'Outro',
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
 * shape in DraftPlanService.run). The `done` count reflects whatever
 * `isPositiveOutcome` from `@ics-select/shared` returns true for —
 * DONE_EASY, DONE_HARD, DOUBTS, and SKIPPED. SKIPPED counts because the
 * member chose to skip ("já sabia"); DOUBTS counts because the work was done.
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
  // Minimum width of 2 ensures at least one trailing space before the label
  // even when all orders are single-digit.
  const maxOrderLen = Math.max(2, ...ladder.map((e) => String(e.order).length));
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

@Injectable()
export class DraftPlanService {
  constructor(
    private readonly chat: OpenAiChatProvider,
    private readonly library: LibraryService,
    private readonly prisma: PrismaService,
    private readonly usage: UsageLoggerService,
  ) {}

  async run(input: DraftInput): Promise<{ draft: Draft; usage: any }> {
    // 1) Active-cycle membership + member identity
    const membership = await resolveActiveMembership(
      this.prisma,
      input.memberId,
      new Date(),
      { user: true } as any,
    );
    const track = (membership as any)?.track ?? null;
    const memberName =
      (membership as any)?.user?.name ??
      (await this.prisma.user.findUnique({ where: { id: input.memberId } }))?.name ??
      'Membro';
    const trackLabel = track ? TRACK_LABELS[track] ?? track : 'não definido';

    // 2) Last 4 weeks of PUBLISHED plans (with items + library item titles + topic labels)
    const recentPlans: any[] = await this.prisma.weeklyPlan.findMany({
      where: { userId: input.memberId, status: 'PUBLISHED' },
      orderBy: { weekStart: 'desc' },
      take: 4,
      include: {
        items: {
          include: {
            libraryItem: {
              select: {
                id: true,
                title: true,
                topics: {
                  select: {
                    isPrimary: true,
                    topic: { select: { id: true, label: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 3) Current retro (the retro for the week immediately before `weekStart`)
    const previousWeekStart = new Date(input.weekStart.getTime() - WEEK_MS);
    const retro: any = await this.prisma.weeklyRetro.findFirst({
      where: { userId: input.memberId, weekStart: previousWeekStart },
    });

    // 4) Carry-over items — resolve with library metadata
    const carryOverIds = input.carryOverItemIds ?? [];
    const carryOverItems: any[] =
      carryOverIds.length > 0
        ? await this.prisma.weeklyPlanItem.findMany({
            where: { id: { in: carryOverIds } },
            include: {
              libraryItem: {
                select: {
                  id: true,
                  title: true,
                  topics: {
                    select: {
                      isPrimary: true,
                      topic: { select: { id: true, label: true } },
                    },
                  },
                  estimatedMinutes: true,
                  format: true,
                  difficulty: true,
                  tags: true,
                  tracks: true,
                },
              },
            },
          })
        : [];

    // 5) Topic coverage: planned + done counts per topic label, across the
    //    entire active cycle so the gap-analysis is honest (not just last 4).
    //    Also captures actualMinutes vs estimatedMinutes per topic so the LLM
    //    can calibrate workload — see study time block below.
    const coverageSource: any[] = membership?.cycleId
      ? await this.prisma.weeklyPlan.findMany({
          where: { userId: input.memberId, cycleId: membership.cycleId },
          include: {
            items: {
              select: {
                libraryItemId: true,
                completedAt: true,
                outcome: true,
                actualMinutes: true,
                libraryItem: {
                  select: {
                    estimatedMinutes: true,
                    topics: {
                      select: { topic: { select: { label: true } } },
                    },
                  },
                },
              },
            },
          },
        })
      : recentPlans;
    const topicCoverage = new Map<string, { planned: number; done: number }>();
    const topicTime = new Map<
      string,
      { actual: number; estimated: number; items: number }
    >();
    let totalActual = 0;
    let totalEstimated = 0;
    let totalTimedItems = 0;
    // An item touches every topic in its M2M set (primary + secondary covers).
    // A material carried across weeks is many rows but must count once per topic,
    // so dedup: planned = distinct materials per label; done = distinct materials
    // with a positive canonical completion per label.
    const labelsOf = (item: any): string[] => {
      const topicLabels: string[] = (item.libraryItem?.topics ?? [])
        .map((t: any) => t.topic?.label)
        .filter((l: unknown): l is string => typeof l === 'string');
      return topicLabels.length > 0 ? topicLabels : ['sem tópico'];
    };
    const coverageItems: any[] = coverageSource.flatMap((p: any) => p.items ?? []);
    const plannedByLabel = new Map<string, Set<string>>();
    for (const item of coverageItems) {
      for (const label of labelsOf(item)) {
        if (!plannedByLabel.has(label)) plannedByLabel.set(label, new Set());
        plannedByLabel.get(label)!.add(item.libraryItemId);
      }
    }
    const doneByLabel = new Map<string, number>();
    for (const r of canonicalCompletions(
      coverageItems.map((i: any) => ({
        libraryItemId: i.libraryItemId,
        outcome: i.outcome,
        completedAt: i.completedAt ?? null,
        labels: labelsOf(i),
      })),
    )) {
      if (!isPositiveOutcome(r.outcome)) continue;
      for (const label of r.labels) doneByLabel.set(label, (doneByLabel.get(label) ?? 0) + 1);
    }
    for (const [label, materials] of plannedByLabel) {
      topicCoverage.set(label, { planned: materials.size, done: doneByLabel.get(label) ?? 0 });
    }

    // Study time aggregation (per canonical material so a re-studied carry isn't
    // double-counted). Skip rows without a reported number — the member chose
    // "Não sei" or hadn't completed. Estimated mirrors actual so the ratio
    // compares the same subset.
    for (const item of canonicalCompletions(
      coverageItems.map((i: any) => ({
        libraryItemId: i.libraryItemId,
        outcome: i.outcome,
        completedAt: i.completedAt ?? null,
        ref: i,
      })),
    ).map((c) => c.ref)) {
      const done = isPositiveOutcome(item.outcome);
      const actual = item.actualMinutes;
      const estimated = item.libraryItem?.estimatedMinutes;
      if (done && typeof actual === 'number' && typeof estimated === 'number' && estimated > 0) {
        totalActual += actual;
        totalEstimated += estimated;
        totalTimedItems += 1;
        for (const label of labelsOf(item)) {
          const cur = topicTime.get(label) ?? { actual: 0, estimated: 0, items: 0 };
          cur.actual += actual;
          cur.estimated += estimated;
          cur.items += 1;
          topicTime.set(label, cur);
        }
      }
    }

    // 5b) Ladder: classify topics as solid/focus/locked. Pre-computed so
    //     the AI doesn't have to reason about Topic.order on its own.
    const topicsForLadder = await this.prisma.topic.findMany({
      orderBy: { order: 'asc' },
      select: { slug: true, label: true, order: true },
    });
    const ladder = computeLadder(topicsForLadder, topicCoverage);
    const ladderBlock = renderLadderBlock(ladder);

    // 6) Items already sitting in the draft for this exact week — so the
    //    LLM doesn't re-suggest them and can see what the admin has in mind.
    const currentPlan: any = await this.prisma.weeklyPlan.findFirst({
      where: { userId: input.memberId, weekStart: input.weekStart },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: {
            libraryItem: {
              select: {
                id: true,
                title: true,
                estimatedMinutes: true,
                format: true,
                topics: {
                  select: {
                    isPrimary: true,
                    topic: { select: { id: true, label: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 7) Member stats summary — total plans, items, completion %, last 4 weeks.
    const [totalPlansCount, allItemRows] = await Promise.all([
      this.prisma.weeklyPlan.count({
        where: { userId: input.memberId, status: 'PUBLISHED' },
      }),
      // Dedup carried items: completion % over DISTINCT materials, not one row
      // per week a material was re-planned (else the % fed to the LLM inflates).
      this.prisma.weeklyPlanItem.findMany({
        where: { weeklyPlan: { userId: input.memberId, status: 'PUBLISHED' } },
        select: { libraryItemId: true, outcome: true, completedAt: true },
      }),
    ]);
    const totalItems = new Set(allItemRows.map((r) => r.libraryItemId)).size;
    const canonRows = canonicalCompletions(allItemRows);
    const totalDone = countCanonicalPositive(allItemRows);
    const completionPct = totalItems === 0 ? 0 : Math.round((totalDone / totalItems) * 100);
    // Per-outcome breakdown over DISTINCT materials (canonical outcome each),
    // so the counts sum to totalItems and stay consistent with completionPct.
    const outcomeCounts: Record<string, number> = {};
    for (const r of canonRows) outcomeCounts[r.outcome] = (outcomeCounts[r.outcome] ?? 0) + 1;
    outcomeCounts['PENDING'] = totalItems - canonRows.length;

    // 8) Build user prompt sections
    const memberLine = `MEMBRO: ${memberName} — track: ${trackLabel}`;

    const outcomeLines: string[] = [];
    for (const plan of recentPlans) {
      for (const item of plan.items ?? []) {
        const title = item.libraryItem?.title ?? item.libraryItemId;
        const reflection = item.reflection ? String(item.reflection).replace(/\s+/g, ' ').trim() : '';
        outcomeLines.push(`- [${item.outcome}] ${title} — "${reflection}"`);
      }
    }
    const outcomesBlock =
      `ÚLTIMAS 4 SEMANAS (outcomes + reflexões):\n` +
      (outcomeLines.length > 0 ? outcomeLines.join('\n') : '(sem histórico)');

    const retroBlock = retro
      ? `RETRÔ (semana anterior):\n- whatClicked: ${retro.whatClicked ?? ''}\n- whatStuck: ${retro.whatStuck ?? ''}\n- nextWeekWish: ${retro.nextWeekWish ?? ''}`
      : `RETRÔ (semana anterior):\n(sem retrô submetido)`;

    const statsLine =
      `ESTATÍSTICAS GERAIS:\n` +
      `- Planos publicados: ${totalPlansCount}\n` +
      `- Itens totais: ${totalItems} (concluídos ${totalDone}, ${completionPct}% completos)\n` +
      `- Outcomes: ${['DONE_EASY', 'DONE_HARD', 'DOUBTS', 'SKIPPED', 'STUCK', 'PENDING']
        .map((o) => `${o}=${outcomeCounts[o] ?? 0}`)
        .join(' · ')}`;

    const currentPlanLines =
      currentPlan?.items && currentPlan.items.length > 0
        ? currentPlan.items.map((it: any) => {
            const li = it.libraryItem;
            const primary = (li?.topics ?? []).find((t: any) => t.isPrimary);
            const topicLabel = primary?.topic?.label ?? 'sem tópico';
            return `- id=${li?.id ?? it.libraryItemId} "${li?.title ?? ''}" topic=${topicLabel} minutes=${li?.estimatedMinutes ?? '?'} format=${li?.format ?? '?'} order=${it.order}`;
          })
        : null;
    const currentPlanBlock = currentPlanLines
      ? `ITENS JÁ NO PLANO ATUAL (não sugira duplicados; complemente):\n${currentPlanLines.join('\n')}`
      : `ITENS JÁ NO PLANO ATUAL:\n(vazio — monte o plano do zero)`;

    const carryOverLines =
      carryOverItems.length > 0
        ? carryOverItems
            .map((co: any) => {
              const id = co.libraryItem?.id ?? co.libraryItemId;
              const title = co.libraryItem?.title ?? '';
              return `- id=${id} "${title}" (${co.outcome ?? 'PENDING'})`;
            })
            .join('\n')
        : '(nenhum)';
    const carryOverBlock = `CARRY-OVER SELECIONADO PELO ADMIN:\n${carryOverLines}`;

    const carryOverResolvedLines = carryOverItems
      .map((co: any) => {
        const li = co.libraryItem;
        if (!li) return null;
        const primary = (li.topics ?? []).find((t: any) => t.isPrimary);
        const topicLabel = primary?.topic?.label ?? 'sem tópico';
        return `- id=${li.id} "${li.title}" topic=${topicLabel} format=${li.format} difficulty=${li.difficulty} minutes=${li.estimatedMinutes}`;
      })
      .filter(Boolean);
    const carryOverResolvedBlock =
      carryOverResolvedLines.length > 0
        ? `CARRY-OVER RESOLVIDO:\n${carryOverResolvedLines.join('\n')}`
        : null;

    const briefBlock = `BRIEF DO ADMIN:\n${input.briefText && input.briefText.trim().length > 0 ? input.briefText.trim() : '(nenhum)'}`;

    // Study time signal: only meaningful with ≥3 timed items. Per-topic
    // ratios need at least 2 timed items per topic before they're surfaced
    // (single data points are noisy). Topics are split into "more cuidado"
    // (ratio ≥ 1.2 — member is slower) and "domínio" (ratio ≤ 0.8 — member
    // is faster) so the LLM can right-size the next week's load.
    const studyTimeBlock = (() => {
      if (totalTimedItems < 3 || totalEstimated === 0) {
        return null;
      }
      const overallRatio = totalActual / totalEstimated;
      const avgActual = Math.round(totalActual / totalTimedItems);
      const avgEstimated = Math.round(totalEstimated / totalTimedItems);
      const entries = [...topicTime.entries()]
        .filter(([, v]) => v.items >= 2 && v.estimated > 0)
        .map(([label, v]) => ({ label, ratio: v.actual / v.estimated, items: v.items }));
      const slower = entries
        .filter((e) => e.ratio >= 1.2)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 3);
      const faster = entries
        .filter((e) => e.ratio <= 0.8)
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 3);
      const lines = [
        `STUDY TIME (autorelato em ${totalTimedItems} itens):`,
        `- Médio: ${avgActual} min real vs ${avgEstimated} min estimado — ratio ${overallRatio.toFixed(2)}`,
      ];
      if (slower.length > 0) {
        lines.push(
          `- Tópicos mais lentos (ratio ≥ 1.2): ${slower
            .map((e) => `${e.label} ${e.ratio.toFixed(2)}`)
            .join(', ')}`,
        );
      }
      if (faster.length > 0) {
        lines.push(
          `- Tópicos mais rápidos (ratio ≤ 0.8): ${faster
            .map((e) => `${e.label} ${e.ratio.toFixed(2)}`)
            .join(', ')}`,
        );
      }
      lines.push(
        '- Use isso pra calibrar a carga: se ratio geral > 1, reduza estimatedMinutes total da semana; se < 1, pode pedir mais.',
      );
      return lines.join('\n');
    })();

    const system = `Você é o copiloto do Diretor Educacional do ICS Select. Monte um plano semanal de 4-7 itens
para o membro, considerando:
- o track do membro
- as últimas 4 semanas de resultados (outcomes + reflexões)
- o retrô mais recente (se houver)
- a ladder de tópicos do ciclo (solid/focus/locked via LADDER STATUS)
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

ESCRITA do narrative e dos rationales (texto que o membro vê quando o plano é publicado):
${WRITING_GUIDELINES_PT}

LADDER DISCIPLINE (default):
- O bloco LADDER STATUS pré-computa o foco da semana. Sugira itens APENAS do tópico marcado FOCO ATUAL e dos tópicos sólidos (estes pra revisão leve).
- Não sugira itens de tópicos "bloqueados". A base não está madura.
- Reflexões individuais são sinal de DIFICULDADE dentro do tópico atual, não de mudança de foco. Insegurança no FOCO ATUAL → itens mais fáceis no MESMO tópico. Insegurança num bloqueado → recue pro foco.

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

    const promptSections = [
      memberLine,
      statsLine,
      outcomesBlock,
      retroBlock,
      ladderBlock,
      studyTimeBlock,
      currentPlanBlock,
      carryOverBlock,
      carryOverResolvedBlock,
      briefBlock,
    ].filter((s): s is string => Boolean(s));
    const userPrompt = promptSections.join('\n\n');

    const executor = makeLibraryToolExecutor(this.library);
    const result = await this.chat.callJsonWithTools<Draft>({
      system,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [searchLibraryTool],
      executeTool: executor,
      maxIterations: 5,
      // Reasoning tokens are billed against max_completion_tokens, so the old
      // 2500 ceiling would burn the whole budget thinking and come back with
      // empty content ("No text content in response").
      maxTokens: 16000,
      model: DRAFT_MODEL,
      reasoningEffort: 'xhigh',
    });

    const draft: Draft = {
      items: (result.data as any)?.items ?? [],
      alternates: (result.data as any)?.alternates ?? [],
      narrative: (result.data as any)?.narrative ?? '',
      totalMinutes: (result.data as any)?.totalMinutes ?? 0,
    };

    await this.usage.log({
      userId: input.memberId,
      purpose: 'draft_plan',
      model: DRAFT_MODEL,
      usage: result.usage,
      metadata: {
        weekStart: input.weekStart.toISOString(),
        carryOverCount: carryOverIds.length,
        hasBrief: !!(input.briefText && input.briefText.trim().length > 0),
        toolCalls: result.toolCalls.length,
      },
    });

    return { draft, usage: result.usage };
  }
}
