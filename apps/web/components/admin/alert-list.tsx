'use client';

import { Avatar, Card, CardBody, Chip } from '@heroui/react';

type Alert = {
  id: string;
  name: string;
  pictureUrl: string | null;
  type: 'stuck' | 'behind' | 'complete';
  message: string;
};

interface AlertListProps {
  members: Array<{
    id: string;
    name: string;
    pictureUrl: string | null;
    stats: { doneItems: number; stuckItems: number; plansCount: number };
  }>;
}

const ALERT_CONFIG = {
  stuck: { color: 'danger' as const, label: 'Travou' },
  behind: { color: 'warning' as const, label: 'Atrasado' },
  complete: { color: 'success' as const, label: 'Completo' },
};

export function AlertList({ members }: AlertListProps) {
  const alerts: Alert[] = [];

  for (const m of members) {
    if (m.stats.stuckItems > 0) {
      alerts.push({ id: m.id, name: m.name, pictureUrl: m.pictureUrl, type: 'stuck', message: `${m.stats.stuckItems} item(ns) travado(s)` });
    } else if (m.stats.doneItems === 0 && m.stats.plansCount > 0) {
      alerts.push({ id: m.id, name: m.name, pictureUrl: m.pictureUrl, type: 'behind', message: 'Nao iniciou o plano' });
    }
  }

  if (alerts.length === 0) {
    return <p className="text-sm text-foreground-muted">Nenhum alerta no momento.</p>;
  }

  return (
    <Card shadow="sm">
      <CardBody className="p-0 divide-y divide-border/50">
        {alerts.map((a) => (
          <div key={`${a.id}-${a.type}`} className="flex items-center gap-3 px-5 py-3">
            <Avatar src={a.pictureUrl ?? undefined} name={a.name.charAt(0)} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{a.name}</p>
              <p className="text-xs text-foreground-muted">{a.message}</p>
            </div>
            <Chip size="sm" color={ALERT_CONFIG[a.type].color} variant="flat">
              {ALERT_CONFIG[a.type].label}
            </Chip>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
