import { Module } from '@nestjs/common';
import { MemberDetailService } from './member-detail.service.js';
import { MemberDetailController } from './member-detail.controller.js';

@Module({
  providers: [MemberDetailService],
  controllers: [MemberDetailController],
})
export class MemberDetailModule {}
