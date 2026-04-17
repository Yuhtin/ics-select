import { Injectable } from '@nestjs/common';
import type { Track } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';

export type AvailabilityInput = {
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  preferredSessionMinutes: number;
  timezone: string;
};

export type ProfileInput = {
  whatsappPhone?: string | null;
  targetTrack?: Track | null;
};

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  get(userId: string) {
    return this.prisma.memberAvailability.findUnique({ where: { userId } });
  }

  upsert(userId: string, input: AvailabilityInput) {
    return this.prisma.memberAvailability.upsert({
      where: { userId },
      create: { userId, ...input },
      update: { ...input },
    });
  }

  async updateProfile(userId: string, input: ProfileInput) {
    let user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (input.whatsappPhone !== undefined) {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { whatsappPhone: input.whatsappPhone },
      });
    }

    let membership = null;
    if (input.targetTrack !== undefined) {
      const existing = await this.prisma.cycleMembership.findFirst({
        where: { userId, cycle: { status: 'ACTIVE' } },
      });
      if (existing) {
        membership = await this.prisma.cycleMembership.update({
          where: { id: existing.id },
          data: { track: input.targetTrack },
        });
      }
    }

    return { user, membership };
  }
}
