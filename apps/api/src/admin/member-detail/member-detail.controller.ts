import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { MemberDetailService } from './member-detail.service.js';

@Roles('ADMIN')
@Controller('admin/member')
export class MemberDetailController {
  constructor(private readonly svc: MemberDetailService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.getDetail(id);
  }
}
