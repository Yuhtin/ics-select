import { Injectable } from '@nestjs/common';
import { OpenAiChatProvider, MODEL } from '../common/openai/openai-chat.provider.js';
import { LibraryService } from '../library/library.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { UsageLoggerService } from './usage-logger.service.js';

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

    // 6) Candidate items for the week
    let candidates: any[] = await this.library.search({
      tracks: track ? [track] : undefined,
      limit: 30,
    });
    if (!candidates || candidates.length === 0) {
      const fallback = await this.library.list();
      candidates = (fallback as any[]).slice(0, 30);
    }

    // Pre-pend carry-over library items (dedup by id) so their IDs are always available.
    const seen = new Set<string>();
    const mergedCandidates: any[] = [];
    for (const co of carryOverItems) {
      const li = co.libraryItem;
      if (li && !seen.has(li.id)) {
        seen.add(li.id);
        mergedCandidates.push(li);
      }
    }
    for (const c of candidates) {
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        mergedCandidates.push(c);
      }
    }

    // 7) Build user prompt sections
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

    const briefBlock = `BRIEF DO ADMIN:\n${input.briefText && input.briefText.trim().length > 0 ? input.briefText.trim() : '(nenhum)'}`;

    const candidatesLines = mergedCandidates.slice(0, 40).map((c: any) => {
      const topicLabel = c.topic?.label ?? 'sem tópico';
      return `- id=${c.id} "${c.title}" topic=${topicLabel} format=${c.format} difficulty=${c.difficulty} minutes=${c.estimatedMinutes}`;
    });
    const candidatesBlock = `CANDIDATOS DO ACERVO:\n${candidatesLines.join('\n')}`;

    const system = `Você é o copiloto do Diretor Educacional do ICS Select. Sua tarefa é montar um plano semanal
de 4 a 7 itens para um membro, baseado em:
- o track do membro
- as últimas 4 semanas de resultados (outcomes + reflexões)
- o retrô mais recente (se houver)
- a cobertura de tópicos do ciclo (onde o membro está atrasado)
- carry-overs que o admin já marcou pra trazer de volta
- brief opcional do admin com direção extra

Responda APENAS com JSON válido:
{
  "items": [{"libraryItemId": "<id>", "order": <int>, "rationale": "1-2 frases em pt-BR"}],
  "alternates": [{"libraryItemId": "<id>", "rationale": "..."}],
  "narrative": "1 parágrafo curto em pt-BR resumindo o foco da semana",
  "totalMinutes": <sum of estimatedMinutes>
}

Regras:
- Não invente IDs. Use apenas IDs da lista de candidatos.
- Carry-overs DEVEM aparecer em "items" (não em "alternates") se o admin os marcou.
- Ordem pedagógica: fundamentos antes de avançado. Difícil depois de médio.
- "alternates" tem 3 itens: opções extras que o admin pode querer.
- "rationale" de cada item deve ligar o item ao contexto.`;

    const userPrompt = [
      memberLine,
      outcomesBlock,
      retroBlock,
      coverageBlock,
      carryOverBlock,
      briefBlock,
      candidatesBlock,
    ].join('\n\n');

    const result = await this.chat.callJson<Draft>({
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 2000,
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
      },
    });

    return { draft, usage: result.usage };
  }
}
