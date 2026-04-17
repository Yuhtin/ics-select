import { Injectable } from '@nestjs/common';
import type { AlertType } from '@ics-select/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';

type DismissInput = { alertType: AlertType; targetId: string };

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async dismiss(userId: string, input: DismissInput) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    return this.prisma.dismissedAlert.create({
      data: {
        userId,
        alertType: input.alertType,
        targetId: input.targetId,
        expiresAt,
      },
    });
  }
}
