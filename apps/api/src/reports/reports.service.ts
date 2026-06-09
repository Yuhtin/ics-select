import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { countCanonicalPositive } from '../common/completions/canonical-completions.js';

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
    // Scope to THIS cycle (a cycle report must not count other cycles' plans)
    // and dedup carried completions PER MEMBER — the same material done across
    // weeks counts once, but two different members doing it count separately.
    const plans = await this.prisma.weeklyPlan.findMany({
      where: { userId: { in: memberIds }, cycleId },
      include: { items: { include: { libraryItem: true } } },
    });

    const perMember = new Map<string, { done: number; total: number }>();
    for (const m of cycle.memberships) {
      const items = plans
        .filter((p) => p.userId === m.user.id)
        .flatMap((p) => p.items);
      perMember.set(m.user.id, {
        done: countCanonicalPositive(items),
        total: new Set(items.map((i) => i.libraryItemId)).size,
      });
    }
    const totalItems = [...perMember.values()].reduce((s, x) => s + x.total, 0);
    const doneItems = [...perMember.values()].reduce((s, x) => s + x.done, 0);

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
      const stat = perMember.get(m.user.id) ?? { done: 0, total: 0 };
      lines.push(`- **${m.user.name}** (${m.user.email}): ${stat.done}/${stat.total} itens`);
    }
    return lines.join('\n');
  }
}
