import { Injectable } from '@nestjs/common';
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
}
