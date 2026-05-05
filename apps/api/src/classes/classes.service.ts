import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type CreateClassInput = {
  title: string;
  topic: string | null;
  scheduledAt: Date;
  durationMin: number;
  notes?: string;
};

type AttendanceRow = { userId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' };

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  createForCycle(cycleId: string, input: CreateClassInput) {
    return this.prisma.classSession.create({
      data: { cycleId, ...input },
    });
  }

  listForCycle(cycleId: string) {
    return this.prisma.classSession.findMany({
      where: { cycleId },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async markBatchAttendance(classSessionId: string, rows: AttendanceRow[]) {
    for (const row of rows) {
      await this.prisma.classAttendance.upsert({
        where: { classSessionId_userId: { classSessionId, userId: row.userId } },
        create: { classSessionId, userId: row.userId, status: row.status },
        update: { status: row.status },
      });
    }
    return { ok: true, count: rows.length };
  }

  listAttendance(classSessionId: string) {
    return this.prisma.classAttendance.findMany({ where: { classSessionId } });
  }
}
