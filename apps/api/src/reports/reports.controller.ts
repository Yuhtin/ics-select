import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ReportsService } from './reports.service.js';

@Roles('ADMIN')
@Controller('cycles')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':id/report')
  async download(@Param('id') id: string, @Res() res: Response) {
    const md = await this.reports.buildCycleReport(id);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cycle-${id}.md"`);
    res.send(md);
  }
}
