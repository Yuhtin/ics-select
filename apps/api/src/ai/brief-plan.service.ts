import { Injectable } from '@nestjs/common';
import { OpenAiChatProvider, MODEL } from '../common/openai/openai-chat.provider.js';
import { LibraryService } from '../library/library.service.js';
import { UsageLoggerService } from './usage-logger.service.js';

type Draft = {
  items: Array<{ libraryItemId: string; order: number; rationale: string }>;
  narrative: string;
  totalMinutes: number;
};

@Injectable()
export class BriefPlanService {
  constructor(
    private readonly chat: OpenAiChatProvider,
    private readonly library: LibraryService,
    private readonly usage: UsageLoggerService,
  ) {}

  async run(input: { memberId: string; briefText: string }) {
    const candidates = await this.library.search({ query: input.briefText, limit: 20 });
    const candidatesText = (candidates as any[])
      .map(
        (c: any) =>
          `- id=${c.id} "${c.title}" format=${c.format} difficulty=${c.difficulty} minutes=${c.estimatedMinutes}`,
      )
      .join('\n');

    const system = `Você é um assistente pedagógico do ICS Select. O admin te deu um brief do que quer pra semana de um membro. Escolha 4 a 7 itens do acervo disponível que satisfaçam o brief, em ordem pedagógica. Responda APENAS com JSON válido:
{
  "items": [{"libraryItemId": "...", "order": 0, "rationale": "..."}],
  "narrative": "Uma frase em pt-BR",
  "totalMinutes": <soma>
}

Não invente IDs.`;

    const user = `Brief do admin: "${input.briefText}"

Acervo disponível:
${candidatesText}`;

    const result = await this.chat.callJson<Draft>({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1500,
    });

    await this.usage.log({
      userId: input.memberId,
      purpose: 'brief_plan',
      model: MODEL,
      usage: result.usage,
      metadata: { briefText: input.briefText },
    });

    return { draft: result.data, usage: result.usage };
  }
}
