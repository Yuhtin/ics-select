'use client';

import { Avatar, Button } from '@heroui/react';
import { ArrowRight } from 'lucide-react';

interface MemberCardProps {
  member: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  currentPlan?: {
    label: string;
    progressPercent: number;
  };
  stats?: {
    done: number;
    stuck: number;
  };
  onViewPlan?: () => void;
}

export function MemberCard({ member, currentPlan, stats, onViewPlan }: MemberCardProps) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-xs hover:shadow-sm hover:border-border-strong transition-all">
      <header className="flex items-center gap-3">
        <Avatar
          src={member.avatarUrl ?? undefined}
          name={member.name}
          size="md"
          className="flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
          <p className="text-xs text-foreground-muted truncate">{member.email}</p>
        </div>
      </header>

      <div className="border-t border-border my-4" />

      {currentPlan ? (
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-foreground-muted">
              Plano atual:{' '}
              <span className="text-foreground font-medium">{currentPlan.label}</span>
            </span>
            <span className="text-foreground-muted tabular-nums">
              {currentPlan.progressPercent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${Math.min(100, Math.max(0, currentPlan.progressPercent))}%` }}
              role="progressbar"
              aria-valuenow={currentPlan.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-foreground-subtle italic">Sem plano ativo</p>
      )}

      {stats && (
        <div className="flex items-center gap-4 mt-4 text-xs text-foreground-muted">
          <span>
            Concluídos: <span className="text-foreground font-medium">{stats.done}</span>
          </span>
          <span>
            Travados: <span className="text-foreground font-medium">{stats.stuck}</span>
          </span>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button
          size="sm"
          color="default"
          variant="flat"
          fullWidth
          endContent={<ArrowRight className="h-3.5 w-3.5" />}
          onPress={onViewPlan}
        >
          Ver plano
        </Button>
      </div>
    </article>
  );
}
