import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class AdminChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List a member's challenge attempts ordered newest-first. The cockpit
   * tab consumes this directly. Joins the library item so the card can
   * render the title without an extra round-trip.
   */
  listForMember(userId: string, cycleId?: string | null) {
    return this.prisma.challengeAttempt.findMany({
      where: {
        userId,
        ...(cycleId ? { cycleId } : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: {
        libraryItem: { select: { id: true, title: true, url: true } },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.challengeAttempt.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('attempt not found');
    await this.prisma.challengeAttempt.delete({ where: { id } });
  }
}
