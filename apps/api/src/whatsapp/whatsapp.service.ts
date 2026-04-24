import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { EvolutionApiClient } from './evolution.client.js';

export type WhatsappKind =
  | 'session_reminder'
  | 'stuck_alert'
  | 'plan_published'
  | 'retro_reminder'
  | 'test';

type SendInput = {
  userId: string;
  kind: WhatsappKind;
  to: string;
  text: string;
};

@Injectable()
export class WhatsappService {
  constructor(
    private readonly client: EvolutionApiClient,
    private readonly prisma: PrismaService,
  ) {}

  async send(input: SendInput) {
    const result = await this.client.sendText({ to: input.to, text: input.text });
    await this.prisma.whatsappLog.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        payload: { to: input.to, text: input.text },
        deliveredAt: result.ok ? new Date() : null,
        error: result.ok ? null : result.error ?? 'unknown',
      },
    });
    return result;
  }
}
