import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CycleReceiptService } from './cycle-receipt.service.js';

@Controller('admin/cycle/:id/receipt')
@Roles('ADMIN')
export class CycleReceiptController {
  constructor(private readonly service: CycleReceiptService) {}

  @Get()
  async get(@Param('id') id: string, @Query('asOf') asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();
    if (isNaN(asOfDate.getTime())) {
      throw new BadRequestException({ error: { code: 'INVALID_AS_OF' } });
    }
    return this.service.build(id, asOfDate);
  }
}
