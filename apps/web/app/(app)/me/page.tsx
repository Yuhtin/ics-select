'use client';

import { BookOpen, ChevronRight, ExternalLink, FileText, Sparkles, Users, Video } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api/client';
import { PageHeader } from '../../../components/shell/page-header';
import type { StatusChipStatus } from '../../../components/ui/status-chip';
import { StatusChip } from '../../../components/ui/status-chip';

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
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `${fmt.format(start)} a ${fmt.format(end)}`;
  } catch {
    return '';
  }
}

const FORMAT_ICONS: Record<string, typeof BookOpen> = {
  PROBLEM: FileText,
  VIDEO: Video,
  ARTICLE: BookOpen,
  BOOK: BookOpen,
};

const RESOURCES_MOCK = [
  { id: '1', label: 'Cheat Sheet: Big O', icon: FileText },
  { id: '2', label: 'Visualizing Arrays', icon: ExternalLink },
  { id: '3', label: 'Lab: Hashing Map', icon: ExternalLink },
];

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
        eyebrow="Esta semana"
        title="Meu plano"
        description="Nenhum plano ativo. Aguarde o administrador publicar o próximo plano semanal."
      />
    );
  }

  const done = current.items.filter((i) => i.status === 'DONE').length;
  const total = current.items.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const dateRange = formatDateRange(current.weekStart, current.weekEnd);
  const orderedItems = [...current.items].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Esta semana"
        title="Plano de Estudo Semanal"
        description={dateRange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Main content */}
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand" aria-hidden="true" />
              Módulos da Semana
            </h2>
            <div className="space-y-3">
              {orderedItems.map((item) => {
                const Icon = FORMAT_ICONS[item.libraryItem.format] ?? BookOpen;
                const status = mapItemStatus(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(`/me/plan/${current.id}/item/${item.id}`)}
                    className="w-full bg-surface border border-border rounded-xl p-5 flex items-center gap-4 hover:shadow-md hover:border-border-strong transition-all text-left"
                  >
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      status === 'done_easy' ? 'bg-success-soft text-success' :
                      status === 'stuck' ? 'bg-danger-soft text-danger' :
                      'bg-brand-soft text-brand'
                    }`}>
                      <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-foreground truncate">{item.libraryItem.title}</p>
                      <p className="text-xs text-foreground-muted mt-0.5">
                        {item.libraryItem.format} · ~{item.libraryItem.estimatedMinutes}min
                      </p>
                    </div>
                    <StatusChip status={status} />
                    <ChevronRight className="h-4 w-4 text-foreground-subtle flex-shrink-0" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Community Practice Session Banner */}
          <div className="relative rounded-xl overflow-hidden p-6 bg-gradient-to-r from-amber-600 to-orange-500 text-white">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-bold">Sessão de Prática em Grupo</span>
              </div>
              <p className="text-white/80 text-sm">
                Participe das sessões ao vivo de coding para revisar os conceitos da semana com colegas.
              </p>
            </div>
          </div>
        </div>

        {/* Aside */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {/* Ring Progress */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center">
            <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-4 self-start">
              Progresso Semanal
            </h3>
            <RingProgress percent={percent} size={140} strokeWidth={10} />
            <p className="text-xs text-foreground-muted mt-3">
              {done} de {total} módulos concluídos
            </p>
          </div>

          {/* Additional Resources */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-4">
              Recursos Adicionais
            </h3>
            <ul className="space-y-3">
              {RESOURCES_MOCK.map((r) => (
                <li key={r.id}>
                  <a
                    href="#"
                    className="flex items-center gap-3 text-sm text-foreground-muted hover:text-brand transition-colors"
                  >
                    <r.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{r.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="#"
              className="text-xs font-semibold text-brand hover:underline mt-4 inline-block"
            >
              Ver todos os recursos
            </a>
          </div>

          {/* Flashcards CTA */}
          <div className="bg-brand p-6 rounded-xl text-white">
            <Sparkles className="h-6 w-6 mb-3" aria-hidden="true" />
            <h3 className="text-base font-bold">Flashcards Master</h3>
            <p className="text-sm text-white/70 mt-1">
              Revise conceitos com um drill rápido de 5 minutos sobre os temas da semana.
            </p>
            <button
              type="button"
              className="bg-white text-brand px-4 py-2 rounded-lg text-sm font-bold mt-4 hover:bg-white/90 transition-colors"
            >
              Iniciar Drill
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RingProgress({ percent, size, strokeWidth }: { percent: number; size: number; strokeWidth: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--surface-subtle))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--brand))"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-extrabold text-foreground">{percent}%</span>
      </div>
    </div>
  );
}
