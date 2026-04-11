'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api/client';
import { PageHeader } from '../../../components/shell/page-header';
import { LibraryItemRow } from '../../../components/ui/library-item-row';
import type { StatusChipStatus } from '../../../components/ui/status-chip';
import { AiAssistantCard } from '../../../components/ui/ai-assistant-card';

type PlanItem = {
  id: string;
  status: 'PENDING' | 'DONE';
  order: number;
  stuck: boolean;
  libraryItem: {
    id: string;
    title: string;
    estimatedMinutes: number;
    url: string | null;
    format: string;
  };
  sessions: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
};

type Plan = {
  id: string;
  status: string;
  weekStart: string;
  weekEnd: string;
  items: PlanItem[];
};

const RECENT_ACTIVITY_MOCK = [
  { id: '1', whenLabel: 'Ontem', text: 'Marcou um item como concluído' },
  { id: '2', whenLabel: '2 dias atrás', text: 'Abriu detalhes de um item travado' },
  { id: '3', whenLabel: '3 dias atrás', text: 'Plano semanal foi publicado' },
];

function mapItemStatus(item: PlanItem): StatusChipStatus {
  if (item.stuck) return 'stuck';
  if (item.status === 'DONE') return 'done_easy';
  return 'pending';
}

function formatDateRange(weekStart: string, weekEnd: string): string {
  try {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
    return `${fmt.format(start)} a ${fmt.format(end)}`;
  } catch {
    return '';
  }
}

export default function MeHomePage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['me-week'],
    queryFn: () => apiFetch<Plan[]>('/me/week'),
  });

  if (isLoading) {
    return <p className="text-sm text-foreground-muted">Carregando seu plano...</p>;
  }

  const current = data?.[0];

  if (!current) {
    return (
      <PageHeader
        eyebrow="Meu plano"
        title="Nenhum plano ativo"
        description="Aguarde o administrador publicar o próximo plano semanal."
      />
    );
  }

  const done = current.items.filter((i) => i.status === 'DONE').length;
  const total = current.items.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const dateRange = formatDateRange(current.weekStart, current.weekEnd);
  const orderedItems = [...current.items].sort((a, b) => a.order - b.order);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      <div className="min-w-0">
        <PageHeader
          eyebrow="Esta semana"
          title="Meu plano"
          description={dateRange}
        />

        <div>
          <div className="flex justify-between text-xs text-foreground-muted mb-2">
            <span>Progresso semanal</span>
            <span className="font-medium text-foreground tabular-nums">
              {done} de {total} · {percent}%
            </span>
          </div>
          <div
            className="h-2 rounded-full bg-surface-subtle overflow-hidden"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-8">
          {orderedItems.map((item) => (
            <LibraryItemRow
              key={item.id}
              title={item.libraryItem.title}
              source={item.libraryItem.format}
              estimatedMinutes={item.libraryItem.estimatedMinutes}
              status={mapItemStatus(item)}
              onClick={() =>
                router.push(`/me/plan/${current.id}/item/${item.id}`)
              }
            />
          ))}
        </div>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <AiAssistantCard
          title="Otimize seu plano"
          description="Sugestões baseadas no seu histórico e dificuldades ao longo do ciclo."
          ctaLabel="Gerar sugestões"
        />

        <section>
          <h2 className="text-xs uppercase tracking-wider font-semibold text-foreground-muted mb-3">
            Atividade recente
          </h2>
          <ul className="space-y-3">
            {RECENT_ACTIVITY_MOCK.map((activity) => (
              <li key={activity.id} className="text-sm">
                <p className="text-xs text-foreground-subtle">{activity.whenLabel}</p>
                <p className="text-foreground-muted leading-snug mt-0.5">{activity.text}</p>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-foreground-subtle italic mt-4">
            Feed real em breve
          </p>
        </section>
      </aside>
    </div>
  );
}
