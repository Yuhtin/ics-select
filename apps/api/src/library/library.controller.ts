import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { LibraryService } from './library.service.js';
import { UrlImportService } from './url-import.service.js';
import {
  CreateLibraryItemSchema,
  UpdateLibraryItemSchema,
  SearchLibrarySchema,
  ImportUrlSchema,
} from './dto/library.dto.js';
import { TestCasesPayloadSchema } from '../sandbox/test-case.schema.js';

@Roles('ADMIN')
@Controller('library')
export class LibraryController {
  constructor(
    private readonly library: LibraryService,
    private readonly urlImport: UrlImportService,
  ) {}

  @Get()
  list() {
    return this.library.list();
  }

  @Post('search')
  async search(@Body() body: unknown) {
    const parsed = SearchLibrarySchema.parse(body);
    const data = await this.library.search(parsed);
    return { data, total: Array.isArray(data) ? data.length : 0 };
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() user: JwtStrategyPayload) {
    const parsed = CreateLibraryItemSchema.parse(body);
    return this.library.create({ ...parsed, createdById: user.sub });
  }

  @Post('import')
  async import(@Body() body: unknown) {
    const parsed = ImportUrlSchema.parse(body);
    return this.urlImport.extract(parsed.url);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const item = await this.library.getById(id);
    if (!item) throw new NotFoundException('library item not found');
    return item;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateLibraryItemSchema.parse(body);
    return this.library.update(id, parsed);
  }

  // Test cases for Challenge Mode (feature 11). Sits next to PATCH so the
  // admin UI can save them in a single network call independent of the main
  // item-edit form. Rejects items where format !== PROBLEM at the service.
  @Patch(':id/test-cases')
  setTestCases(@Param('id') id: string, @Body() body: unknown) {
    const parsed = TestCasesPayloadSchema.parse(body);
    return this.library.setTestCases(id, parsed);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.library.delete(id);
  }
}
