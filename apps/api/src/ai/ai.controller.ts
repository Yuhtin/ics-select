import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Res,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { DraftPlanService } from './draft-plan.service.js';
import { BriefPlanService } from './brief-plan.service.js';
import { DiagnoseService } from './diagnose.service.js';
import { ChatService } from './chat.service.js';
import { UsageLoggerService } from './usage-logger.service.js';

const DraftInputSchema = z.object({
  memberId: z.string().min(1),
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  carryOverItemIds: z.array(z.string()).optional(),
  briefText: z.string().optional(),
});

const BriefInputSchema = z.object({
  memberId: z.string().min(1),
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  briefText: z.string().min(1),
  carryOverItemIds: z.array(z.string()).optional(),
});

const ChatInputSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
    }),
  ),
});

/**
 * Anything OpenAI throws (model not found, quota, truncated response) reaches
 * the global filter as a bare Error and comes out as a masked 500 — the admin
 * then has to go read container logs to learn which of those it was. These
 * routes are ADMIN-only, so keep the upstream message in the envelope.
 */
async function withUpstreamDetail<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof HttpException) throw err;
    throw new HttpException(
      {
        error: {
          code: 'AI_UPSTREAM',
          message: (err as Error)?.message ?? 'unknown upstream failure',
        },
      },
      502,
    );
  }
}

@Roles('ADMIN')
@Controller()
export class AiController {
  constructor(
    private readonly draft: DraftPlanService,
    private readonly brief: BriefPlanService,
    private readonly diagnose: DiagnoseService,
    private readonly chat: ChatService,
    private readonly usage: UsageLoggerService,
  ) {}

  @Post('ai/draft-plan')
  runDraft(@Body() body: unknown) {
    const parsed = DraftInputSchema.parse(body);
    return withUpstreamDetail(() => this.draft.run(parsed));
  }

  @Post('ai/brief-plan')
  runBrief(@Body() body: unknown) {
    const parsed = BriefInputSchema.parse(body);
    return withUpstreamDetail(() => this.brief.run(parsed));
  }

  @Get('members/:id/diagnose')
  runDiagnose(@Param('id') id: string) {
    return withUpstreamDetail(() => this.diagnose.run(id));
  }

  @Post('members/:memberId/chat')
  async streamChat(
    @Param('memberId') memberId: string,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const parsed = ChatInputSchema.parse(body);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    try {
      for await (const token of this.chat.stream(memberId, parsed.messages)) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
      res.end();
    }
  }

  @Get('ai/usage')
  async getUsage(@Query('sinceDays') sinceDays?: string) {
    const days = Number(sinceDays ?? 7);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.usage.getUsageForWeek(since);
    const totalCost = rows.reduce(
      (sum, r) => sum + Number(r.costUsd),
      0,
    );
    return { rows, totalCost };
  }
}
