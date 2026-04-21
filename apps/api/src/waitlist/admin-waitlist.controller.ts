import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ListWaitlistQuerySchema } from './dto/list-waitlist.query.js';
import { WaitlistService } from './waitlist.service.js';

@Roles('ADMIN')
@Controller('admin/waitlist')
export class AdminWaitlistController {
  constructor(private readonly service: WaitlistService) {}

  @Get()
  list(@Query() query: unknown) {
    const parsed = ListWaitlistQuerySchema.safeParse(query);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new BadRequestException(`invalid query — ${detail}`);
    }
    return this.service.list(parsed.data);
  }

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get('export')
  async exportCsv(@Res() res: Response) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="waitlist-${today}.csv"`);

    const header = 'createdAt,name,email,course,skillLevel,github,linkedin,wantsUpdates,cycleTarget';
    res.write(header + '\n');

    for await (const row of this.service.iterateAll()) {
      const line = [
        row.createdAt.toISOString(),
        csvEscape(row.name),
        row.email,
        row.course,
        String(row.skillLevel),
        csvEscape(row.github ?? ''),
        csvEscape(row.linkedin ?? ''),
        row.wantsUpdates ? 'true' : 'false',
        row.cycleTarget,
      ].join(',');
      res.write(line + '\n');
    }
    res.end();
  }
}

function csvEscape(v: string): string {
  if (v === '') return '';
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
