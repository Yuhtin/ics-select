import { Injectable } from '@nestjs/common';
import { OpenAiChatProvider, MODEL } from '../common/openai/openai-chat.provider.js';
import { LibraryService } from '../library/library.service.js';
import { WeeklyPlansService } from '../weekly-plans/weekly-plans.service.js';
import { UsageLoggerService } from './usage-logger.service.js';

type Draft = {
  items: Array<{ libraryItemId: string; order: number; rationale: string }>;
  narrative: string;
  totalMinutes: number;
};

@Injectable()
export class DraftPlanService {
  constructor(
    private readonly chat: OpenAiChatProvider,
    private readonly library: LibraryService,
    private readonly plans: WeeklyPlansService,
    private readonly usage: UsageLoggerService,
  ) {}

  async run(input: { memberId: string; basePlanId?: string }) {
    const history = await this.plans.listForMember(input.memberId);
    const lastPlan = history[0];

    // Gather candidate items. Strategy: if the last plan had DONE_HARD or STUCK outcomes on
    // specific tags, search for more items on those tags. Otherwise pull a general pool.
    const targetTags = new Set<string>();
    for (const item of lastPlan?.items ?? []) {
      if ((item as any).outcome === 'DONE_HARD' || (item as any).outcome === 'STUCK') {
        for (const tag of (item as any).libraryItem?.tags ?? []) targetTags.add(tag);
      }
    }
    const candidates = targetTags.size > 0
      ? await this.library.search({ tags: Array.from(targetTags), limit: 20 })
      : await this.library.list();

    const historyText = (lastPlan?.items ?? [])
      .map(
        (i: any) =>
          `- [${i.outcome}] ${i.libraryItem?.title ?? i.libraryItemId}${
            i.reflection ? ` — "${i.reflection}"` : ''
          }`,
      )
      .join('\n');

    const candidatesText = (candidates as any[])
      .slice(0, 20)
      .map(
        (c: any) =>
          `- id=${c.id} "${c.title}" format=${c.format} difficulty=${c.difficulty} minutes=${c.estimatedMinutes} tags=${(c.tags ?? []).join(',')}`,
      )
      .join('\n');

    const system = `Você é um assistente pedagógico do ICS Select. Sua missão é montar o próximo plano de estudo semanal de um membro do programa de preparação para entrevistas técnicas. Leve em conta o histórico (o que o membro marcou como difícil, as reflexões, itens travados) e escolha 4 a 7 itens do acervo disponível, em ordem pedagógica (fundamentos antes de avançado).

Responda APENAS com JSON válido no formato exato:
{
  "items": [{"libraryItemId": "...", "order": 0, "rationale": "..."}],
  "narrative": "Uma frase explicando o foco da semana em pt-BR",
  "totalMinutes": <soma dos estimatedMinutes dos itens escolhidos>
}

Não invente IDs. Use apenas IDs da lista de candidatos.`;

    const user = `Plano anterior do membro:
${historyText || '(nenhum plano anterior)'}

Acervo disponível (candidatos):
${candidatesText}

Monte o plano da próxima semana.`;

    const result = await this.chat.callJson<Draft>({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1500,
    });

    await this.usage.log({
      userId: input.memberId,
      purpose: 'draft_plan',
      model: MODEL,
      usage: result.usage,
      metadata: { basePlanId: input.basePlanId ?? null },
    });

    return { draft: result.data, usage: result.usage };
  }
}
