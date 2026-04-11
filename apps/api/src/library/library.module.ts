import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { UrlImportService } from './url-import.service.js';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService, UrlImportService],
  exports: [LibraryService],
})
export class LibraryModule {}
