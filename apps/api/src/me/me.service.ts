import { Injectable, NotFoundException } from '@nestjs/common';
import type { ThemePreference } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async exportForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    const [availability, memberships, plans, attendance] = await Promise.all([
      this.prisma.memberAvailability.findUnique({ where: { userId } }),
      this.prisma.cycleMembership.findMany({ where: { userId }, include: { cycle: true } }),
      this.prisma.weeklyPlan.findMany({
        where: { userId },
        include: {
          items: {
            include: { libraryItem: true },
            orderBy: { order: 'asc' },
          },
        },
      }),
      this.prisma.classAttendance.findMany({
        where: { userId },
        include: { classSession: true },
      }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
        role: user.role,
        privacyAcceptedAt: user.privacyAcceptedAt,
        createdAt: user.createdAt,
      },
      availability,
      memberships,
      plans,
      attendance,
    };
  }

  async deleteUser(userId: string) {
    // Prisma cascade rules already clean most relations. Google Calendar events are
    // best-effort cleaned up in a future hook; for now we just delete the user.
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }

  async updateThemePreference(userId: string, preference: ThemePreference) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        themePreference: preference,
        themePreferenceAt: new Date(),
      },
    });
    return { ok: true };
  }
}
