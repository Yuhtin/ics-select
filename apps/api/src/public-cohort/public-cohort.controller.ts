import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { resolveActiveCycle } from '../common/cycle/active-cycle.js';
import { PrismaService } from '../common/prisma/prisma.service.js';

type PublicMember = { name: string; avatar: string | null };

@Controller('public')
export class PublicCohortController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('cohort')
  async cohort(): Promise<{ cycle: string | null; members: PublicMember[] }> {
    const active = await resolveActiveCycle(this.prisma);
    if (!active) return { cycle: null, members: [] };

    const memberships = await this.prisma.cycleMembership.findMany({
      where: { cycleId: active.id, user: { role: 'MEMBER' } },
      orderBy: { joinedAt: 'asc' },
      select: { user: { select: { name: true, pictureUrl: true } } },
    });

    const members: PublicMember[] = memberships.map((m) => ({
      name: m.user.name,
      avatar: m.user.pictureUrl ?? null,
    }));

    return { cycle: active.name, members };
  }
}
