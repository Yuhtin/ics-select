'use client';

import { use, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Chip,
  Progress,
  Select,
  SelectItem,
} from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '../../../../../lib/api/client';
import { StatCard } from '../../../../../components/admin/stat-card';

type User = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: string;
};

type Cycle = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  memberships: Array<{ user: { id: string } }>;
};

type LibraryItem = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: string;
  difficulty: string;
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
};

type StudySession = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
};

type PlanItem = {
  id: string;
  order: number;
  status: string;
  stuck: boolean;
  difficultyRating: string | null;
  reflection: string | null;
  completionStatus: string | null;
  feedback: string | null;
  completedAt: string | null;
  libraryItem: LibraryItem;
  sessions: StudySession[];
};

type WeeklyPlan = {
  id: string;
  cycleId: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  items: PlanItem[];
};

const FORMAT_ICONS: Record<string, string> = {
  VIDEO: '🎬',
  ARTICLE: '📝',
  PROBLEM: '🧩',
  BOOK: '📖',
  OTHER: '📎',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'text-success',
  MEDIUM: 'text-warning',
  HARD: 'text-danger',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Facil',
  MEDIUM: 'Medio',
  HARD: 'Dificil',
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));
  } catch { return iso; }
}

function formatDateFull(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
  } catch { return iso; }
}

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const { data: member } = useQuery({
    queryKey: ['member', id],
    queryFn: () => apiFetch<User>(`/members/${id}`),
  });

  const { data: cycles } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch<Cycle[]>('/cycles'),
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['member-plans', id],
    queryFn: () => apiFetch<WeeklyPlan[]>(`/members/${id}/plans`),
  });

  // Cycles this member belongs to
  const memberCycles = useMemo(() => {
    if (!cycles || !plans) return [];
    const cycleIdsFromPlans = new Set(plans.map((p) => p.cycleId));
    const cycleIdsFromMemberships = new Set(
      cycles.filter((c) => c.memberships?.some((m) => m.user.id === id)).map((c) => c.id),
    );
    const allCycleIds = new Set([...cycleIdsFromPlans, ...cycleIdsFromMemberships]);
    return cycles.filter((c) => allCycleIds.has(c.id));
  }, [cycles, plans, id]);

  // Auto-select first cycle
  const activeCycleId = selectedCycleId || memberCycles[0]?.id || '';

  // Plans filtered by selected cycle
  const cyclePlans = useMemo(() => {
    if (!plans || !activeCycleId) return [];
    return plans.filter((p) => p.cycleId === activeCycleId).sort(
      (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime(),
    );
  }, [plans, activeCycleId]);

  // Stats for this cycle
  const stats = useMemo(() => {
    const allItems = cyclePlans.flatMap((p) => p.items);
    const done = allItems.filter((i) => i.status === 'DONE').length;
    const stuck = allItems.filter((i) => i.stuck).length;
    const total = allItems.length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const easyCount = allItems.filter((i) => i.difficultyRating === 'EASY').length;
    const hardCount = allItems.filter((i) => i.difficultyRating === 'HARD').length;
    const totalMinutes = allItems.reduce((s, i) => s + i.libraryItem.estimatedMinutes, 0);

    // Topic coverage
    const tagMap = new Map<string, { done: number; total: number }>();
    for (const item of allItems) {
      for (const tag of item.libraryItem.tags) {
        const entry = tagMap.get(tag) ?? { done: 0, total: 0 };
        entry.total++;
        if (item.status === 'DONE') entry.done++;
        tagMap.set(tag, entry);
      }
    }
    const topicCoverage = Array.from(tagMap.entries())
      .map(([tag, { done: d, total: t }]) => ({ tag, done: d, total: t }))
      .sort((a, b) => b.total - a.total);

    return { done, stuck, total, pct, easyCount, hardCount, totalMinutes, topicCoverage };
  }, [cyclePlans]);

  const selectedCycle = memberCycles.find((c) => c.id === activeCycleId);

  if (!member || !cycles) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton-pulse rounded-lg" />
        <div className="glass rounded-xl h-32 skeleton-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-xl h-24 skeleton-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Button
          as={Link}
          href="/admin/members"
          variant="light"
          size="sm"
          startContent={<ArrowLeft className="h-4 w-4" />}
          className="mb-3 -ml-2"
        >
          Membros
        </Button>

        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-4">
            <Avatar src={member.pictureUrl ?? undefined} name={member.name.charAt(0)} size="lg" className="h-16 w-16 text-xl" />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{member.name}</h1>
              <p className="text-sm text-foreground-muted">{member.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Chip size="sm" variant="flat" color={member.role === 'ADMIN' ? 'primary' : 'default'}>
                  {member.role === 'ADMIN' ? 'Admin' : 'Membro'}
                </Chip>
                {memberCycles.length > 0 && (
                  <Chip size="sm" variant="flat">{memberCycles.length} ciclo{memberCycles.length !== 1 ? 's' : ''}</Chip>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cycle selector */}
      {memberCycles.length === 0 ? (
        <div className="glass rounded-xl text-center py-12 px-8">
          <div className="h-12 w-12 rounded-xl bg-surface-subtle flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-6 w-6 text-foreground-subtle" />
          </div>
          <p className="text-foreground-muted font-medium">Este membro nao participa de nenhum ciclo.</p>
          <p className="text-foreground-subtle text-sm mt-1">Adicione-o a um ciclo para ver o desempenho.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Select
              label="Ciclo"
              placeholder="Selecione um ciclo"
              selectedKeys={activeCycleId ? [activeCycleId] : []}
              onSelectionChange={(keys) => {
                const key = [...keys][0] as string;
                if (key) setSelectedCycleId(key);
              }}
              variant="bordered"
              className="max-w-xs"
              classNames={{ trigger: 'glass' }}
            >
              {memberCycles.map((c) => (
                <SelectItem key={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </Select>
            {selectedCycle && (
              <p className="text-sm text-foreground-muted flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDateFull(selectedCycle.startsAt)} — {formatDateFull(selectedCycle.endsAt)}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={TrendingUp} label="Progresso" value={`${stats.pct}%`} />
            <StatCard icon={CheckCircle} label="Concluidos" value={`${stats.done}/${stats.total}`} iconClassName="text-success" />
            <StatCard icon={XCircle} label="Travados" value={stats.stuck} iconClassName="text-danger" />
            <StatCard icon={Clock} label="Tempo total" value={`${stats.totalMinutes}min`} iconClassName="text-foreground-muted" />
          </div>

          {/* Difficulty breakdown */}
          {(stats.easyCount > 0 || stats.hardCount > 0) && (
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Dificuldade percebida</h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-success" />
                  <span className="text-sm text-foreground-muted">Facil: {stats.easyCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-danger" />
                  <span className="text-sm text-foreground-muted">Dificil: {stats.hardCount}</span>
                </div>
                {stats.done > 0 && (
                  <div className="flex-1">
                    <Progress
                      value={(stats.easyCount / (stats.easyCount + stats.hardCount)) * 100}
                      color="success"
                      size="sm"
                      className="max-w-[200px]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Topic coverage */}
          {stats.topicCoverage.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-brand" />
                Cobertura por topico
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.topicCoverage.map((topic) => {
                  const pct = topic.total === 0 ? 0 : Math.round((topic.done / topic.total) * 100);
                  return (
                    <div key={topic.tag} className="flex items-center gap-3 p-3 rounded-lg bg-surface/40 border border-border/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{topic.tag}</p>
                        <p className="text-xs text-foreground-muted">{topic.done}/{topic.total} concluidos</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Progress value={pct} color={pct === 100 ? 'success' : 'primary'} size="sm" className="w-16" />
                        <span className="text-xs font-medium text-foreground-muted w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly plans */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand" />
              Planos semanais ({cyclePlans.length})
            </h3>

            {plansLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass rounded-xl h-20 skeleton-pulse" />
                ))}
              </div>
            ) : cyclePlans.length === 0 ? (
              <div className="glass rounded-xl text-center py-12">
                <p className="text-sm text-foreground-muted">Nenhum plano neste ciclo.</p>
                <Button
                  as={Link}
                  href={`/admin/plans/${id}`}
                  color="primary"
                  variant="flat"
                  size="sm"
                  className="mt-3"
                >
                  Criar plano
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {cyclePlans.map((plan) => {
                  const doneCount = plan.items.filter((i) => i.status === 'DONE').length;
                  const totalCount = plan.items.length;
                  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
                  const isExpanded = expandedPlanId === plan.id;

                  return (
                    <div key={plan.id} className="glass rounded-xl overflow-hidden">
                      {/* Plan header - clickable */}
                      <button
                        type="button"
                        className="w-full p-4 flex items-center gap-4 text-left hover:bg-surface/30 transition-colors"
                        onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                      >
                        <div className="h-10 w-10 rounded-lg bg-brand-soft flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 text-brand" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {formatDate(plan.weekStart)} — {formatDate(plan.weekEnd)}
                          </p>
                          <p className="text-xs text-foreground-muted mt-0.5">
                            {doneCount}/{totalCount} itens concluidos
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Progress value={pct} color={pct === 100 ? 'success' : 'primary'} size="sm" className="w-24" />
                          <span className="text-sm font-medium text-foreground w-10 text-right">{pct}%</span>
                          <Chip size="sm" variant="flat" color={plan.status === 'PUBLISHED' ? 'primary' : 'default'}>
                            {plan.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
                          </Chip>
                        </div>
                      </button>

                      {/* Expanded items */}
                      {isExpanded && (
                        <div className="border-t border-border/20 p-3 space-y-2">
                          {plan.items
                            .sort((a, b) => a.order - b.order)
                            .map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-3 rounded-lg bg-surface/30 border border-border/15"
                            >
                              {/* Status indicator */}
                              <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                item.status === 'DONE'
                                  ? 'bg-success text-white'
                                  : item.stuck
                                    ? 'bg-danger text-white'
                                    : 'bg-surface-subtle text-foreground-subtle'
                              }`}>
                                {item.status === 'DONE' ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : item.stuck ? (
                                  <XCircle className="h-3 w-3" />
                                ) : (
                                  <span className="text-[10px] font-bold">{item.order + 1}</span>
                                )}
                              </div>

                              {/* Format icon */}
                              <span className="text-base mt-0.5 flex-shrink-0">
                                {FORMAT_ICONS[item.libraryItem.format] ?? '📎'}
                              </span>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-sm font-medium ${item.status === 'DONE' ? 'text-foreground' : 'text-foreground-muted'}`}>
                                    {item.libraryItem.title}
                                  </p>
                                  {item.libraryItem.url && (
                                    <a
                                      href={item.libraryItem.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-brand hover:text-brand-hover flex-shrink-0"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>

                                {/* Meta info */}
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className={`text-xs font-medium ${DIFFICULTY_COLORS[item.libraryItem.difficulty] ?? 'text-foreground-muted'}`}>
                                    {DIFFICULTY_LABELS[item.libraryItem.difficulty] ?? item.libraryItem.difficulty}
                                  </span>
                                  <span className="text-xs text-foreground-subtle flex items-center gap-0.5">
                                    <Clock className="h-3 w-3" />
                                    {item.libraryItem.estimatedMinutes}min
                                  </span>
                                  {item.difficultyRating && (
                                    <Chip size="sm" variant="flat" color={item.difficultyRating === 'EASY' ? 'success' : 'danger'} className="text-[10px]">
                                      Achou {item.difficultyRating === 'EASY' ? 'facil' : 'dificil'}
                                    </Chip>
                                  )}
                                  {item.completionStatus && item.completionStatus !== 'DONE' && (
                                    <Chip size="sm" variant="flat" color={item.completionStatus === 'STUCK' ? 'danger' : 'warning'} className="text-[10px]">
                                      {item.completionStatus === 'STUCK' ? 'Travou' : 'Teve duvidas'}
                                    </Chip>
                                  )}
                                  {item.libraryItem.tags.slice(0, 3).map((tag) => (
                                    <Chip key={tag} size="sm" variant="flat" className="text-[10px]">{tag}</Chip>
                                  ))}
                                </div>

                                {/* Reflection / feedback */}
                                {item.reflection && (
                                  <p className="text-xs text-foreground-muted mt-2 italic border-l-2 border-brand/30 pl-2">
                                    &ldquo;{item.reflection}&rdquo;
                                  </p>
                                )}
                                {item.feedback && (
                                  <p className="text-xs text-foreground-muted mt-1 italic border-l-2 border-warning/30 pl-2">
                                    {item.feedback}
                                  </p>
                                )}

                                {/* Completed date */}
                                {item.completedAt && (
                                  <p className="text-[10px] text-foreground-subtle mt-1">
                                    Concluido em {formatDateFull(item.completedAt)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick action */}
          <div className="flex justify-end">
            <Button
              as={Link}
              href={`/admin/plans/${id}`}
              color="primary"
              startContent={<BookOpen className="h-4 w-4" />}
            >
              Criar novo plano
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
