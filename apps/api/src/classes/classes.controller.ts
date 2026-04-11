import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ClassesService } from './classes.service.js';

const CreateClassSchema = z.object({
  title: z.string().min(1),
  topic: z.string().nullable(),
  scheduledAt: z.coerce.date(),
  durationMin: z.number().int().positive().default(90),
  notes: z.string().optional(),
});

const AttendanceBatchSchema = z.object({
  rows: z.array(
    z.object({
      userId: z.string().min(1),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE']),
    }),
  ),
});

@Roles('ADMIN')
@Controller()
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get('cycles/:cycleId/classes')
  list(@Param('cycleId') cycleId: string) {
    return this.classes.listForCycle(cycleId);
  }

  @Post('cycles/:cycleId/classes')
  create(@Param('cycleId') cycleId: string, @Body() body: unknown) {
    const parsed = CreateClassSchema.parse(body);
    return this.classes.createForCycle(cycleId, parsed);
  }

  @Post('classes/:classId/attendance')
  batch(@Param('classId') classId: string, @Body() body: unknown) {
    const parsed = AttendanceBatchSchema.parse(body);
    return this.classes.markBatchAttendance(classId, parsed.rows);
  }

  @Get('classes/:classId/attendance')
  listAttendance(@Param('classId') classId: string) {
    return this.classes.listAttendance(classId);
  }
}
