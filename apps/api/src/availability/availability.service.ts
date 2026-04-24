import { BadRequestException, Injectable } from '@nestjs/common';
import type { Track } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  resolveActiveCycle,
  resolveActiveMembership,
} from '../common/cycle/active-cycle.js';
import {
  SlotValidationError,
  validateSlots,
} from './slot-validation.js';
import type {
  AvailabilityFullResponse,
  AvailabilityPatchInput,
} from './availability.types.js';

export type ProfileInput = {
  whatsappPhone?: string | null;
  targetTrack?: Track | null;
};

const CAP_KEYS = [
  'mondayMinutes',
  'tuesdayMinutes',
  'wednesdayMinutes',
  'thursdayMinutes',
  'fridayMinutes',
  'saturdayMinutes',
  'sundayMinutes',
] as const;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<AvailabilityFullResponse | null> {
    const availability = await this.prisma.memberAvailability.findUnique({
      where: { userId },
    });
    const slots = await this.prisma.availabilitySlot.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
    if (!availability) return null;
    return {
      mondayMinutes: availability.mondayMinutes ?? null,
      tuesdayMinutes: availability.tuesdayMinutes ?? null,
      wednesdayMinutes: availability.wednesdayMinutes ?? null,
      thursdayMinutes: availability.thursdayMinutes ?? null,
      fridayMinutes: availability.fridayMinutes ?? null,
      saturdayMinutes: availability.saturdayMinutes ?? null,
      sundayMinutes: availability.sundayMinutes ?? null,
      preferredSessionMinutes: availability.preferredSessionMinutes,
      timezone: availability.timezone,
      slots: slots.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      })),
    };
  }

  async upsert(
    userId: string,
    input: AvailabilityPatchInput,
  ): Promise<AvailabilityFullResponse> {
    if (input.slots && input.slots.length > 0) {
      try {
        validateSlots(input.slots);
      } catch (err) {
        if (err instanceof SlotValidationError) {
          throw new BadRequestException({
            error: {
              code: 'BAD_REQUEST',
              message: err.message,
              details: { field: 'slots', reason: err.reason, dayOfWeek: err.dayOfWeek },
            },
          });
        }
        throw err;
      }
    }

    const capsData: Record<string, number | null | undefined> = {};
    for (const key of CAP_KEYS) {
      if (input[key] !== undefined) capsData[key] = input[key]!;
    }

    const daysWithSlots = new Set<number>();
    for (const s of input.slots ?? []) daysWithSlots.add(s.dayOfWeek);
    const clearDays = new Set<number>([...(input.clearDays ?? []), ...daysWithSlots]);

    await this.prisma.$transaction(async (tx) => {
      await tx.memberAvailability.upsert({
        where: { userId },
        create: {
          userId,
          ...capsData,
          preferredSessionMinutes: input.preferredSessionMinutes ?? 60,
          timezone: input.timezone ?? 'America/Sao_Paulo',
        },
        update: {
          ...capsData,
          ...(input.preferredSessionMinutes !== undefined && {
            preferredSessionMinutes: input.preferredSessionMinutes,
          }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
        },
      });

      if (clearDays.size > 0) {
        await tx.availabilitySlot.deleteMany({
          where: { userId, dayOfWeek: { in: Array.from(clearDays) } },
        });
      }

      if (input.slots && input.slots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: input.slots.map((s) => ({
            userId,
            dayOfWeek: s.dayOfWeek,
            startMinute: s.startMinute,
            endMinute: s.endMinute,
          })),
        });
      }
    });

    return (await this.get(userId))!;
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
        const active = await resolveActiveCycle(this.prisma);
        if (active) {
          membership = await this.prisma.cycleMembership.create({
            data: {
              userId,
              cycleId: active.id,
              track: input.targetTrack,
            },
          });
          if (user?.email) {
            await this.prisma.invitedEmail.deleteMany({
              where: { email: user.email },
            });
          }
        }
      }
    }

    return { user, membership };
  }
}
