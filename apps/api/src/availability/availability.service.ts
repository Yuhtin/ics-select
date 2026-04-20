import { Injectable } from '@nestjs/common';
import type { Track } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  resolveActiveCycle,
  resolveActiveMembership,
} from '../common/cycle/active-cycle.js';

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
      const existing = await resolveActiveMembership(this.prisma, userId);
      if (existing) {
        membership = await this.prisma.cycleMembership.update({
          where: { id: existing.id },
          data: { track: input.targetTrack },
        });
      } else {
        // No membership yet — e.g. member just finished first login and the
        // admin hasn't enrolled them manually. Auto-enroll in THE active
        // cycle (resolveActiveCycle is the canonical picker) so the
        // onboarding form can actually persist the chosen track. If there's
        // no active cycle at all we leave track unset; the onboarding gate
        // will keep the member stuck, which is the correct signal (they
        // shouldn't be in the app until there's a cycle to belong to).
        const active = await resolveActiveCycle(this.prisma);
        if (active) {
          membership = await this.prisma.cycleMembership.create({
            data: {
              userId,
              cycleId: active.id,
              track: input.targetTrack,
            },
          });
        }
      }
    }

    return { user, membership };
  }
}
