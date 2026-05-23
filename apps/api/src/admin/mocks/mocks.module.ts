import { Module } from '@nestjs/common';
import { MocksService } from './mocks.service.js';
import { MocksController } from './mocks.controller.js';

@Module({
  providers: [MocksService],
  controllers: [MocksController],
  exports: [MocksService],
})
export class MocksModule {}
