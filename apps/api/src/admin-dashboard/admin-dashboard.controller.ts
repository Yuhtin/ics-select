import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AdminDashboardService } from './admin-dashboard.service.js';

@Roles('ADMIN')
@Controller('admin')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('dashboard')
  getCohort() {
    return this.dashboard.getCohort();
  }

  @Get('members/:id/overview')
  getOverview(@Param('id') id: string) {
    return this.dashboard.getMemberOverview(id);
  }
}
