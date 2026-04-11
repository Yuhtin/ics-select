import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [PrismaModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
