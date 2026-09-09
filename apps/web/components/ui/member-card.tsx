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
    <article className="rounded-card border border-border-token bg-surface p-5 text-fg hover:border-border-strong transition-colors">
      <header className="flex items-center gap-3">
        <Avatar
          src={member.avatarUrl ?? undefined}
          name={member.name}
          size="md"
          className="flex-shrink-0 bg-surface-strong text-fg"
        />
        <div className="min-w-0 flex-1">
          <p className="font-sans text-sm font-semibold text-fg truncate">{member.name}</p>
          <p className="text-xs text-fg-mute truncate">{member.email}</p>
        </div>
      </header>

      <div className="border-t border-border-token my-4" />

      {currentPlan ? (
        <div>
          <div className="flex items-center justify-between gap-3 text-xs mb-2">
            <span className="text-fg-mute">
              Plano atual:{' '}
              <span className="text-fg font-medium">{currentPlan.label}</span>
            </span>
            <span className="font-mono text-fg-mute tabular-nums">
              {currentPlan.progressPercent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-strong overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] ${currentPlan.progressPercent >= 100 ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${Math.min(100, Math.max(0, currentPlan.progressPercent))}%` }}
              role="progressbar"
              aria-valuenow={currentPlan.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-fg-mute">Sem plano ativo</p>
      )}

      {stats && (
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-fg-mute">
          <span>
            Concluídos: <span className="font-mono text-fg font-medium">{stats.done}</span>
          </span>
          <span>
            Travados: <span className="font-mono text-fg font-medium">{stats.stuck}</span>
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
          className="min-h-11 rounded-input border border-border-token bg-bg-subtle text-fg hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg data-[focus-visible=true]:outline-primary"
        >
          Ver plano
        </Button>
      </div>
    </article>
  );
}
