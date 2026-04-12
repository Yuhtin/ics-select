import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator.js';
import { PrismaService } from '../common/prisma/prisma.service.js';

const InterestSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
});

@Controller('interest')
export class InterestController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post()
  async submit(@Body() body: unknown) {
    const { name, email } = InterestSchema.parse(body);
    await this.prisma.interestSubmission.create({ data: { name, email } });
    return { ok: true };
  }
}
