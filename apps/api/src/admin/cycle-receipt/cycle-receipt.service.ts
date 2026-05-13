import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CycleReceiptResponse, ReceiptMode } from './cycle-receipt.types.js';

@Injectable()
export class CycleReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async build(cycleId: string, asOf: Date): Promise<CycleReceiptResponse> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { user: { select: { id: true, name: true, pictureUrl: true } } },
        },
      },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    const now = new Date();
    if (cycle.status === 'UPCOMING' && cycle.startsAt > now) {
      throw new ConflictException({ error: { code: 'CYCLE_NOT_STARTED' } });
    }

    const minAsOf = cycle.startsAt;
    const maxAsOf = new Date(Math.min(now.getTime(), cycle.endsAt.getTime()));
    if (asOf < minAsOf || asOf > maxAsOf) {
      throw new BadRequestException({ error: { code: 'INVALID_AS_OF' } });
    }

    return this.assembleResponse(cycle, asOf);
  }

  private async assembleResponse(cycle: any, asOf: Date): Promise<CycleReceiptResponse> {
    const mode = this.decideMode(cycle, asOf);
    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        weekNumber: 0,
        weeksTotal: 0,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        status: cycle.status,
      },
      asOf: asOf.toISOString(),
      mode,
      totals: {
        members: cycle.memberships.length,
        totalMinutes: 0,
        avgMinutesPerMember: 0,
        itemsCompleted: 0,
        retros: 0,
        classesHeld: 0,
        classesTotal: 0,
        attendanceRate: 0,
      },
      byTopic: [],
      knowledgeGrid: { members: [], topics: [], cells: [] },
      topMovers: [],
      cycleTopMover: null,
      streakChampion: null,
      retroChampions: [],
      perfectAttendance: [],
    };
  }

  private decideMode(cycle: any, asOf: Date): ReceiptMode {
    if (cycle.status === 'ARCHIVED') return 'wrapped';
    const asOfKey = asOf.toISOString().slice(0, 10);
    const endKey = (cycle.endsAt as Date).toISOString().slice(0, 10);
    if (asOfKey === endKey) return 'wrapped';
    return 'thermal';
  }
}
