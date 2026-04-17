import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TopicsService } from './topics.service.js';
import { CreateTopicSchema, UpdateTopicSchema } from './dto.js';

@Roles('ADMIN')
@Controller('topics')
export class TopicsController {
  constructor(private readonly topics: TopicsService) {}

  @Get()
  list() {
    return this.topics.list();
  }

  @Post()
  create(@Body() body: unknown) {
    const parsed = CreateTopicSchema.parse(body);
    return this.topics.create(parsed);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateTopicSchema.parse(body);
    return this.topics.update(id, parsed);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.topics.delete(id);
  }
}
