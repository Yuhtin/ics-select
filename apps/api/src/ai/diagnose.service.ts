import { Injectable } from '@nestjs/common';
import { OpenAiChatProvider, MODEL } from '../common/openai/openai-chat.provider.js';
import { WeeklyPlansService } from '../weekly-plans/weekly-plans.service.js';
import { UsageLoggerService } from './usage-logger.service.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = { markdown: string; expiresAt: number };

@Injectable()
export class DiagnoseService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly chat: OpenAiChatProvider,
    private readonly plans: WeeklyPlansService,
    private readonly usage: UsageLoggerService,
  ) {}

  async run(memberId: string): Promise<{ markdown: string; cached: boolean }> {
    const cached = this.cache.get(memberId);
    if (cached && cached.expiresAt > Date.now()) {
      return { markdown: cached.markdown, cached: true };
    }

    const history = await this.plans.listForMember(memberId);
    if (history.length === 0) {
      return {
        markdown:
          '## Diagnóstico\n\nNenhum histórico ainda. Assim que o primeiro plano for concluído poderei oferecer uma análise.',
        cached: false,
      };
    }

    const summary = history
      .map((p: any) => {
        const items = (p.items ?? [])
          .map(
            (i: any) =>
              `  - [${i.outcome}] "${i.libraryItem?.title ?? i.libraryItemId}"${
                i.reflection ? `\n    reflexão: ${i.reflection}` : ''
              }`,
          )
          .join('\n');
        return `Semana ${new Date(p.weekStart).toLocaleDateString('pt-BR')} — ${p.status}\n${items}`;
      })
      .join('\n\n');

    const system = `Você é um assistente pedagógico do ICS Select. Escreva um diagnóstico em markdown (pt-BR) sobre o membro, com as seções:
## Pontos fortes
## Pontos fracos
## Padrões observados
## Sugestão para a próxima semana

Seja direto e prático. Cite itens e tags específicos. Não passe de 300 palavras.`;

    const result = await this.chat.callText({
      system,
      messages: [{ role: 'user', content: summary }],
      maxTokens: 1000,
    });

    this.cache.set(memberId, {
      markdown: result.text,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    await this.usage.log({
      userId: memberId,
      purpose: 'diagnose',
      model: MODEL,
      usage: result.usage,
    });

    return { markdown: result.text, cached: false };
  }
}
