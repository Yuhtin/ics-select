import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCycleReport(cycleId: string): Promise<string> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        memberships: { include: { user: true } },
        classes: { include: { attendance: true } },
      },
    });
    if (!cycle) throw new NotFoundException('cycle not found');

    const memberIds = cycle.memberships.map((m) => m.user.id);
    const plans = await this.prisma.weeklyPlan.findMany({
      where: { userId: { in: memberIds } },
      include: { items: { include: { libraryItem: true } } },
    });

    const lines: string[] = [];
    lines.push(`# Relatório do Ciclo ${cycle.name}`);
    lines.push('');
    lines.push(
      `**Período:** ${cycle.startsAt.toISOString().slice(0, 10)} — ${cycle.endsAt.toISOString().slice(0, 10)}`,
    );
    lines.push(`**Status:** ${cycle.status}`);
    lines.push(`**Membros:** ${cycle.memberships.length}`);
    lines.push('');
    lines.push('## Cobertura geral');
    const totalItems = plans.flatMap((p) => p.items).length;
    const doneItems = plans.flatMap((p) => p.items).filter((i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD').length;
    lines.push(`- Planos publicados: ${plans.filter((p) => p.status !== 'DRAFT').length}`);
    lines.push(`- Itens totais: ${totalItems}`);
    lines.push(
      `- Itens concluídos: ${doneItems} (${totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100)}%)`,
    );
    lines.push('');
    lines.push('## Aulas presenciais');
    lines.push(`- Total: ${cycle.classes.length}`);
    for (const cls of cycle.classes) {
      const present = cls.attendance.filter((a) => a.status === 'PRESENT').length;
      lines.push(`  - ${cls.title}: ${present}/${cycle.memberships.length} presentes`);
    }
    lines.push('');
    lines.push('## Membros');
    for (const m of cycle.memberships) {
      const memberPlans = plans.filter((p) => p.userId === m.user.id);
      const mDone = memberPlans.flatMap((p) => p.items).filter((i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD').length;
      const mTotal = memberPlans.flatMap((p) => p.items).length;
      lines.push(`- **${m.user.name}** (${m.user.email}): ${mDone}/${mTotal} itens`);
    }
    return lines.join('\n');
  }
}
