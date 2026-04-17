import { Injectable } from '@nestjs/common';
import { OpenAiChatProvider, MODEL } from '../common/openai/openai-chat.provider.js';
import { LibraryService } from '../library/library.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { UsageLoggerService } from './usage-logger.service.js';
import { searchLibraryTool, makeLibraryToolExecutor } from './library-tool.js';

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
    const membership = await this.prisma.cycleMembership.findFirst({
      where: { userId: input.memberId, cycle: { status: 'ACTIVE' } },
      include: { cycle: true, user: true },
    });
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
                topicId: true,
                topic: { select: { label: true } },
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
                  topicId: true,
                  topic: { select: { label: true } },
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

    // 5) Topic coverage (last 4 weeks): planned + done counts per topic label.
    const topicCoverage = new Map<string, { planned: number; done: number }>();
    for (const plan of recentPlans) {
      for (const item of plan.items ?? []) {
        const label = item.libraryItem?.topic?.label ?? 'sem tópico';
        const cur = topicCoverage.get(label) ?? { planned: 0, done: 0 };
        cur.planned += 1;
        if (item.outcome === 'DONE_EASY' || item.outcome === 'DONE_HARD') cur.done += 1;
        topicCoverage.set(label, cur);
      }
    }

    // 6) Build user prompt sections
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

    const coverageLines: string[] = [];
    for (const [label, counts] of topicCoverage.entries()) {
      coverageLines.push(`- ${label}: ${counts.planned} planejados, ${counts.done} concluídos`);
    }
    const coverageBlock =
      `COBERTURA DE TÓPICOS:\n` +
      (coverageLines.length > 0 ? coverageLines.join('\n') : '(sem dados)');

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
        const topicLabel = li.topic?.label ?? 'sem tópico';
        return `- id=${li.id} "${li.title}" topic=${topicLabel} format=${li.format} difficulty=${li.difficulty} minutes=${li.estimatedMinutes}`;
      })
      .filter(Boolean);
    const carryOverResolvedBlock =
      carryOverResolvedLines.length > 0
        ? `CARRY-OVER RESOLVIDO:\n${carryOverResolvedLines.join('\n')}`
        : null;

    const briefBlock = `BRIEF DO ADMIN:\n${input.briefText && input.briefText.trim().length > 0 ? input.briefText.trim() : '(nenhum)'}`;

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
- Ordem pedagógica: fundamentos antes de avançado, médio antes de difícil.
- "alternates" tem até 3 itens extras.
- "rationale" liga o item ao contexto (ex: gap do ciclo, padrão da reflexão, nível).`;

    const promptSections = [
      memberLine,
      outcomesBlock,
      retroBlock,
      coverageBlock,
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
      maxTokens: 2500,
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
      model: MODEL,
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
