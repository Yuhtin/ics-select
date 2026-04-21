import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { SubmitWaitlistSchema } from './dto/submit-waitlist.dto.js';
import { WaitlistService } from './waitlist.service.js';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly service: WaitlistService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post()
  async submit(@Body() body: unknown, @Req() req: Request) {
    const parsed = SubmitWaitlistSchema.safeParse(body);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new BadRequestException(`invalid body — ${detail}`);
    }
    const ipHash = this.hashIp(req);
    const ua = (req.headers['user-agent'] ?? '').toString().slice(0, 255);
    return this.service.submit(parsed.data, ipHash, ua);
  }

  private hashIp(req: Request): string | null {
    const header = req.headers['x-forwarded-for'];
    const first =
      Array.isArray(header) ? header[0] :
      typeof header === 'string' ? header.split(',')[0]!.trim() :
      req.ip ?? null;
    if (!first) return null;
    return createHash('sha256').update(first).digest('hex');
  }
}
