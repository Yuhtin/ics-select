import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type CreateInput = { slug: string; label: string; order?: number };
type UpdateInput = { slug?: string; label?: string; order?: number };

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.topic.findMany({ orderBy: { order: 'asc' } });
  }

  async create(input: CreateInput) {
    const order = input.order ?? (await this.nextOrder());
    return this.prisma.topic.create({
      data: { slug: input.slug, label: input.label, order },
    });
  }

  async update(id: string, input: UpdateInput) {
    const existing = await this.prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('topic not found');
    return this.prisma.topic.update({ where: { id }, data: input });
  }

  async delete(id: string) {
    const existing = await this.prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('topic not found');
    return this.prisma.topic.delete({ where: { id } });
  }

  private async nextOrder(): Promise<number> {
    const last = await this.prisma.topic.findFirst({ orderBy: { order: 'desc' } });
    return (last?.order ?? -1) + 1;
  }
}
