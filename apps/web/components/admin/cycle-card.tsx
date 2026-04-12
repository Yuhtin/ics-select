'use client';

import { Button, Card, CardBody, Chip, Progress } from '@heroui/react';
import { Calendar, Users } from 'lucide-react';
import Link from 'next/link';

interface CycleCardProps {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
  memberCount?: number;
  avgProgress?: number;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
  } catch { return iso; }
}

export function CycleCard({ id, name, startsAt, endsAt, status, memberCount = 0, avgProgress = 0 }: CycleCardProps) {
  const isActive = status === 'ACTIVE';

  return (
    <Card
      shadow="sm"
      className={isActive ? 'border-2 border-brand/40 ring-2 ring-brand/10' : 'opacity-75'}
    >
      <CardBody className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{name}</h3>
          <Chip size="sm" color={isActive ? 'primary' : 'default'} variant="flat">
            {isActive ? 'Ativo' : 'Arquivado'}
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
          variant={isActive ? 'solid' : 'bordered'}
          color={isActive ? 'primary' : 'default'}
          size="sm"
          className="w-full"
        >
          Gerenciar
        </Button>
      </CardBody>
    </Card>
  );
}
