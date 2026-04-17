import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  listForMember(aboutId: string) {
    return this.prisma.adminNote.findMany({
      where: { aboutId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: { aboutId: string; authorId: string; text: string }) {
    return this.prisma.adminNote.create({ data: input });
  }

  async update(id: string, authorId: string, text: string) {
    const existing = await this.prisma.adminNote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('note not found');
    if (existing.authorId !== authorId) throw new ForbiddenException('not the author');
    return this.prisma.adminNote.update({ where: { id }, data: { text } });
  }

  async delete(id: string, authorId: string) {
    const existing = await this.prisma.adminNote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('note not found');
    if (existing.authorId !== authorId) throw new ForbiddenException('not the author');
    await this.prisma.adminNote.delete({ where: { id } });
  }
}
