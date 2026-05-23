import { Injectable } from '@nestjs/common';
import { OpenAiChatProvider, MODEL } from '../common/openai/openai-chat.provider.js';
import { WeeklyPlansService } from '../weekly-plans/weekly-plans.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { UsageLoggerService } from './usage-logger.service.js';
import { WRITING_GUIDELINES_PT } from './writing-guidelines.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MOCK_HISTORY_LIMIT = 5;

type CacheEntry = { markdown: string; expiresAt: number };

@Injectable()
export class DiagnoseService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly chat: OpenAiChatProvider,
    private readonly plans: WeeklyPlansService,
    private readonly prisma: PrismaService,
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

    const recentMocks = await this.prisma.mockInterview.findMany({
      where: { userId: memberId },
      orderBy: { conductedAt: 'desc' },
      take: MOCK_HISTORY_LIMIT,
    });

    const planSummary = history
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

    // Mocks bloco: vazio quando o admin ainda não registrou nenhum. Score na
    // escala 1-5 (1=No Hire, 5=Strong Hire) — documentado no tooltip da UI.
    // Limitado aos 5 mais recentes pra caber no prompt; ordem cronológica
    // permite ao LLM enxergar evolução ("3→4→4 no CODING").
    const mockSummary =
      recentMocks.length > 0
        ? recentMocks
            .map((m) => {
              const date = m.conductedAt.toLocaleDateString('pt-BR');
              const topics = m.topics.length > 0 ? ` · tópicos: ${m.topics.join(', ')}` : '';
              const feedback = m.feedback ? `\n    feedback: ${m.feedback.replace(/\s+/g, ' ').trim()}` : '';
              return `  - ${date} [${m.type}] score ${m.score}/5${topics}${feedback}`;
            })
            .join('\n')
        : '(nenhum mock registrado)';

    const summary =
      `HISTÓRICO DE PLANOS:\n${planSummary}\n\n` +
      `MOCK INTERVIEWS (últimos ${MOCK_HISTORY_LIMIT}):\n${mockSummary}`;

    const system = `Você é um assistente pedagógico do ICS Select. Escreva um diagnóstico em markdown (pt-BR) sobre o membro, com as seções:
## Pontos fortes
## Pontos fracos
## Padrões observados
## Sugestão para a próxima semana

Use TODOS os sinais disponíveis: outcomes dos planos, reflexões textuais, e o histórico de mocks (quando existir). Mocks são entrevistas simuladas com nota 1-5; uma sequência crescente é evolução, uma decrescente é regressão. Conecte fraquezas dos mocks a tópicos da library (ex: "score 2/5 em CODING/recursion implica priorizar tree-traversal").

Direto e prático. Cite títulos de itens e slugs de tópicos. Limite 300 palavras.

${WRITING_GUIDELINES_PT}`;

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
