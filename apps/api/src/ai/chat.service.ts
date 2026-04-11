import { Injectable } from '@nestjs/common';
import { AnthropicProvider } from '../common/anthropic/anthropic.provider.js';
import { WeeklyPlansService } from '../weekly-plans/weekly-plans.service.js';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

@Injectable()
export class ChatService {
  constructor(
    private readonly anthropic: AnthropicProvider,
    private readonly plans: WeeklyPlansService,
  ) {}

  async buildContext(memberId: string): Promise<string> {
    const history = await this.plans.listForMember(memberId);
    if (history.length === 0) return 'O membro ainda não tem histórico.';
    const summary = history
      .slice(0, 4)
      .map((p: any) => {
        const items = (p.items ?? [])
          .map(
            (i: any) =>
              `${i.libraryItem?.title ?? i.libraryItemId} (${i.status}${
                i.difficultyRating ? ` ${i.difficultyRating}` : ''
              })`,
          )
          .join('; ');
        return `Semana ${new Date(p.weekStart).toLocaleDateString('pt-BR')}: ${items}`;
      })
      .join('\n');
    return summary;
  }

  async *stream(memberId: string, messages: ChatMessage[]) {
    const context = await this.buildContext(memberId);
    const system = `Você é um assistente pedagógico do ICS Select. Abaixo vai o contexto do membro sobre o qual o admin está perguntando. Responda em pt-BR, direto ao ponto.

CONTEXTO DO MEMBRO:
${context}`;

    const streamResp = this.anthropic.stream({
      system,
      messages,
      maxTokens: 1500,
    });

    for await (const event of streamResp) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}
