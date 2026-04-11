import { Injectable } from '@nestjs/common';
import { OpenAiChatProvider } from '../common/openai/openai-chat.provider.js';
import { WeeklyPlansService } from '../weekly-plans/weekly-plans.service.js';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

@Injectable()
export class ChatService {
  constructor(
    private readonly chat: OpenAiChatProvider,
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

    for await (const token of this.chat.stream({
      system,
      messages,
      maxTokens: 1500,
    })) {
      yield token;
    }
  }
}
