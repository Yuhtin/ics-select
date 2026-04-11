import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { WhatsappService } from './whatsapp.service.js';

const TestSchema = z.object({
  to: z.string().min(1),
  text: z.string().min(1),
});

@Roles('ADMIN')
@Controller('notifications')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Post('test-whatsapp')
  test(@Body() body: unknown) {
    const parsed = TestSchema.parse(body);
    return this.whatsapp.send({ userId: 'admin-test', kind: 'test', ...parsed });
  }
}
