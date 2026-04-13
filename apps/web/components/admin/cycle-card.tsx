'use client';

import { Button, Chip, Progress } from '@heroui/react';
import { Calendar, Clock, Lock, Users } from 'lucide-react';
import Link from 'next/link';

type DisplayStatus = 'ACTIVE' | 'UPCOMING' | 'ENDED' | 'ARCHIVED';

interface CycleCardProps {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  displayStatus: DisplayStatus;
  memberCount?: number;
  avgProgress?: number;
}

const statusConfig: Record<DisplayStatus, { label: string; color: 'primary' | 'warning' | 'default' | 'danger'; icon: typeof Calendar }> = {
  ACTIVE: { label: 'Ativo', color: 'primary', icon: Calendar },
  UPCOMING: { label: 'Futuro', color: 'warning', icon: Clock },
  ENDED: { label: 'Encerrado', color: 'danger', icon: Lock },
  ARCHIVED: { label: 'Arquivado', color: 'default', icon: Lock },
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
  } catch { return iso; }
}

export function CycleCard({ id, name, startsAt, endsAt, displayStatus, memberCount = 0, avgProgress = 0 }: CycleCardProps) {
  const cfg = statusConfig[displayStatus];
  const isActive = displayStatus === 'ACTIVE';

  return (
    <div
      className={`glass rounded-xl p-6 space-y-4 card-hover ${
        isActive ? 'ring-2 ring-brand/20 shadow-glow-primary' : displayStatus === 'UPCOMING' ? 'border-warning/30' : 'opacity-75'
      }`}
    >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{name}</h3>
          <Chip size="sm" color={cfg.color} variant="flat">
            {cfg.label}
          </Chip>
        </div>

        <div className="flex items-center gap-4 text-sm text-foreground-muted">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDate(startsAt)} — {formatDate(endsAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {memberCount} membros
          </span>
        </div>

        {isActive && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-foreground-muted">
              <span>Progresso medio</span>
              <span>{avgProgress}%</span>
            </div>
            <Progress value={avgProgress} color="primary" size="sm" />
          </div>
        )}

        <Button
          as={Link}
          href={`/admin/cycles/${id}`}
          variant={isActive ? 'solid' : 'flat'}
          color={isActive ? 'primary' : 'default'}
          size="sm"
          className="w-full"
        >
          Gerenciar
        </Button>
    </div>
  );
}
