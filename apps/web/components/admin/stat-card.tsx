'use client';

import { Card, CardBody } from '@heroui/react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconClassName?: string;
}

export function StatCard({ icon: Icon, label, value, iconClassName = 'text-brand' }: StatCardProps) {
  return (
    <Card shadow="sm">
      <CardBody className="flex flex-row items-center gap-4 p-5">
        <div className="h-11 w-11 rounded-xl bg-surface-subtle flex items-center justify-center flex-shrink-0">
          <Icon className={`h-5 w-5 ${iconClassName}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-foreground-muted">{label}</p>
        </div>
      </CardBody>
    </Card>
  );
}
